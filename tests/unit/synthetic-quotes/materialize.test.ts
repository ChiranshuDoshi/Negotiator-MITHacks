import { describe, expect, it } from "vitest";

import { normalizeQuote } from "@/domain/normalization";
import { SyntheticQuoteBatchSchema } from "@/domain/schemas/person4";
import {
  PERSONAL_AUTO_QUOTE_CATALOG,
  generateSyntheticQuoteBatch,
  parseSyntheticQuoteCatalog,
} from "@/domain/synthetic-quotes";

import { makeGenerationInput } from "./factories";

describe("synthetic quote catalog", () => {
  it("accepts the editable personal-auto catalog", () => {
    expect(parseSyntheticQuoteCatalog(PERSONAL_AUTO_QUOTE_CATALOG).scenarios).toHaveLength(5);
  });

  it("rejects non-strict roots, wrong scenario counts, and duplicate scenarios", () => {
    expect(() =>
      parseSyntheticQuoteCatalog({ ...PERSONAL_AUTO_QUOTE_CATALOG, unexpected: true }),
    ).toThrow();
    expect(() =>
      parseSyntheticQuoteCatalog({
        ...PERSONAL_AUTO_QUOTE_CATALOG,
        scenarios: PERSONAL_AUTO_QUOTE_CATALOG.scenarios.slice(0, 4),
      }),
    ).toThrow();

    const duplicateCatalog = structuredClone(PERSONAL_AUTO_QUOTE_CATALOG);
    duplicateCatalog.scenarios[4].scenarioId = duplicateCatalog.scenarios[0].scenarioId;
    expect(() => parseSyntheticQuoteCatalog(duplicateCatalog)).toThrow(/unique/u);
  });
});

describe("synthetic quote materialization", () => {
  it("rejects ranking/request mismatches, non-five selections, duplicate providers, and invalid ranks", () => {
    const mismatchCases = [
      ["workflowId", "other-workflow"],
      ["quoteRequestId", "other-request"],
      ["specificationHash", "c".repeat(64)],
    ] as const;

    for (const [field, value] of mismatchCases) {
      const input = makeGenerationInput();
      input.providerRanking[field] = value;
      expect(() => generateSyntheticQuoteBatch(input)).toThrow(/must match quote request/u);
    }

    const tooFew = makeGenerationInput();
    tooFew.providerRanking.selected.pop();
    expect(() => generateSyntheticQuoteBatch(tooFew)).toThrow(/exactly five/u);

    const duplicate = makeGenerationInput();
    duplicate.providerRanking.selected[4].providerId = duplicate.providerRanking.selected[0].providerId;
    expect(() => generateSyntheticQuoteBatch(duplicate)).toThrow(/unique/u);

    const invalidRanks = makeGenerationInput();
    invalidRanks.providerRanking.selected[4].topFiveRank = 4;
    expect(() => generateSyntheticQuoteBatch(invalidRanks)).toThrow(/ranks 1 through 5/u);
  });

  it("maps scenario order to provider rank deterministically, independent of selected-array order", () => {
    const input = makeGenerationInput();
    const expectedProviders = [...input.providerRanking.selected]
      .sort((left, right) => (left.topFiveRank ?? 0) - (right.topFiveRank ?? 0))
      .map(({ providerId }) => providerId);
    input.providerRanking.selected.reverse();

    const first = generateSyntheticQuoteBatch(input);
    const second = generateSyntheticQuoteBatch(structuredClone(input));

    expect(first.quotes.map(({ providerId }) => providerId)).toEqual(expectedProviders);
    expect(first.quotes.map(({ scenarioId }) => scenarioId)).toEqual(
      PERSONAL_AUTO_QUOTE_CATALOG.scenarios.map(({ scenarioId }) => scenarioId),
    );
    expect(new Set(first.quotes.map(({ scenarioId }) => scenarioId))).toHaveLength(5);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("replaces provider identity while preserving the rank-assigned scenario", () => {
    const originalInput = makeGenerationInput();
    const replacementInput = structuredClone(originalInput);
    const rankOne = replacementInput.providerRanking.selected.find(({ topFiveRank }) => topFiveRank === 1);
    if (!rankOne) throw new Error("Expected a rank-one provider fixture");
    rankOne.providerId = "replacement-carrier";
    rankOne.providerName = "Replacement Carrier";
    rankOne.canonicalCarrierId = "replacement-carrier";

    const original = generateSyntheticQuoteBatch(originalInput).quotes[0];
    const replacement = generateSyntheticQuoteBatch(replacementInput).quotes[0];

    expect(replacement.scenarioId).toBe(original.scenarioId);
    expect(replacement.providerId).toBe("replacement-carrier");
    expect(replacement.quoteId).toContain("replacement-carrier");
    expect(replacement.sourceArtifactId).toContain("replacement-carrier");
  });

  it("emits schema-valid provenance, disclaimer, and non-provider fixture evidence for every reference", () => {
    const batch = generateSyntheticQuoteBatch(makeGenerationInput());

    expect(SyntheticQuoteBatchSchema.parse(batch)).toEqual(batch);
    expect(batch.quotes).toHaveLength(5);
    for (const quote of batch.quotes) {
      expect(quote).toMatchObject({
        sourceType: "synthetic_dataset",
        sourceConversationId: null,
        simulated: true,
        quoteType: "simulated",
        currency: PERSONAL_AUTO_QUOTE_CATALOG.currency,
        disclaimer: PERSONAL_AUTO_QUOTE_CATALOG.disclaimer,
      });
      expect(quote.sourceArtifactId).toContain(quote.scenarioId);
      expect(quote.evidence.every(({ type }) => type === "demo_fixture")).toBe(true);
      expect(quote.evidence.every(({ verificationStatus }) => verificationStatus === "not_applicable")).toBe(true);
      expect(quote.evidence.some(({ verificationStatus }) => verificationStatus === "provider_confirmed")).toBe(
        false,
      );
      expect(quote.evidence.every(({ sourceId }) => sourceId === quote.sourceArtifactId)).toBe(true);
      expect(quote.evidence.every(({ url }) => url === null)).toBe(true);

      const evidenceIds = new Set(quote.evidence.map(({ id }) => id));
      const referencedEvidenceIds = [
        ...quote.premiumComponents.map(({ evidenceId }) => evidenceId),
        ...quote.feeComponents.map(({ evidenceId }) => evidenceId),
        ...quote.taxComponents.map(({ evidenceId }) => evidenceId),
        ...quote.discounts.map(({ evidenceId }) => evidenceId),
        ...quote.coverageItems.flatMap(({ evidenceIds: coverageEvidenceIds }) => coverageEvidenceIds),
      ];
      expect(referencedEvidenceIds.every((id) => evidenceIds.has(id))).toBe(true);
      expect(new Set(quote.evidence.map(({ id }) => id)).size).toBe(quote.evidence.length);
    }

    const input = makeGenerationInput();
    for (const quote of batch.quotes) {
      const normalized = normalizeQuote(quote, input.quoteRequest);
      expect(normalized.effectiveComparisonCostCents).not.toBeNull();
      expect(normalized.requiresHumanVerification).toBe(true);
    }
  });

  it("uses requested coverage as the baseline, applies scenario overrides, and derives policy dates", () => {
    const batch = generateSyntheticQuoteBatch(makeGenerationInput());
    const baseline = batch.quotes[0];
    const stronger = batch.quotes.find(({ scenarioId }) => scenarioId === "stronger-coverage");
    const incomplete = batch.quotes.find(({ scenarioId }) => scenarioId === "underwriting-pending");
    if (!stronger || !incomplete) throw new Error("Expected stronger and incomplete scenario fixtures");

    expect(baseline.coveredEntityIds).toEqual(["driver-1", "vehicle-1"]);
    expect(baseline.coverageItems.find(({ coverageCode }) => coverageCode === "collision")).toMatchObject({
      insuredEntityIds: ["vehicle-1"],
      deductibleCents: 100_000,
      included: true,
    });
    expect(stronger.coverageItems.find(({ coverageCode }) => coverageCode === "bodily_injury_liability")).toMatchObject(
      { limitCents: 25_000_000 },
    );
    expect(stronger.coverageItems.find(({ coverageCode }) => coverageCode === "collision")).toMatchObject({
      deductibleCents: 50_000,
    });
    expect(incomplete.coverageItems.find(({ coverageCode }) => coverageCode === "comprehensive")).toMatchObject({
      included: false,
      exclusions: ["Comprehensive coverage not confirmed"],
    });

    expect(stronger.effectiveDate).toBe("2026-08-31");
    expect(stronger.expirationDate).toBe("2027-08-31");
    expect(stronger.quoteValidUntil).toBe("2026-09-01T16:00:00.000Z");
    expect(incomplete.expirationDate).toBeNull();
    expect(incomplete.quoteValidUntil).toBeNull();
    expect(stronger.conditions).toContain("Quote valid for 45 days.");
    expect(incomplete.conditions.some((condition) => condition.startsWith("Quote valid for"))).toBe(false);
  });
});
