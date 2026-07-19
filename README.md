# PolicyScout — Person 4 Intelligence and Person 3 Voice Demo

This branch implements PolicyScout's Person 4 market research, voice quote collection, coverage-equivalence, and recommendation handoff slice.

It also includes Person 3's ElevenLabs voice harness and bounded negotiation demo. Person 3 consumes the validated Person 4 handoff; it does not reimplement provider research, quote normalization, recommendations, or negotiation-event validation.

The research service accepts a provider-safe confirmed quote request and searches for auto-insurance providers using the user's state, ZIP code, requested coverage, and exclusions. It ranks eligible providers from cited public evidence. Public web prices, averages, and marketing claims are never treated as personalized quotes.

For the hackathon demo, a separate Calling Agent gathers one simulated, transcript-backed quote from a human acting as each current Top Five provider. It receives a provider-safe profile brief, requests an all-in policy-term quote, and closes once the quote is recorded. After all five valid calls, PolicyScout selects the lowest comparable all-in price and automatically prepares that company for the later Negotiator call. These demo quotes are non-binding and cannot be used as competing-offer leverage.

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

## Prepare voice quote collection

Run research first and save its response as `research.json`. Then prepare the five-provider collection from the fake profile:

```bash
corepack pnpm prepare:elevenlabs:quote-collection -- \
  --profile tests/fixtures/fake_person_profile.json \
  --research .artifacts/person4/<run-time>/research.json \
  --artifact-dir .artifacts/person4/<run-time>
```

By default, the command writes a private local session file, generates five deterministic simulated provider conversations, and writes `conversations.json`, `raw-quotes.json`, `normalized-quotes.json`, `recommendation.json`, and `person3-handoff.json` to the supplied artifact directory. These transcripts are dashboard-ready demo data; the quote and handoff remain simulated, non-binding, and ineligible for competing-offer leverage.

Use `--interactive` when you want the existing microphone path instead. With `DEMO_MODE=true`, open `/dev/elevenlabs`, choose **Quote collection**, paste a printed reference, and start each browser-microphone call. The Calling Agent supplies the provider-safe profile facts, captures an all-in price, term, fee/tax confirmation, requested-coverage confirmation, effective date, and quote-valid-until date, then stops.

## Main APIs

- `POST /api/research/run` — run mock or live provider research and deterministic Top Five ranking.
- `POST /api/quotes/normalize` — normalize one or more structured quote outcomes and add comparable-median red flags.
- `POST /api/conversations/credentials` — issue local demo credentials for voice smoke, quote collection, or negotiation.
- `POST /api/conversations/collections/:collectionId` — return the local quote-collection status and final recommendation.
- `POST /api/negotiations/validate-goal` — verify the selected quote/provider and emit a disclosure-safe negotiator view.
- `POST /api/negotiations/leverage` — choose truthful, same-request competing leverage.
- `POST /api/negotiations/validate-event` — validate before/after evidence and derive an immutable effective offer.
- `POST /api/recommendations` — rank qualifying offers and emit the automatic, evidence-backed Person 3 negotiation handoff.

All request bodies are size-bounded and validated with strict Zod schemas. Route responses are non-cacheable. Trusted routes currently require `Authorization: Bearer $POLICYSCOUT_INTERNAL_API_KEY`; Person 2 must replace this temporary server-to-server guard with authenticated workflow ownership, server-loaded evidence, persistence, and private-goal decryption during integration.

## Demo workflow

1. Submit the confirmed, provider-safe request to `/api/research/run` and retain the Top Five research artifact.
2. Prepare the quote collection. It generates five simulated calls by default; add `--interactive` to complete one local microphone call for each provider in `/dev/elevenlabs` instead.
3. The collection validates and normalizes the five transcript-backed outcomes, ranks them by lowest valid all-in policy-term cost, and writes the handoff artifacts.
4. Run the existing Negotiator preparation command with the generated `person3-handoff.json` when a later negotiation target is available.

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
