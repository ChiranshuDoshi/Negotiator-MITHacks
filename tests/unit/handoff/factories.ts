import { buildRecommendation } from "@/domain/recommendation";
import { rankProviders } from "@/domain/research";
import type {
  Evidence,
  NormalizedQuote,
  ProviderRankingResult,
  Recommendation,
} from "@/domain/schemas/person4";

import { createEvidence, createQuote, SPECIFICATION_HASH } from "../recommendation/factories";
import { makeCandidate, makeQuoteRequest } from "../research/factories";

export const GENERATED_AT = new Date("2026-07-18T12:00:00.000Z");
export const QUOTE_VALID_UNTIL = "2026-08-17T12:00:00.000Z";
export const SYNTHETIC_SOURCE_ID = "synthetic-dataset-v1";
export const SYNTHETIC_DISCLAIMER =
  "This simulated quote is not supplied by the insurer and is not binding.";

export interface HandoffFixture {
  recommendation: Recommendation;
  providerRanking: ProviderRankingResult;
  quotes: NormalizedQuote[];
  evidence: Evidence[];
  generatedAt: Date;
}

export function createSyntheticQuote(overrides: Partial<NormalizedQuote> = {}): NormalizedQuote {
  return createQuote({
    sourceType: "synthetic_dataset",
    sourceConversationId: null,
    sourceArtifactId: SYNTHETIC_SOURCE_ID,
    scenarioId: "best-value",
    quoteValidUntil: QUOTE_VALID_UNTIL,
    currency: "USD",
    disclaimer: SYNTHETIC_DISCLAIMER,
    expirationDate: "2027-07-31",
    requiresHumanVerification: true,
    ...overrides,
  });
}

export function createSyntheticEvidence(id: string): Evidence {
  return createEvidence({
    id,
    type: "demo_fixture",
    sourceId: SYNTHETIC_SOURCE_ID,
    verificationStatus: "not_applicable",
  });
}

export function createProviderRanking(): ProviderRankingResult {
  return rankProviders({
    quoteRequest: makeQuoteRequest({
      id: "request-1",
      workflowId: "workflow-1",
      specificationHash: SPECIFICATION_HASH,
    }),
    candidates: [1, 2, 3, 4, 5].map((index) => makeCandidate(`provider-${index}`)),
    evaluatedAt: GENERATED_AT.toISOString(),
  });
}

export function createHandoffFixture(): HandoffFixture {
  const quotes = [
    createSyntheticQuote({
      quoteId: "quote-1",
      providerId: "provider-1",
      scenarioId: "strong-coverage",
      effectiveComparisonCostCents: 1_000,
      annualizedCostCents: 1_000,
      coverageEquivalence: { status: "better_than_requested", differences: ["Higher liability limit"] },
      evidenceIds: ["evidence-target"],
    }),
    createSyntheticQuote({
      quoteId: "quote-2",
      providerId: "provider-2",
      scenarioId: "alternative-2",
      effectiveComparisonCostCents: 1_100,
      annualizedCostCents: 1_100,
      evidenceIds: ["evidence-2"],
    }),
    createSyntheticQuote({
      quoteId: "quote-3",
      providerId: "provider-3",
      scenarioId: "alternative-3",
      effectiveComparisonCostCents: 1_200,
      annualizedCostCents: 1_200,
      evidenceIds: ["evidence-3"],
    }),
    createSyntheticQuote({
      quoteId: "quote-4",
      providerId: "provider-4",
      scenarioId: "alternative-4",
      effectiveComparisonCostCents: 1_300,
      annualizedCostCents: 1_300,
      evidenceIds: ["evidence-4"],
    }),
    createSyntheticQuote({
      quoteId: "quote-5",
      providerId: "provider-5",
      scenarioId: "alternative-5",
      effectiveComparisonCostCents: 1_400,
      annualizedCostCents: 1_400,
      evidenceIds: ["evidence-5"],
    }),
  ];
  const evidence = [
    createSyntheticEvidence("evidence-target"),
    createSyntheticEvidence("evidence-2"),
    createSyntheticEvidence("evidence-3"),
    createSyntheticEvidence("evidence-4"),
    createSyntheticEvidence("evidence-5"),
  ];
  const recommendation = buildRecommendation({
    workflowId: "workflow-1",
    specificationHash: SPECIFICATION_HASH,
    quotes,
    generatedAt: GENERATED_AT,
  });

  return {
    recommendation,
    providerRanking: createProviderRanking(),
    quotes,
    evidence,
    generatedAt: GENERATED_AT,
  };
}
