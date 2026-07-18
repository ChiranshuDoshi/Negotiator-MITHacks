# PolicyScout — Person 4 Intelligence Services

This branch implements PolicyScout's Person 4 market-research, synthetic quote-intelligence, coverage-equivalence, and recommendation handoff slice.

The research service accepts a provider-safe confirmed quote request and searches for auto-insurance providers using the user's state, ZIP code, requested coverage, and exclusions. It ranks eligible providers from cited public evidence. Public web prices, averages, and marketing claims are never treated as personalized quotes.

For the hackathon demo, Person 4 does not place first-round quote calls. It maps a clearly labeled synthetic quote scenario to each current Top Five provider, normalizes and compares those five outcomes, recommends the best qualifying offer, and automatically prepares that company and price for Person 3's later negotiation call. The synthetic values are not supplied by an insurer and are not binding quotes.

## Setup

```bash
corepack pnpm install
corepack pnpm dev
```

Set `TAVILY_API_KEY` only for live research. Set `POLICYSCOUT_INTERNAL_API_KEY` to a strong server-only value for trusted quote, negotiation, recommendation, and paid live-research requests. Mock research works without credentials.

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
```

The provider-safe user fixture is at `tests/fixtures/fake_person_profile.json`. Its Massachusetts location is only demo data; changing the confirmed state and ZIP drives the same nationwide search path.

## Scope

Personal auto is implemented deeply. Other insurance lines use the generic configuration extension point. Person 3's negotiation agent, real quote calls, Google Places, real insurance transactions, policy binding, and personalized prices scraped from the web are intentionally out of scope.
