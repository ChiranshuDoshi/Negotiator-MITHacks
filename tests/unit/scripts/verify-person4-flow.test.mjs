import { describe, expect, it } from "vitest";

import {
  normalizeLocalBaseUrl,
  validateLiveResearch,
  validateNormalizedBatch,
  validatePerson3Handoff,
  validateSyntheticBatch,
} from "../../../scripts/verify-person4-flow.mjs";

const HASH = "a".repeat(64);
const request = {
  id: "request-1",
  workflowId: "workflow-1",
  specificationHash: HASH,
};
const domains = ["allstate.com", "amica.com", "geico.com", "progressive.com", "statefarm.com"];

function provider(domain, index) {
  return {
    providerId: `web-${domain.replaceAll(".", "-")}`,
    providerName: domain,
    website: `https://${domain}`,
    topFiveRank: index + 1,
    simulated: false,
    sources: [
      {
        url: `https://www.${domain}/auto`,
        officialSource: true,
        sourceKind: "provider",
      },
    ],
  };
}

function liveResearch() {
  return {
    mode: "live",
    ranking: {
      selected: domains.map(provider),
      warnings: [],
    },
  };
}

function syntheticBatch(providerIds) {
  return {
    quotes: [...providerIds].map((providerId, index) => ({
      quoteId: `quote-${index + 1}`,
      providerId,
      workflowId: request.workflowId,
      confirmedRequestId: request.id,
      specificationHash: request.specificationHash,
      sourceType: "synthetic_dataset",
      sourceConversationId: null,
      simulated: true,
      disclaimer: "Simulated quote; not supplied by the insurer and not binding.",
      evidence: [{ type: "demo_fixture", verificationStatus: "not_applicable" }],
    })),
  };
}

function normalizedBatch(providerIds) {
  return {
    quotes: [...providerIds].map((providerId, index) => ({
      quoteId: `quote-${index + 1}`,
      providerId,
      workflowId: request.workflowId,
      confirmedRequestId: request.id,
      specificationHash: request.specificationHash,
      sourceType: "synthetic_dataset",
      sourceConversationId: null,
      simulated: true,
      requiresHumanVerification: true,
    })),
  };
}

describe("Person 4 live verifier", () => {
  it("restricts authenticated base URLs to loopback HTTP origins", () => {
    expect(normalizeLocalBaseUrl("http://127.0.0.1:3000/")).toBe("http://127.0.0.1:3000");
    expect(normalizeLocalBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(() => normalizeLocalBaseUrl("https://example.com")).toThrow(/loopback/);
    expect(() => normalizeLocalBaseUrl("http://127.0.0.1.example.com:3000")).toThrow(/loopback/);
    expect(() => normalizeLocalBaseUrl("http://user:pass@127.0.0.1:3000")).toThrow(/loopback/);
    expect(() => normalizeLocalBaseUrl("http://127.0.0.1:3000/proxy")).toThrow(/loopback/);
  });

  it("accepts exactly five unique live providers with only allowlisted official sources", () => {
    const result = validateLiveResearch(liveResearch(), "research.json");

    expect(result.selected).toHaveLength(5);
    expect(result.providerIds.size).toBe(5);
  });

  it("rejects mock, duplicate-rank, blocking, and nonofficial research", () => {
    expect(() => validateLiveResearch({ ...liveResearch(), mode: "mock" }, "research.json")).toThrow(/live mode/);

    const duplicate = liveResearch();
    duplicate.ranking.selected[4] = { ...duplicate.ranking.selected[4], providerId: duplicate.ranking.selected[0].providerId };
    expect(() => validateLiveResearch(duplicate, "research.json")).toThrow(/duplicate provider/);

    const badRank = liveResearch();
    badRank.ranking.selected[4].topFiveRank = 4;
    expect(() => validateLiveResearch(badRank, "research.json")).toThrow(/ranks 1 through 5/);

    const blocked = liveResearch();
    blocked.ranking.warnings = ["Blocking: incomplete"];
    expect(() => validateLiveResearch(blocked, "research.json")).toThrow(/blocking warning/);

    const aggregator = liveResearch();
    aggregator.ranking.selected[0].sources.push({
      url: "https://www.nerdwallet.com/insurance/auto",
      officialSource: true,
      sourceKind: "provider",
    });
    expect(() => validateLiveResearch(aggregator, "research.json")).toThrow(/allowlisted/);
  });

  it("requires one correctly attributed synthetic and normalized quote per live provider", () => {
    const { providerIds } = validateLiveResearch(liveResearch(), "research.json");
    const synthetic = syntheticBatch(providerIds);
    const normalized = normalizedBatch(providerIds);

    expect(validateSyntheticBatch(synthetic, request, providerIds, "synthetic.json")).toHaveLength(5);
    expect(validateNormalizedBatch(normalized, request, providerIds, "normalized.json")).toHaveLength(5);

    synthetic.quotes[0].sourceType = "conversation";
    expect(() => validateSyntheticBatch(synthetic, request, providerIds, "synthetic.json")).toThrow(/provenance/);
    normalized.quotes[0].requiresHumanVerification = false;
    expect(() => validateNormalizedBatch(normalized, request, providerIds, "normalized.json")).toThrow(/human-verification/);
  });

  it("requires the Person 3 target to match the workflow, provider set, and normalized quotes", () => {
    const { providerIds } = validateLiveResearch(liveResearch(), "research.json");
    const normalized = normalizedBatch(providerIds);
    const targetProviderId = normalized.quotes[0].providerId;
    const recommendation = {
      negotiationHandoff: {
        workflowId: request.workflowId,
        specificationHash: request.specificationHash,
        selectionSource: "system_recommendation",
        target: {
          providerId: targetProviderId,
          quoteId: "quote-1",
          effectiveComparisonCostCents: 222_000,
          simulated: true,
          requiresHumanVerification: true,
          disclaimer: "Simulated quote; not supplied by the insurer and not binding.",
        },
      },
    };

    expect(
      validatePerson3Handoff(
        recommendation,
        request,
        providerIds,
        new Set(normalized.quotes.map((quote) => quote.quoteId)),
        "recommendation.json",
      ).target.providerId,
    ).toBe(targetProviderId);

    recommendation.negotiationHandoff.target.providerId = "web-nerdwallet-com";
    expect(() =>
      validatePerson3Handoff(
        recommendation,
        request,
        providerIds,
        new Set(normalized.quotes.map((quote) => quote.quoteId)),
        "recommendation.json",
      ),
    ).toThrow(/valid Person 3 target/);
  });
});
