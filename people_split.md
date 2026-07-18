==================================================
FOUR-PERSON TEAM SPLIT
==================================================

All four engineers must agree on the shared Zod contracts, database identifiers, workflow states, and API payloads before parallel development.

Do not silently modify shared contracts after the first integration checkpoint.

--------------------------------------------------
PERSON 1: FRONTEND AND DEMO EXPERIENCE
--------------------------------------------------

Own:

- Next.js pages.
- Workflow stepper.
- Dashboard.
- Upload UI.
- Coverage-review UI.
- Intake conversation UI.
- Confirmation UI.
- Research UI.
- Provider approval.
- Conversation dashboard.
- Live transcript UI.
- Quote comparison.
- Negotiation UI.
- Final report.
- EvidenceLink components.
- Responsive design.
- Accessibility.
- Loading, error, empty, and retry states.
- Playwright demo test.
- Demo presentation.

Primary directories:

- src/app
- src/components
- tests/e2e
- docs/demo-script.md

Required deliverables:

- Complete user-facing workflow.
- Mock API integration first.
- Typed real API integration after backend merge.
- Clear simulated-provider labels.
- Live conversation status.
- Five-minute demo flow.

--------------------------------------------------
PERSON 2: DATABASE, DOCUMENTS, AUTH, AND SECURITY
--------------------------------------------------

Own:

- Supabase Auth.
- Database migrations.
- RLS.
- Private Storage.
- Signed URLs.
- CoverageProfile schemas.
- PrivateNegotiationConstraints.
- Encryption.
- Document upload.
- OpenAI and mock document extraction.
- Profile merge.
- Confirmation.
- Canonical serialization.
- Specification hashing.
- Workflow state machine.
- Audit logging.
- Data export.
- Data deletion.
- Environment validation.

Primary directories:

- supabase
- src/domain/schemas
- src/domain/hashing
- src/domain/privacy
- src/domain/state-machine
- src/integrations/openai
- src/integrations/supabase
- document APIs
- confirmation APIs
- docs/security.md

Required deliverables:

- Shared domain contracts.
- Migrations.
- RLS policies.
- Seed scripts.
- Document parser.
- Private-data boundary.
- Stable hash.
- Tests proving maximum-price privacy.

Person 2 publishes shared schemas first.

--------------------------------------------------
PERSON 3: ELEVENLABS AND CONVERSATION SYSTEM
--------------------------------------------------

Own:

- ElevenLabs browser SDK.
- Signed conversation URL or token route.
- Intake Agent configuration.
- Calling Agent configuration.
- Negotiator configuration.
- Provider Agent configurations.
- ConversationOrchestrator.
- Local agent-to-agent bridge.
- Client and server tools.
- Transcript persistence.
- Conversation states.
- Structured outcomes.
- Mock conversation adapter.
- Provider-private rule engine.
- Golden conversation fixtures.
- Agent evaluation.

Primary directories:

- src/integrations/elevenlabs
- src/server/services/conversations
- src/demo/providers
- conversation APIs
- agent-tool APIs
- docs/agent-prompts.md
- conversation integration tests

Required deliverables:

- Six configured agent roles:
  - Intake.
  - Calling.
  - Negotiator.
  - Harbor.
  - Granite.
  - Summit.
- Dynamic conversations.
- Three distinct provider behaviors.
- One legitimate concession.
- No Twilio.
- No real calls.
- No provider access to private constraints.
- No caller access to provider-private rules.

--------------------------------------------------
PERSON 4: RESEARCH, NORMALIZATION, NEGOTIATION LOGIC, AND RANKING
--------------------------------------------------

Own:

- Tavily adapter.
- Mock research.
- Optional Google Places adapter.
- ProviderResearchBrief.
- Provider shortlist.
- InsuranceLineConfig files.
- QuoteNormalizer.
- CoverageEquivalenceEngine.
- RedFlagEngine.
- Evidence reconciliation.
- VerifiedLeverageSelector.
- Negotiation-event validation.
- Ranking engine.
- Recommendation engine.
- Explanation templates.
- Evaluation calculations.

Primary directories:

- src/config/insurance-lines
- src/integrations/tavily
- src/integrations/places
- src/domain/normalization
- src/domain/equivalence
- src/domain/scoring
- src/domain/evidence
- research APIs
- quote APIs
- negotiation APIs
- recommendation APIs

Required deliverables:

- Cited research.
- Provider shortlist.
- Deterministic quote math.
- Coverage-equivalence rules.
- Red flags.
- Verified leverage.
- Ranked recommendation.
- Tests proving web research is not treated as a quote.