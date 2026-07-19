import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_HOST = "127.0.0.1";
const SERVER_START_TIMEOUT_MS = 30_000;
const API_REQUEST_TIMEOUT_MS = 150_000;
const SERVER_STOP_TIMEOUT_MS = 5_000;
const EXPECTED_PROVIDER_COUNT = 5;
export const PERSONAL_AUTO_OFFICIAL_DOMAINS = [
  "allstate.com",
  "amica.com",
  "geico.com",
  "libertymutual.com",
  "mapfreinsurance.com",
  "plymouthrock.com",
  "progressive.com",
  "statefarm.com",
];

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function loadEnvironment(workspaceRoot) {
  for (const filename of [".env.local", ".env"]) {
    const path = resolve(workspaceRoot, filename);
    if (existsSync(path)) process.loadEnvFile(path);
  }

  for (const name of ["TAVILY_API_KEY", "POLICYSCOUT_INTERNAL_API_KEY"]) {
    if (!process.env[name]?.trim()) {
      throw new Error(`${name} is missing. Add it to .env before running this verifier.`);
    }
  }
}

function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, LOCAL_HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local verification port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function waitForServer(baseUrl, child, output) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Local Next server exited during startup.\n${output.value}`);
    }
    try {
      await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      return;
    } catch {
      await delay(200);
    }
  }
  throw new Error(`Timed out waiting for the local Next server.\n${output.value}`);
}

async function startServer(workspaceRoot) {
  const port = await availablePort();
  const baseUrl = `http://${LOCAL_HOST}:${port}`;
  const nextBinary = resolve(workspaceRoot, "node_modules/next/dist/bin/next");
  if (!existsSync(nextBinary)) {
    throw new Error("Next.js is not installed. Run `corepack pnpm install` first.");
  }

  const child = spawn(process.execPath, [nextBinary, "dev", "-H", LOCAL_HOST, "-p", String(port)], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = { value: "" };
  const capture = (chunk) => {
    output.value = `${output.value}${String(chunk)}`.slice(-16_000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  try {
    await waitForServer(baseUrl, child, output);
    return { baseUrl, child };
  } catch (error) {
    await stopServer(child);
    throw error;
  }
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  await Promise.race([exited, delay(SERVER_STOP_TIMEOUT_MS)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function postJson(baseUrl, path, body, internalApiKey) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${internalApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON status ${response.status}: ${safeErrorExcerpt(text)}`);
  }
  if (!response.ok) {
    throw new Error(`${path} returned status ${response.status}: ${safeErrorExcerpt(JSON.stringify(parsed))}`);
  }
  return parsed;
}

async function writeJson(directory, filename, value) {
  const path = resolve(directory, filename);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeErrorExcerpt(value) {
  let excerpt = String(value).slice(0, 2_000);
  for (const secret of [process.env.TAVILY_API_KEY, process.env.POLICYSCOUT_INTERNAL_API_KEY]) {
    if (secret) excerpt = excerpt.replaceAll(secret, "[REDACTED]");
  }
  return excerpt;
}

function officialDomainForHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/u, "");
  return PERSONAL_AUTO_OFFICIAL_DOMAINS.find(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
  );
}

function isOfficialProviderUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && officialDomainForHostname(url.hostname) !== undefined;
  } catch {
    return false;
  }
}

function hasExactSet(values, expected) {
  if (!Array.isArray(values) || values.length !== expected.size) return false;
  const actual = new Set(values);
  return actual.size === expected.size && [...expected].every((value) => actual.has(value));
}

function hasRequestIdentity(value, quoteRequest) {
  return (
    value?.workflowId === quoteRequest.workflowId &&
    value?.confirmedRequestId === quoteRequest.id &&
    value?.specificationHash === quoteRequest.specificationHash
  );
}

export function normalizeLocalBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("--base-url must be a valid local HTTP URL");
  }
  const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (
    url.protocol !== "http:" ||
    !localHost ||
    url.username !== "" ||
    url.password !== "" ||
    (url.pathname !== "" && url.pathname !== "/") ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("--base-url is restricted to a loopback HTTP origin so API keys are not sent remotely");
  }
  return url.origin;
}

export function validateLiveResearch(research, artifactPath) {
  const selected = research?.ranking?.selected;
  assert(research?.mode === "live", "Research response did not confirm live mode");
  assert(
    Array.isArray(selected) && selected.length === EXPECTED_PROVIDER_COUNT,
    `Live Tavily research returned ${Array.isArray(selected) ? selected.length : 0} selected providers, not five. Inspect ${artifactPath}`,
  );
  const providerIds = new Set(selected.map((provider) => provider.providerId));
  assert(providerIds.size === EXPECTED_PROVIDER_COUNT, `Live ranking contains duplicate provider IDs. Inspect ${artifactPath}`);
  const ranks = selected.map((provider) => provider.topFiveRank).sort((left, right) => left - right);
  assert(ranks.every((rank, index) => rank === index + 1), `Live ranking must contain ranks 1 through 5. Inspect ${artifactPath}`);
  assert(
    selected.every(
      (provider) =>
        provider.simulated === false &&
        isOfficialProviderUrl(provider.website) &&
        Array.isArray(provider.sources) &&
        provider.sources.length > 0 &&
        provider.sources.every(
          (source) =>
            source.officialSource === true &&
            source.sourceKind === "provider" &&
            isOfficialProviderUrl(source.url),
        ),
    ),
    `Every selected provider and source must resolve to an allowlisted official carrier domain. Inspect ${artifactPath}`,
  );
  const blockingWarnings = (research?.ranking?.warnings ?? []).filter(
    (warning) => typeof warning === "string" && warning.startsWith("Blocking:"),
  );
  assert(blockingWarnings.length === 0, `Live ranking contains a blocking warning. Inspect ${artifactPath}`);
  return { selected, providerIds };
}

export function validateSyntheticBatch(synthetic, quoteRequest, providerIds, artifactPath) {
  const quotes = synthetic?.quotes;
  assert(Array.isArray(quotes) && quotes.length === EXPECTED_PROVIDER_COUNT, `Expected five synthetic quotes. Inspect ${artifactPath}`);
  assert(
    hasExactSet(quotes.map((quote) => quote.providerId), providerIds),
    `Synthetic quotes must map one-to-one to the live Top Five. Inspect ${artifactPath}`,
  );
  assert(
    quotes.every(
      (quote) =>
        hasRequestIdentity(quote, quoteRequest) &&
        quote.sourceType === "synthetic_dataset" &&
        quote.sourceConversationId === null &&
        quote.simulated === true &&
        typeof quote.disclaimer === "string" &&
        quote.disclaimer.includes("not supplied by the insurer") &&
        quote.disclaimer.includes("not binding") &&
        Array.isArray(quote.evidence) &&
        quote.evidence.length > 0 &&
        quote.evidence.every(
          (evidence) => evidence.type === "demo_fixture" && evidence.verificationStatus === "not_applicable",
        ),
    ),
    `Synthetic quote provenance or disclaimer validation failed. Inspect ${artifactPath}`,
  );
  return quotes;
}

export function validateNormalizedBatch(normalized, quoteRequest, providerIds, artifactPath) {
  const quotes = normalized?.quotes;
  assert(Array.isArray(quotes) && quotes.length === EXPECTED_PROVIDER_COUNT, `Expected five normalized quotes. Inspect ${artifactPath}`);
  assert(
    hasExactSet(quotes.map((quote) => quote.providerId), providerIds),
    `Normalized quotes must map one-to-one to the live Top Five. Inspect ${artifactPath}`,
  );
  assert(
    quotes.every(
      (quote) =>
        hasRequestIdentity(quote, quoteRequest) &&
        quote.sourceType === "synthetic_dataset" &&
        quote.sourceConversationId === null &&
        quote.simulated === true &&
        quote.requiresHumanVerification === true,
    ),
    `Normalized quote provenance or human-verification validation failed. Inspect ${artifactPath}`,
  );
  return quotes;
}

export function validatePerson3Handoff(recommendation, quoteRequest, providerIds, normalizedQuoteIds, artifactPath) {
  const handoff = recommendation?.negotiationHandoff;
  const target = handoff?.target;
  assert(
    handoff?.workflowId === quoteRequest.workflowId &&
      handoff?.specificationHash === quoteRequest.specificationHash &&
      handoff?.selectionSource === "system_recommendation",
    `Recommendation handoff identity is invalid. Inspect ${artifactPath}`,
  );
  assert(
    target?.providerId &&
      providerIds.has(target.providerId) &&
      normalizedQuoteIds.has(target.quoteId) &&
      Number.isInteger(target.effectiveComparisonCostCents) &&
      target.effectiveComparisonCostCents > 0,
    `Recommendation has no valid Person 3 target. Inspect ${artifactPath}`,
  );
  assert(
    target.simulated === true && target.requiresHumanVerification === true,
    "Person 3 target lost its synthetic/human-verification labels",
  );
  assert(
    typeof target.disclaimer === "string" &&
      target.disclaimer.includes("not supplied by the insurer") &&
      target.disclaimer.includes("not binding"),
    "Person 3 target lost its non-binding insurer disclaimer",
  );
  return handoff;
}

function formatPrice(amountCents, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export async function main() {
  const workspaceRoot = process.cwd();
  loadEnvironment(workspaceRoot);

  const profilePath = resolve(
    workspaceRoot,
    readOption("--profile") ?? "tests/fixtures/fake_person_profile.json",
  );
  const runAt = new Date().toISOString();
  const runId = runAt.replaceAll(":", "-");
  const artifactDirectory = resolve(
    workspaceRoot,
    readOption("--output") ?? `.artifacts/person4/${runId}`,
  );
  const profile = JSON.parse(await readFile(profilePath, "utf8"));
  const quoteRequest = profile.confirmedQuoteRequest;
  assert(quoteRequest && typeof quoteRequest === "object", `${basename(profilePath)} has no confirmedQuoteRequest`);

  const configuredBaseUrl = readOption("--base-url") ?? process.env.PERSON4_BASE_URL;
  let localServer;
  const baseUrl = configuredBaseUrl
    ? normalizeLocalBaseUrl(configuredBaseUrl)
    : (localServer = await startServer(workspaceRoot)).baseUrl;

  try {
    await mkdir(artifactDirectory, { recursive: true });
    console.log(`Running live Person 4 verification against ${baseUrl}`);
    const research = await postJson(
      baseUrl,
      "/api/research/run",
      { quoteRequest, mode: "live", evaluatedAt: runAt },
      process.env.POLICYSCOUT_INTERNAL_API_KEY,
    );
    const researchPath = await writeJson(artifactDirectory, "research.json", research);
    const { selected, providerIds } = validateLiveResearch(research, researchPath);

    const synthetic = await postJson(
      baseUrl,
      "/api/quotes/synthetic",
      { quoteRequest, providerRanking: research.ranking, generatedAt: runAt },
      process.env.POLICYSCOUT_INTERNAL_API_KEY,
    );
    const syntheticPath = await writeJson(artifactDirectory, "synthetic-quotes.json", synthetic);
    const syntheticQuotes = validateSyntheticBatch(synthetic, quoteRequest, providerIds, syntheticPath);

    const evidence = syntheticQuotes.flatMap((quote) => quote.evidence);
    const normalized = await postJson(
      baseUrl,
      "/api/quotes/normalize",
      { quoteRequest, rawQuotes: syntheticQuotes },
      process.env.POLICYSCOUT_INTERNAL_API_KEY,
    );
    const normalizedPath = await writeJson(artifactDirectory, "normalized-quotes.json", normalized);
    const normalizedQuotes = validateNormalizedBatch(normalized, quoteRequest, providerIds, normalizedPath);

    const recommendation = await postJson(
      baseUrl,
      "/api/recommendations",
      {
        workflowId: quoteRequest.workflowId,
        specificationHash: quoteRequest.specificationHash,
        insuranceLine: "auto",
        quotes: normalizedQuotes,
        effectiveOffers: [],
        providerRanking: research.ranking,
        evidence,
        generatedAt: runAt,
      },
      process.env.POLICYSCOUT_INTERNAL_API_KEY,
    );
    const recommendationPath = await writeJson(artifactDirectory, "recommendation.json", recommendation);
    const handoff = validatePerson3Handoff(
      recommendation,
      quoteRequest,
      providerIds,
      new Set(normalizedQuotes.map((quote) => quote.quoteId)),
      recommendationPath,
    );
    const target = handoff.target;
    const handoffPath = await writeJson(artifactDirectory, "person3-handoff.json", handoff);

    console.log("\nLive Tavily Top Five:");
    for (const provider of selected) {
      console.log(`  ${provider.topFiveRank}. ${provider.providerName} — ${provider.website}`);
    }
    console.log("\nSynthetic quote batch: 5 generated, normalized, and compared");
    console.log(
      `Person 3 target: ${target.providerName} at ${formatPrice(target.effectiveComparisonCostCents, target.currency)} per ${target.policyTermMonths}-month policy term`,
    );
    console.log(`Disclosure: ${target.disclaimer}`);
    console.log(`Handoff: ${handoffPath}`);
    console.log(`All artifacts: ${artifactDirectory}`);
  } finally {
    await stopServer(localServer?.child);
  }
}

const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  main().catch((error) => {
    console.error(`\nPerson 4 verification failed: ${safeErrorExcerpt(error instanceof Error ? error.message : String(error))}`);
    process.exitCode = 1;
  });
}
