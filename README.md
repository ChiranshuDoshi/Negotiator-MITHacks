# PolicyScout — Person 4 Intelligence and Person 3 Voice Demo

This branch implements PolicyScout's Person 4 market-research, synthetic quote-intelligence, coverage-equivalence, and recommendation handoff slice.

It also includes Person 3's ElevenLabs voice harness and bounded negotiation demo. Person 3 consumes the validated Person 4 handoff; it does not reimplement provider research, quote normalization, recommendations, or negotiation-event validation.

The research service accepts a provider-safe confirmed quote request and searches for auto-insurance providers using the user's state, ZIP code, requested coverage, and exclusions. It ranks eligible providers from cited public evidence. Public web prices, averages, and marketing claims are never treated as personalized quotes.

For the hackathon demo, Person 4 does not place first-round quote calls. It maps a clearly labeled synthetic quote scenario to each current Top Five provider, normalizes and compares those five outcomes, recommends the best qualifying offer, and automatically prepares that company and price for Person 3's later negotiation call. The synthetic values are not supplied by an insurer and are not binding quotes.

## Setup

```bash
corepack pnpm install
corepack pnpm dev
```

Set `TAVILY_API_KEY` only for live research. Set `POLICYSCOUT_INTERNAL_API_KEY` to a strong server-only value for trusted quote, negotiation, recommendation, and paid live-research requests. Mock research works without credentials.

## Person 3 ElevenLabs setup

Set `ELEVENLABS_API_KEY` in `.env`. The key needs **ElevenAgents: Write** and **Text to Speech: Access**. Inspect the planned configuration first, then apply it:

```bash
corepack pnpm setup:elevenlabs
corepack pnpm setup:elevenlabs -- --apply
```

The apply command writes only the resulting non-secret agent IDs to `.env.local`. The API key remains server-side. Before starting a negotiation from the backend terminal, prepare the private goal and user identity from the exact Person 4 handoff:

```bash
corepack pnpm prepare:elevenlabs:negotiation -- \
  --artifact-dir .artifacts/person4/<run-time> \
  --confirm-selection <provider-id>:<quote-id> \
  --target-cents <private-target-cents> \
  --profile tests/fixtures/fake_person_profile.json
```

Use `--user-name "Your Name"` instead of `--profile` when no profile file is available; provide exactly one identity source. The command imports only `userContext.displayName` from a profile. It writes the full goal only to `.artifacts/person3/negotiation-session.json` with private file permissions and prints a safe reference containing only workflow, provider, quote, specification hash, and selection timestamp. ElevenLabs receives the display name and safe quote context, but never the private target, range, ceiling, or local goal object. The managed negotiator's static compliance prompt still requires unchanged coverage.

The standalone smoke scripts are explicit about live calls because they may consume ElevenLabs credits:

```bash
corepack pnpm test:elevenlabs:voice -- --live
corepack pnpm test:elevenlabs:negotiation -- \
  --artifact-dir .artifacts/person4/<run-time> \
  --confirm-selection <provider-id>:<quote-id> \
  --target-cents <private-target-cents>
```

The negotiation command defaults to a deterministic, fixture-only mock that validates the Person 4 selection and handoff but is deliberately rejected by Person 4's event validator. Add `--live` to exercise ElevenLabs conversation simulation. Neither path invents a structured insurer outcome: actual offers must retain exact transcript evidence and be verified by a human before any transaction.

For an automated, backend-only interruption check, use the prepared session (or regenerate its identity with `--user-name "Your Name"`) and run:

```bash
corepack pnpm verify:elevenlabs:interruption -- --check
corepack pnpm verify:elevenlabs:interruption -- --live
```

`--check` makes no live calls or credit use; `--live` uses ElevenLabs TTS and agent credits, but no microphone or frontend. It defaults to `.artifacts/person3/negotiation-session.json`, supplies scripted 16 kHz PCM, and privately writes verification artifacts while checking a later-turn barge-in, correction memory, no opening replay, the $120 same-coverage discount, exact improved-term confirmation, and one tool call.

To speak with the negotiation agent directly from the backend terminal, install PortAudio once on macOS, validate the prepared session, then start the live microphone conversation:

```bash
brew install portaudio
chmod 600 .env .env.local
corepack pnpm talk:elevenlabs -- --check
corepack pnpm talk:elevenlabs -- --live
```

The live command uses the prepared `.artifacts/person3/negotiation-session.json`, streams the default microphone and speakers, consumes ElevenLabs credits, and ends on Ctrl-C. Use headphones for reliable interruption handling. It keeps one conversation open so the agent can use the current call's history, and it never sends the private target or range to ElevenLabs or records a negotiation result from this terminal smoke check. A teammate connecting a frontend should pass the returned safe `userDisplayName` as ElevenLabs dynamic variable `user_display_name`; no frontend is required for this backend flow.

## Native Twilio outbound calling

The outbound-call route uses ElevenLabs' native Twilio integration: ElevenLabs places the call with the Twilio number you import, so this application does not store a Twilio SID or Auth Token, operate a media relay, or expose Twilio webhooks. First add a purchased Twilio number (inbound and outbound) or a verified Twilio caller ID (outbound only) in ElevenLabs, then set the returned non-secret ID as `ELEVENLABS_TWILIO_PHONE_NUMBER_ID`.

Set `TWILIO_OUTBOUND_ALLOWED_DESTINATIONS` to a comma-separated list of consented E.164 destinations. The protected route will not place calls outside that list. For an initial personal-phone smoke test, include your mobile number there and call the route with the same number:

```bash
curl -X POST http://localhost:3000/api/twilio/outbound-call \
  -H "Authorization: Bearer $POLICYSCOUT_INTERNAL_API_KEY" \
  -H "Idempotency-Key: personal-phone-smoke-001" \
  -H "Content-Type: application/json" \
  -d '{"toNumber":"+15551234567"}'
```

The route requires `DEMO_MODE=true`, `ELEVENLABS_API_KEY`, `ELEVENLABS_NEGOTIATOR_AGENT_ID`, `ELEVENLABS_TWILIO_PHONE_NUMBER_ID`, the destination allowlist, and an `Idempotency-Key` header. It is intentionally unavailable in production. It starts a minimal agent call without negotiation context, recordings, or retries, and returns only the ElevenLabs conversation ID and Twilio Call SID. Reusing a key for the same destination returns the original outcome without dialing again; reuse it for another destination is rejected. The idempotency guard is process-local for this demo scaffold; production use requires durable request storage and an atomic claim keyed to the authenticated caller and idempotency key before enabling dialing. Automated tests use fake gateways and never place calls.

## Verify the live Person 4 flow

With both keys in `.env`, run:

```bash
corepack pnpm verify:person4
```

The verifier starts a temporary local server, requires a real Tavily-backed Top Five with official carrier sources, generates and normalizes the five fake quote scenarios, and writes the recommendation payload for Person 3. Artifacts are saved under `.artifacts/person4/<run-time>/`; `person3-handoff.json` is the final handoff. The command exits nonzero if any stage falls back to mock data, returns fewer than five providers, loses evidence, or produces an invalid handoff.

To use an already-running server, pass `--base-url http://127.0.0.1:3000`. To use another provider-safe profile, pass `--profile path/to/profile.json`.

## Main APIs

- `POST /api/research/run` — run mock or live provider research and deterministic Top Five ranking.
- `POST /api/quotes/synthetic` — map the five versioned demo quote scenarios to the current ranked providers.
- `POST /api/quotes/normalize` — normalize one or more structured quote outcomes and add comparable-median red flags.
- `POST /api/negotiations/validate-goal` — verify the selected quote/provider and emit a disclosure-safe negotiator view.
- `POST /api/negotiations/leverage` — choose truthful, same-request competing leverage.
- `POST /api/negotiations/validate-event` — validate before/after evidence and derive an immutable effective offer.
- `POST /api/recommendations` — rank qualifying offers and emit the automatic, evidence-backed Person 3 negotiation handoff.

All request bodies are size-bounded and validated with strict Zod schemas. Route responses are non-cacheable. Trusted routes currently require `Authorization: Bearer $POLICYSCOUT_INTERNAL_API_KEY`; Person 2 must replace this temporary server-to-server guard with authenticated workflow ownership, server-loaded evidence, persistence, and private-goal decryption during integration.

## Demo workflow

1. Submit the confirmed, provider-safe request to `/api/research/run` and retain its request hash, evidence, and Top Five ranking.
2. Submit that exact request and ranking to `/api/quotes/synthetic`. The endpoint rejects missing, duplicate, mismatched, or non-Top-Five provider mappings.
3. Normalize the generated outcomes with `/api/quotes/normalize`.
4. Submit the request, ranking, evidence, and normalized quotes to `/api/recommendations`. Its `negotiationHandoff.target` contains the automatically recommended company, effective price, coverage, term, quote-validity deadline, and human-verification requirement for Person 3.

The editable demo catalog is `src/demo/quotes/personal-auto-scenarios.json`. Provider identity always comes from the live ranking; only the quote scenario values come from this versioned fake dataset. There are no quote-call recordings or transcripts in this flow, and synthetic competitors are never represented as insurer-verified leverage.

## Verification

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:person3
```

The provider-safe user fixture is at `tests/fixtures/fake_person_profile.json`. Its Massachusetts location is only demo data; changing the confirmed state and ZIP drives the same nationwide search path.

## Scope

Personal auto is implemented deeply. Other insurance lines use the generic configuration extension point. Person 3 includes a local demo voice connection, safe context projection, and mock/live-simulation test paths. Production authentication and persistence, autonomous insurer calls, real quote calls, Google Places, real insurance transactions, policy binding, and personalized prices scraped from the web remain out of scope.
