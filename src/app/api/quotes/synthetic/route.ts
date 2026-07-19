import { jsonError, jsonSuccess, readJsonBody } from "@/app/api/_lib/http";
import { requireInternalAuthorization } from "@/app/api/_lib/security";
import { SyntheticQuoteGenerationInputSchema } from "@/domain/schemas/person4";
import { generateSyntheticQuoteBatch } from "@/domain/synthetic-quotes/materialize";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    requireInternalAuthorization(request);
    const input = SyntheticQuoteGenerationInputSchema.parse(await readJsonBody(request));
    return jsonSuccess(generateSyntheticQuoteBatch(input));
  } catch (error) {
    return jsonError(error);
  }
}
