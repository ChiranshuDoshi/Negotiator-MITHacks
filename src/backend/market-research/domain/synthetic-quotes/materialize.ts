import { z } from "zod";

import {
  SyntheticQuoteBatchSchema,
  SyntheticQuoteGenerationInputSchema,
  SyntheticRawQuoteOutcomeSchema,
  type SyntheticQuoteBatch,
  type SyntheticQuoteScenario,
} from "@/domain/schemas/person4";

import {
  PERSONAL_AUTO_QUOTE_CATALOG,
  parseSyntheticQuoteCatalog,
  type SyntheticQuoteCatalog,
} from "./catalog";

const REQUIRED_SELECTED_PROVIDER_COUNT = 5;
const MILLISECONDS_PER_DAY = 86_400_000;

type SyntheticQuoteGenerationInput = z.infer<typeof SyntheticQuoteGenerationInputSchema>;
type SyntheticRawQuoteOutcome = z.infer<typeof SyntheticRawQuoteOutcomeSchema>;
type CostComponent = SyntheticRawQuoteOutcome["premiumComponents"][number];
type CoverageItem = SyntheticRawQuoteOutcome["coverageItems"][number];
type Evidence = SyntheticRawQuoteOutcome["evidence"][number];
type SelectedProvider = SyntheticQuoteGenerationInput["providerRanking"]["selected"][number];

const ValidatedSyntheticQuoteGenerationInputSchema = SyntheticQuoteGenerationInputSchema.superRefine(
  ({ quoteRequest, providerRanking }, context) => {
    const matches: Array<[boolean, string, string]> = [
      [providerRanking.workflowId === quoteRequest.workflowId, "workflowId", "Ranking workflow must match quote request"],
      [providerRanking.quoteRequestId === quoteRequest.id, "quoteRequestId", "Ranking request must match quote request"],
      [
        providerRanking.specificationHash === quoteRequest.specificationHash,
        "specificationHash",
        "Ranking specification hash must match quote request",
      ],
    ];

    for (const [matchesRequest, field, message] of matches) {
      if (!matchesRequest) {
        context.addIssue({ code: "custom", path: ["providerRanking", field], message });
      }
    }

    const selected = providerRanking.selected;
    if (selected.length !== REQUIRED_SELECTED_PROVIDER_COUNT) {
      context.addIssue({
        code: "custom",
        path: ["providerRanking", "selected"],
        message: "Ranking must contain exactly five selected providers",
      });
    }

    const providerIds = selected.map(({ providerId }) => providerId);
    if (new Set(providerIds).size !== providerIds.length) {
      context.addIssue({
        code: "custom",
        path: ["providerRanking", "selected"],
        message: "Selected provider IDs must be unique",
      });
    }

    const sortedRanks = selected
      .map(({ topFiveRank }) => topFiveRank)
      .filter((rank): rank is number => rank !== null)
      .sort((left, right) => left - right);
    const hasRanksOneThroughFive =
      sortedRanks.length === REQUIRED_SELECTED_PROVIDER_COUNT &&
      sortedRanks.every((rank, index) => rank === index + 1);
    if (!hasRanksOneThroughFive) {
      context.addIssue({
        code: "custom",
        path: ["providerRanking", "selected"],
        message: "Selected providers must have unique Top Five ranks 1 through 5",
      });
    }
  },
);

function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const targetMonthStart = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  return new Date(
    Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth(), targetDay),
  )
    .toISOString()
    .slice(0, 10);
}

function addDays(timestamp: string, days: number): string {
  return new Date(new Date(timestamp).getTime() + days * MILLISECONDS_PER_DAY).toISOString();
}

function displayCoverageName(coverageCode: string): string {
  return coverageCode
    .split(/[_-]+/u)
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function applyCoverageOverrides(
  input: SyntheticQuoteGenerationInput,
  scenario: SyntheticQuoteScenario,
): Array<Omit<CoverageItem, "evidenceIds">> {
  const coverageByCode = new Map<string, Omit<CoverageItem, "evidenceIds">>();

  for (const requested of input.quoteRequest.requestedCoverage) {
    coverageByCode.set(requested.coverageCode, {
      coverageCode: requested.coverageCode,
      coverageName: displayCoverageName(requested.coverageCode),
      insuredEntityIds: [...requested.insuredEntityIds],
      limitCents: requested.minimumLimitCents,
      deductibleCents: requested.maximumDeductibleCents,
      included: true,
      exclusions: [],
    });
  }

  for (const override of scenario.coverageOverrides) {
    const baseline = coverageByCode.get(override.coverageCode) ?? {
      coverageCode: override.coverageCode,
      coverageName: displayCoverageName(override.coverageCode),
      insuredEntityIds: [...input.quoteRequest.insuredEntityIds],
      limitCents: null,
      deductibleCents: null,
      included: true,
      exclusions: [],
    };
    coverageByCode.set(override.coverageCode, {
      ...baseline,
      limitCents: Object.hasOwn(override, "limitCents") ? (override.limitCents ?? null) : baseline.limitCents,
      deductibleCents: Object.hasOwn(override, "deductibleCents")
        ? (override.deductibleCents ?? null)
        : baseline.deductibleCents,
      included: override.included ?? baseline.included,
      exclusions: [...override.exclusions],
    });
  }

  return [...coverageByCode.values()];
}

function buildEvidence(
  input: SyntheticQuoteGenerationInput,
  provider: SelectedProvider,
  artifactId: string,
  evidenceId: string,
  claimKey: string,
  claimValue: unknown,
  scenario: SyntheticQuoteScenario,
): Evidence {
  return {
    id: evidenceId,
    workflowId: input.quoteRequest.workflowId,
    type: "demo_fixture",
    sourceId: artifactId,
    claimKey,
    claimValue,
    pageNumber: null,
    transcriptStartMs: null,
    transcriptEndMs: null,
    speaker: null,
    excerpt: `${scenario.displayName} materialized for ${provider.providerName}.`,
    url: null,
    retrievedAt: input.generatedAt,
    confidence: 1,
    verificationStatus: "not_applicable",
  };
}

function buildCostComponent(
  evidenceId: string,
  category: string,
  label: string,
  amountCents: number,
): CostComponent {
  return {
    category,
    label,
    amountCents,
    frequency: "policy_term",
    termCount: 1,
    required: true,
    conditional: false,
    refundable: false,
    includedInQuotedTotal: false,
    evidenceId,
  };
}

function materializeQuote(
  input: SyntheticQuoteGenerationInput,
  catalog: SyntheticQuoteCatalog,
  provider: SelectedProvider,
  scenario: SyntheticQuoteScenario,
  rank: number,
): SyntheticRawQuoteOutcome {
  const quoteId = `${input.quoteRequest.id}:synthetic:${rank}:${scenario.scenarioId}:${provider.providerId}`;
  const artifactId = `${catalog.datasetVersion}:artifact:${input.quoteRequest.id}:${scenario.scenarioId}:${provider.providerId}`;
  const evidencePrefix = `${quoteId}:evidence`;
  const premiumEvidenceId = `${evidencePrefix}:premium`;
  const feeEvidenceId = `${evidencePrefix}:fee`;
  const taxEvidenceId = `${evidencePrefix}:tax`;
  const downPaymentEvidenceId = `${evidencePrefix}:down-payment`;

  const premiumComponents = [
    buildCostComponent(premiumEvidenceId, "premium", "Policy-term base premium", scenario.basePremiumCents),
  ];
  const feeComponents = [
    buildCostComponent(feeEvidenceId, "fee", "Required policy fee", scenario.requiredFeeCents),
  ];
  const taxComponents = [
    buildCostComponent(taxEvidenceId, "tax", "Required policy tax", scenario.requiredTaxCents),
  ];
  const discounts = scenario.discounts.map((discount, index) => ({
    ...discount,
    conditions: [...discount.conditions],
    evidenceId: `${evidencePrefix}:discount:${index + 1}`,
  }));
  const coverageItems = applyCoverageOverrides(input, scenario).map((coverage, index) => ({
    ...coverage,
    insuredEntityIds: [...coverage.insuredEntityIds],
    exclusions: [...coverage.exclusions],
    evidenceIds: [`${evidencePrefix}:coverage:${index + 1}`],
  }));

  const evidence: Evidence[] = [
    buildEvidence(
      input,
      provider,
      artifactId,
      premiumEvidenceId,
      "quote.premiumComponents.0.amountCents",
      scenario.basePremiumCents,
      scenario,
    ),
    buildEvidence(
      input,
      provider,
      artifactId,
      feeEvidenceId,
      "quote.feeComponents.0.amountCents",
      scenario.requiredFeeCents,
      scenario,
    ),
    buildEvidence(
      input,
      provider,
      artifactId,
      taxEvidenceId,
      "quote.taxComponents.0.amountCents",
      scenario.requiredTaxCents,
      scenario,
    ),
    buildEvidence(
      input,
      provider,
      artifactId,
      downPaymentEvidenceId,
      "quote.downPaymentCents",
      scenario.downPaymentCents,
      scenario,
    ),
    ...discounts.map((discount, index) =>
      buildEvidence(
        input,
        provider,
        artifactId,
        discount.evidenceId,
        `quote.discounts.${index}.amountCents`,
        discount.amountCents,
        scenario,
      ),
    ),
    ...coverageItems.map((coverage, index) =>
      buildEvidence(
        input,
        provider,
        artifactId,
        coverage.evidenceIds[0],
        `quote.coverageItems.${index}`,
        {
          coverageCode: coverage.coverageCode,
          insuredEntityIds: coverage.insuredEntityIds,
          limitCents: coverage.limitCents,
          deductibleCents: coverage.deductibleCents,
          included: coverage.included,
          exclusions: coverage.exclusions,
        },
        scenario,
      ),
    ),
  ];

  const quoteValidityCondition =
    scenario.expirationDays === null ? [] : [`Quote valid for ${scenario.expirationDays} days.`];

  return SyntheticRawQuoteOutcomeSchema.parse({
    quoteId,
    workflowId: input.quoteRequest.workflowId,
    providerId: provider.providerId,
    sourceType: "synthetic_dataset",
    sourceConversationId: null,
    sourceArtifactId: artifactId,
    scenarioId: scenario.scenarioId,
    confirmedRequestId: input.quoteRequest.id,
    specificationHash: input.quoteRequest.specificationHash,
    status: scenario.outcomeStatus,
    quoteType: "simulated",
    effectiveDate: input.quoteRequest.desiredEffectiveDate,
    expirationDate:
      scenario.outcomeStatus === "incomplete"
        ? null
        : addMonths(input.quoteRequest.desiredEffectiveDate, scenario.policyTermMonths),
    quoteValidUntil:
      scenario.expirationDays === null ? null : addDays(input.generatedAt, scenario.expirationDays),
    policyTermMonths: scenario.policyTermMonths,
    premiumComponents,
    feeComponents,
    taxComponents,
    discounts,
    coverageItems,
    coveredEntityIds: [...input.quoteRequest.insuredEntityIds],
    downPaymentCents: scenario.downPaymentCents,
    paymentOptions: [...scenario.paymentOptions],
    exclusions: [...new Set(coverageItems.flatMap(({ exclusions }) => exclusions))],
    conditions: [...scenario.conditions, ...quoteValidityCondition],
    evidence,
    currency: catalog.currency,
    disclaimer: catalog.disclaimer,
    simulated: true,
  });
}

export function generateSyntheticQuoteBatch(
  input: unknown,
  catalogInput: unknown = PERSONAL_AUTO_QUOTE_CATALOG,
): SyntheticQuoteBatch {
  const validatedInput = ValidatedSyntheticQuoteGenerationInputSchema.parse(input);
  const catalog = parseSyntheticQuoteCatalog(catalogInput);
  const selectedByRank = [...validatedInput.providerRanking.selected].sort(
    (left, right) => (left.topFiveRank ?? 0) - (right.topFiveRank ?? 0),
  );

  return SyntheticQuoteBatchSchema.parse({
    workflowId: validatedInput.quoteRequest.workflowId,
    quoteRequestId: validatedInput.quoteRequest.id,
    specificationHash: validatedInput.quoteRequest.specificationHash,
    generatedAt: validatedInput.generatedAt,
    datasetVersion: catalog.datasetVersion,
    quotes: catalog.scenarios.map((scenario, index) =>
      materializeQuote(validatedInput, catalog, selectedByRank[index], scenario, index + 1),
    ),
    disclaimer: catalog.disclaimer,
  });
}
