import { z } from "zod";

import personalAutoScenarios from "@/demo/quotes/personal-auto-scenarios.json";
import { SyntheticQuoteScenarioSchema } from "@/domain/schemas/person4";

export const SyntheticQuoteCatalogSchema = z
  .strictObject({
    datasetVersion: z.string().min(1),
    currency: z.string().length(3),
    disclaimer: z.string().min(1),
    scenarios: z.array(SyntheticQuoteScenarioSchema).length(5),
  })
  .superRefine(({ scenarios }, context) => {
    const scenarioIds = scenarios.map(({ scenarioId }) => scenarioId);
    if (new Set(scenarioIds).size !== scenarioIds.length) {
      context.addIssue({
        code: "custom",
        path: ["scenarios"],
        message: "Scenario IDs must be unique",
      });
    }
  });

export type SyntheticQuoteCatalog = z.infer<typeof SyntheticQuoteCatalogSchema>;

export function parseSyntheticQuoteCatalog(input: unknown): SyntheticQuoteCatalog {
  return SyntheticQuoteCatalogSchema.parse(input);
}

export const PERSONAL_AUTO_QUOTE_CATALOG = parseSyntheticQuoteCatalog(personalAutoScenarios);
