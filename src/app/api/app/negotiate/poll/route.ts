import { pollNegotiation, toClientSnapshot } from "@/backend/app/orchestrator";

import { appErrorResponse, jsonOk, requireContext } from "../../_lib";

export const runtime = "nodejs";

/** Polls a live negotiation call and returns the updated workflow snapshot. */
export async function POST(): Promise<Response> {
  try {
    const { account, workflow } = await requireContext();
    await pollNegotiation(workflow);
    return jsonOk({ snapshot: toClientSnapshot(workflow, account) });
  } catch (error) {
    return appErrorResponse(error);
  }
}
