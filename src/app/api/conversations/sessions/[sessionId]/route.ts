import { z } from "zod";

import { jsonError, jsonSuccess, readJsonBody } from "@/app/api/_lib/http";
import { conversationSessions } from "@/server/services/conversations";

import { requireLocalDemoRequest, toConversationHttpError } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("activate"), conversationId: z.string().min(1).max(256) }),
  z.strictObject({
    action: z.literal("transcript"),
    role: z.enum(["user", "agent"]),
    message: z.string().min(1).max(4_000),
  }),
  z.strictObject({ action: z.literal("processing") }),
  z.strictObject({ action: z.literal("complete") }),
  z.strictObject({ action: z.literal("cancel") }),
  z.strictObject({ action: z.literal("fail"), errorCode: z.string().min(1).max(128) }),
  z.strictObject({ action: z.literal("retry") }),
]);

interface RouteContext {
  readonly params: Promise<{ sessionId: string }>;
}

export async function handleSessionPatch(
  request: Request,
  context: RouteContext,
  sessions: typeof conversationSessions,
): Promise<Response> {
  try {
    requireLocalDemoRequest(request);
    const { sessionId } = await context.params;
    const body = ActionSchema.parse(await readJsonBody(request));
    const session = (() => {
      switch (body.action) {
        case "activate": return sessions.activate(sessionId, body.conversationId);
        case "transcript": return sessions.appendTranscript(sessionId, body);
        case "processing": return sessions.beginProcessing(sessionId);
        case "complete": return sessions.complete(sessionId);
        case "cancel": return sessions.cancel(sessionId);
        case "fail": return sessions.fail(sessionId, body.errorCode);
        case "retry": return sessions.retry(sessionId);
      }
    })();
    return jsonSuccess({ session });
  } catch (error) {
    return jsonError(toConversationHttpError(error));
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return handleSessionPatch(request, context, conversationSessions);
}
