import { rankProviders } from "@/domain/research";
import type {
  ConfirmedQuoteRequest,
  RawResearchCandidate,
} from "@/domain/schemas/person4";

export const GENERATED_AT = "2026-07-18T16:00:00.000Z";

function makeQuoteRequest(): ConfirmedQuoteRequest {
  return {
    id: "quote-request-synthetic",
    workflowId: "workflow-synthetic",
    version: 1,
    insuranceLines: ["auto"],
    state: "CA",
    zipCode: "94105",
    desiredEffectiveDate: "2026-08-31",
    insuredEntityIds: ["driver-1", "vehicle-1"],
    requestedCoverage: [
      {
        coverageCode: "bodily_injury_liability",
        insuredEntityIds: ["driver-1", "vehicle-1"],
        required: true,
        minimumLimitCents: 10_000_000,
        maximumDeductibleCents: null,
      },
      {
        coverageCode: "property_damage_liability",
        insuredEntityIds: ["driver-1", "vehicle-1"],
        required: true,
        minimumLimitCents: 5_000_000,
        maximumDeductibleCents: null,
      },
      {
        coverageCode: "collision",
        insuredEntityIds: ["vehicle-1"],
        required: true,
        minimumLimitCents: null,
        maximumDeductibleCents: 100_000,
      },
      {
        coverageCode: "comprehensive",
        insuredEntityIds: ["vehicle-1"],
        required: true,
        minimumLimitCents: null,
        maximumDeductibleCents: 100_000,
      },
    ],
    excludedProviderIds: [],
    matchingMode: "same_or_better",
    specificationHash: "b".repeat(64),
    confirmedAt: "2026-07-18T15:00:00.000Z",
  };
}

function makeCandidate(providerId: string, rating: number): RawResearchCandidate {
  const sourceId = `${providerId}-source`;
  return {
    providerId,
    canonicalCarrierId: providerId,
    providerName: `Carrier ${providerId}`,
    providerType: "carrier",
    insuranceLines: ["auto"],
    nationwide: true,
    states: [],
    excludedZipCodes: [],
    preliminaryCoverageCodes: [
      "bodily_injury_liability",
      "property_damage_liability",
      "collision",
      "comprehensive",
    ],
    website: `https://${providerId}.example.com`,
    publicContact: `https://${providerId}.example.com/contact`,
    rating,
    ratingScaleMaximum: 5,
    reviewCount: 1_000,
    ratingSourceId: sourceId,
    ratingObservedAt: "2026-07-01T00:00:00.000Z",
    licenseVerificationStatus: "verified",
    publicDiscounts: [],
    publicCoverageOptions: [],
    sources: [
      {
        id: sourceId,
        title: `${providerId} rating source`,
        url: `https://ratings.example.org/${providerId}`,
        domain: "ratings.example.org",
        publisher: "Ratings Example",
        retrievedAt: GENERATED_AT,
        publishedAt: "2026-07-01T00:00:00.000Z",
        excerpt: "Deterministic provider evidence for synthetic quote tests.",
        officialSource: false,
        sourceKind: "recognized_consumer",
        confidence: 1,
      },
    ],
    simulated: true,
  };
}

export function makeGenerationInput() {
  const quoteRequest = makeQuoteRequest();
  const providerRanking = rankProviders({
    quoteRequest,
    evaluatedAt: GENERATED_AT,
    candidates: [
      makeCandidate("alpha", 4.9),
      makeCandidate("bravo", 4.8),
      makeCandidate("charlie", 4.7),
      makeCandidate("delta", 4.6),
      makeCandidate("echo", 4.5),
    ],
  });

  return { quoteRequest, providerRanking, generatedAt: GENERATED_AT };
}
