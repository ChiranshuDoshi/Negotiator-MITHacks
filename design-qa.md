# PolicyScout Design QA

## Scope

- Target: desktop Web prototype on branch `person1-UI`.
- Reference: `design-previews/policyscout-cinematic-showcase.png`.
- Runtime: `http://127.0.0.1:4174/` at the in-app desktop viewport (`1512x771`).
- Comparison sheet: `frontend/qa/design-comparison.jpg`.

## Visual Comparison

- Typography: Manrope display type and IBM Plex Sans interface type preserve the reference's premium editorial-to-product transition.
- Layout: the implementation extends the reference into ten center-axis beats: open road, medium follow, close follow, rear-body approach, rear-window threshold, glass portal, rear-seat entry, seat pass-through, cockpit lock, and dashboard reveal.
- Color: dark evergreen vehicle scenes transition into a restrained white, ink, and teal insurance workspace.
- Assets: ten production cinematic WebP scenes use one consistent dark emerald SUV, dawn environment, and interior material language. A Canvas camera now supplies continuous scale, radial motion trails, and the rear-glass portal rather than switching stacked DOM images.
- Product content: the expanded screen resolves into the working quote and negotiation product rather than a static marketing mock.

Evidence:

- `frontend/qa/mercury-reference.png`
- `frontend/qa/mercury-dashboard-reference.png`
- `frontend/qa/zoom-sequence-contact.jpg`
- `frontend/qa/journey-sequence-contact.jpg`
- `frontend/qa/canvas-cockpit-arrival.jpg`
- `frontend/qa/canvas-demo-handoff.jpg`
- `frontend/qa/design-comparison.jpg`

## Interaction Verification

- Login modal opens, contains populated demo credentials, and enters the workspace.
- Vehicle profile submits and starts five sequential insurer calls.
- All five calls progress through queued, calling, and verified states.
- Quote comparison shows five normalized rows, a separate PolicyScout recommendation, user selection, and a private `$1,450` target.
- Negotiation progresses from `$1,684` to `$1,546`, `$1,472`, and `$1,428` before resolving automatically.
- Final result shows `$256` and `15.2%` savings, target achieved, and four unchanged coverage rows.
- Full negotiation audio play/pause works through browser speech synthesis.
- Three timestamped Good negotiation replay clips select independently and move the audio playhead.
- All ten cinematic scene assets loaded into the Canvas renderer; sampled scroll coverage had no blank frame.
- Twenty-one settled journey samples preserve a monotonic center-axis push from the distant SUV to the infotainment screen.
- A twelve-sample large scroll jump advanced through the Canvas frame index without reversing progress; both scroll target and rendered camera use damping.
- Adjacent source changes happen at peak radial zoom energy, while the rear-window threshold uses a feathered spatial portal instead of a full-frame dissolve.
- Rear-window and cabin transitions keep the infotainment screen on the same center camera axis.
- Desktop horizontal overflow: `0px`.
- The demo jump lands at `demoTop: 0`; the vehicle WebP loads at `1448x1086` and no image reports a failed intrinsic size.

## Issues Fixed During QA

- P2: scroll progress lag left copy from the previous scene visible. Replaced the long sticky sequence's derived scroll state with deterministic section progress.
- P2: the call-to-result crossfade paused in a washed gray state. Tightened the overlap so the infotainment display lights directly into the result.
- P2: short demo states used `100svh`, allowing 52px of the previous cockpit scene to reappear. Locked the desktop app to `100vh`; all five steps now remain aligned at `demoTop: 0`.
- P2: the first rear-glass and front-seat crossfades held both scenes too long, creating visible double exposure. Compressed both threshold transitions and increased cabin scale so the seats leave the frame before the dashboard locks.
- P2: five distant keyframes still read as image switching during slow scroll. Added five centerline intermediate frames, shortened each crossfade, and kept adjacent opacity sums at `1.0` so the camera path reads as one push.
- P2: adding frames would have pushed the raster payload above the previous media budget. Converted every runtime image to WebP; the eleven loaded product and cinematic assets now total about `1.0MB` on disk.
- P2: even the denser image stack still exposed frame changes because adjacent source framing differed. Replaced stacked image opacity with one Canvas camera, matched outgoing zoom to incoming subject scale, removed reverse zoom on entry, and hid source changes inside a radial speed burst.
- P2: the first rear-glass reveal looked like a hard rectangular screen. Expanded the portal from the full rear-window opening, added a feathered edge layer, and accelerated the final expansion through the cabin.

## Residual P3 Notes

- Provider calls and quotes are intentionally simulated for the hackathon demo.
- Audio uses local browser speech synthesis; production should replace it with recorded or streamed ElevenLabs audio.
- This showcase is intentionally desktop-only for the current review; a mobile cinematic treatment is out of scope by request.
- A reduced-motion CSS path is implemented; the current desktop browser runtime did not expose media emulation for an automated screenshot.

final result: passed

## Dashboard Operations Redesign QA

### Scope and References

- Dashboard-only redesign; `CinematicShowcase` was intentionally left unchanged.
- Before-state flow: `frontend/qa/dashboard-audit/`.
- Final flow: `frontend/qa/dashboard-final/`.
- Combined reference and implementation review: `frontend/qa/dashboard-final/reference-comparison.png`.
- Captured references: Stripe Dashboard documentation, Mercury, Linear, Lemonade, Mobbin, and Page Flows.

### Visual Review

- Replaced the pale mint app canvas and repeated rounded cards with a white/ink operations shell, quiet gray sidebar, and restrained teal accent.
- Profile now reads as an agent-ready insurance call sheet with field provenance and disclosure rules; the vehicle image is part of a compact dossier rather than a decorative card.
- One global `Profile verified` state replaces repeated security and verification badges.
- Research and quote states use dense row-based ledgers with rating evidence, eligibility, quote evidence, loading skeletons, and explicit workflow locks.
- The dark surface is reserved for the live negotiation and call evidence panels, giving it a functional role rather than treating the whole UI as an AI theme.
- Final result preserves original and negotiated quote, savings, target achieved, unchanged coverage, synchronized audio/transcript, and timestamped replay clips.

### Interaction and Accessibility Verification

- Completed the full `Profile -> Top 5 Research -> Quotes -> Negotiation -> Evidence & calls` journey in the in-app browser.
- Evidence index opens; selecting a different quote updates the private target panel; HarborShield selection can be restored.
- Audio play/pause and a timestamped replay clip were exercised successfully.
- Async call and negotiation regions expose polite live announcements.
- Vehicle type controls expose `aria-pressed`; form inputs have names and appropriate autocomplete metadata.
- Progress animation uses `transform: scaleX()` and reduced-motion CSS disables dashboard transitions.
- Browser console warnings/errors: none.
- Desktop layout: `scrollWidth 1280`, `clientWidth 1280`; no horizontal overflow.
- `npm run build`: passed.
- No lint script exists in the current package.
- Browser comment follow-up: rebuilt the concession trail as one four-segment ledger with separate round/time metadata, larger price hierarchy, multiline concession labels, dedicated annual impact rows, and a bottom connector rail. The refined state is recorded in `frontend/qa/dashboard-final/07-concession-trail-refined.png` and remains overflow-free at the more constrained `1280x720` QA viewport.

final dashboard result: passed
