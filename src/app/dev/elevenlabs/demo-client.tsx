"use client";

import { useState } from "react";
import { ConversationProvider } from "@elevenlabs/react";

import {
  useDemoConversation,
  type DemoConversationRequest,
  type NegotiationReference,
} from "@/integrations/elevenlabs/use-demo-conversation";

type Purpose = DemoConversationRequest["purpose"];

const NEGOTIATION_REFERENCE_KEYS = [
  "providerId",
  "quoteId",
  "selectedAt",
  "specificationHash",
  "workflowId",
] as const;
const SPECIFICATION_HASH_PATTERN = /^[a-f0-9]{64}$/;
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNegotiationReference(text: string): NegotiationReference {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Negotiation reference must be valid JSON.");
  }
  if (!isRecord(value)) throw new Error("Negotiation reference must be a JSON object.");
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== NEGOTIATION_REFERENCE_KEYS.join(",")) {
    throw new Error(`Negotiation reference must contain exactly ${NEGOTIATION_REFERENCE_KEYS.join(", ")}.`);
  }
  for (const key of NEGOTIATION_REFERENCE_KEYS) {
    if (typeof value[key] !== "string" || value[key].trim() === "") {
      throw new Error(`${key} must be a non-empty string.`);
    }
  }
  if (!SPECIFICATION_HASH_PATTERN.test(value.specificationHash as string)) {
    throw new Error("specificationHash must be a 64-character lowercase hexadecimal hash.");
  }
  if (
    !ISO_DATETIME_PATTERN.test(value.selectedAt as string)
    || Number.isNaN(Date.parse(value.selectedAt as string))
  ) {
    throw new Error("selectedAt must be a valid UTC date-time string.");
  }
  return value as unknown as NegotiationReference;
}

function DemoControls() {
  const demo = useDemoConversation();
  const [purpose, setPurpose] = useState<Purpose>("voice_smoke");
  const [negotiationJson, setNegotiationJson] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const start = async () => {
    setInputError(null);
    try {
      const request: DemoConversationRequest = purpose === "voice_smoke"
        ? { purpose }
        : { purpose, negotiationReference: parseNegotiationReference(negotiationJson) };
      await demo.start(request);
    } catch (cause) {
      setInputError(cause instanceof Error ? cause.message : "Negotiation input is invalid.");
    }
  };

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "3rem auto", padding: "0 1rem" }}>
      <h1>ElevenLabs conversation harness</h1>
      <p>This local demo requests temporary credentials from the server and uses your microphone.</p>

      <fieldset disabled={!demo.canStart}>
        <legend>Conversation path</legend>
        <label style={{ marginRight: "1rem" }}>
          <input
            type="radio"
            name="purpose"
            value="voice_smoke"
            checked={purpose === "voice_smoke"}
            onChange={() => setPurpose("voice_smoke")}
          /> Voice smoke
        </label>
        <label>
          <input
            type="radio"
            name="purpose"
            value="negotiation"
            checked={purpose === "negotiation"}
            onChange={() => setPurpose("negotiation")}
          /> Negotiation
        </label>
      </fieldset>

      {purpose === "negotiation" ? (
        <p>
          <label htmlFor="negotiation-json">
            Settled negotiation reference JSON: workflowId, providerId, quoteId, specificationHash, selectedAt
          </label>
          <textarea
            id="negotiation-json"
            value={negotiationJson}
            onChange={(event) => setNegotiationJson(event.target.value)}
            rows={8}
            spellCheck={false}
            disabled={!demo.canStart}
            aria-describedby={inputError ? "negotiation-input-error" : undefined}
            style={{ display: "block", boxSizing: "border-box", width: "100%", marginTop: "0.5rem" }}
          />
        </p>
      ) : null}

      <p role="status" aria-live="polite" data-testid="runtime-state">
        {demo.state} · {demo.sdkStatus} · {demo.mode}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <button type="button" onClick={() => void start()} disabled={!demo.canStart}>Start conversation</button>
        <button type="button" onClick={demo.end} disabled={!demo.canEnd}>End conversation</button>
      </div>
      {inputError ? <p id="negotiation-input-error" role="alert">{inputError}</p> : null}
      {demo.error ? <p role="alert">{demo.error}</p> : null}
      <section aria-labelledby="transcript-heading">
        <h2 id="transcript-heading">Transcript</h2>
        {demo.transcript.length === 0 ? <p>No messages yet.</p> : (
          <ol>
            {demo.transcript.map((entry, index) => (
              <li key={`${entry.recordedAt}-${index}`}><strong>{entry.role}:</strong> {entry.message}</li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

export function ElevenLabsDemoClient() {
  return <ConversationProvider><DemoControls /></ConversationProvider>;
}
