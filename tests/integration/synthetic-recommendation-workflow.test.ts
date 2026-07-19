import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildNegotiationHandoff } from "@/domain/handoff";
import { normalizeQuote } from "@/domain/normalization";
import { buildRecommendation } from "@/domain/recommendation";
import { MockResearchProvider, rankResearchResult } from "@/domain/research";
import { ConfirmedQuoteRequestSchema } from "@/domain/schemas/person4";
import { generateSyntheticQuoteBatch } from "@/domain/synthetic-quotes";

const generatedAt = "2026-07-18T16:00:00.000Z";

function confirmedRequest() {
  const profile = JSON.parse(
    readFileSync(resolve(process.cwd(), "tests/fixtures/fake_person_profile.json"), "utf8"),
  ) as { confirmedQuoteRequest: unknown };
  return ConfirmedQuoteRequestSchema.parse(profile.confirmedQuoteRequest);
}

describe("dataset-only Top Five to negotiation handoff", () => {
  it("automatically hands Person 3 the best clearly labeled synthetic deal", async () => {
    const quoteRequest = confirmedRequest();
    const rawResearch = await new MockResearchProvider().research({ quoteRequest, retrievedAt: generatedAt });
    const providerRanking = rankResearchResult(quoteRequest, rawResearch, generatedAt);
    const batch = generateSyntheticQuoteBatch({ quoteRequest, providerRanking, generatedAt });
    const quotes = batch.quotes.map((quote) => normalizeQuote(quote, quoteRequest));
    const recommendation = buildRecommendation({
      workflowId: quoteRequest.workflowId,
      specificationHash: quoteRequest.specificationHash,
      insuranceLine: "auto",
      quotes,
      generatedAt: new Date(generatedAt),
    });
    const negotiationHandoff = buildNegotiationHandoff({
      recommendation,
      providerRanking,
      quotes,
      evidence: batch.quotes.flatMap((quote) => quote.evidence),
      generatedAt: new Date(generatedAt),
    });

    expect(providerRanking.selected).toHaveLength(5);
    expect(batch.quotes).toHaveLength(5);
    expect(batch.quotes.every((quote) => quote.sourceConversationId === null)).toBe(true);
    expect(batch.quotes.every((quote) => quote.sourceType === "synthetic_dataset")).toBe(true);
    expect(
      batch.quotes.flatMap((quote) => quote.evidence).every(
        (evidence) =>
          evidence.type === "demo_fixture" && evidence.verificationStatus === "not_applicable",
      ),
    ).toBe(true);
    expect(new Set(batch.quotes.map((quote) => quote.providerId))).toEqual(
      new Set(providerRanking.selected.map((provider) => provider.providerId)),
    );

    expect(negotiationHandoff.selectionSource).toBe("system_recommendation");
    expect(negotiationHandoff.target.quoteId).toBe(recommendation.recommendedQuoteId);
    expect(negotiationHandoff.target.scenarioId).toBe("best-value-complete");
    expect(negotiationHandoff.target.effectiveComparisonCostCents).toBe(222_000);
    expect(negotiationHandoff.target.providerName).toBe(providerRanking.selected[1]?.providerName);
    expect(negotiationHandoff.target.disclaimer).toContain("not supplied by the insurer");
    expect(negotiationHandoff.target.disclaimer).toContain("not binding");
    expect(negotiationHandoff.target.quoteValidUntil).toBe("2026-08-17T16:00:00.000Z");
    expect(negotiationHandoff.target.requiresHumanVerification).toBe(true);
    expect(negotiationHandoff.verifiedCompetingQuote).toBeNull();
    expect(recommendation.requiresHumanFollowUp).toBe(true);
    expect(recommendation.userSelectedNegotiationQuoteId).toBeNull();
  });
});
