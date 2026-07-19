import { z } from "zod";

import { startNegotiationCall, toClientSnapshot } from "@/backend/app/orchestrator";

import { appErrorResponse, jsonOk, requireContext } from "../../../_lib";

export const runtime = "nodejs";

const StartCallSchema = z.object({
  targetAmountCents: z.coerce.number().int().min(0).max(100_000_000),
  selectedQuoteId: z.string().trim().min(1).max(256).optional(),
});

/** Begins an in-app voice negotiation and returns the browser voice credential. */
export async function POST(request: Request): Promise<Response> {
  try {
    const { account, workflow } = await requireContext();
    const body = StartCallSchema.parse(await request.json());
    const { credential, dynamicVariables } = await startNegotiationCall(
      workflow,
      account,
      body.targetAmountCents,
      body.selectedQuoteId,
    );
    return jsonOk({ credential, dynamicVariables, snapshot: toClientSnapshot(workflow, account) });
  } catch (error) {
    return appErrorResponse(error);
  }
}
