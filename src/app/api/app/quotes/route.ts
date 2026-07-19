import { collectQuotes, toClientSnapshot } from "@/backend/app/orchestrator";

import { appErrorResponse, jsonOk, requireContext } from "../_lib";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    const { account, workflow } = await requireContext();
    await collectQuotes(workflow);
    return jsonOk({ snapshot: toClientSnapshot(workflow, account) });
  } catch (error) {
    return appErrorResponse(error);
  }
}
