# Perfectly Suspicious: phased development and launch plan

Created: 10 October 2026.
Status: implementation is underway. Current gate status and executed evidence are recorded in PHASE_LOG.md.

Inputs:

- [CrazyGames requirements](CRAZYGAMES_REQUIREMENTS.md)
- [Submission process and developer lessons](CRAZYGAMES_SUBMISSION_GUIDE.md)
- The agreed word-only game described below

## 1. Scope

Most players receive the same secret word. One suspicious player does not receive it. Players take turns submitting a single word clue. The exact answer and a prepared list of obvious clues are prohibited. Every accepted clue appears immediately and passes the turn. After the configured clue rounds, everyone votes for the suspicious player. The host chooses the number of cases, clue rounds in each case and the time each player gets in each clue round.

Everyone receives the same broad category, including the suspicious player. For example, the answer Airport belongs to Places. The category provides a starting point without revealing the answer. Answers must not repeat within the same room session.

The game is playable silently using text and taps/clicks. Optional original music and sound effects were requested during the presentation revision and never convey exclusive game information. No GIFs, image uploads or voice are part of this version. Requested social chat is limited to the lobby and completed cases, with server enforced phase restrictions, explicit filtering, message limits and a cooldown. Scores, rooms, deadlines, roles, and reveals are controlled by the server.

## 2. Mandatory phase progression policy

1. Work through the phases in order and respect the stated dependencies.
2. If a phase requires deterministic tests, finish its deliverables and pass every applicable required test before advancing. Record **PASS** with evidence.
3. If a phase does not require deterministic testing, finish its deliverables, record **COMPLETE_NO_TESTS**, and move to the next phase. Do not invent tests merely to create a gate.
4. A failed required test means **FAIL**: fix the cause and rerun that test plus affected regression checks. Do not advance dependent implementation while it fails.
5. Missing infrastructure, credentials, or a required external decision means **BLOCKED**, not PASS or NO_TESTS. Independent work may continue, but the dependent gate remains open.
6. After PASS or COMPLETE_NO_TESTS, proceed to the next phase within the authorized implementation scope. Do not repeatedly ask for confirmation between routine phases.
7. Tests may be marked **NOT_APPLICABLE** only when the related feature or launch route is explicitly excluded, with a recorded reason. A difficult or failing test is never a reason for exclusion.
8. If a later change invalidates an earlier gate, reopen that gate and run the affected checks. Unrelated successful suites do not need repeated execution.
9. No phase uses an LLM judge, AI quality score, subjective screenshot assessment, semantic model comparison, or AI approval prediction.
10. Platform acceptance is a separate external event. Passing our tests does not mean CrazyGames approved publication.

This planning task creates the plan only. The progression policy applies when implementation begins; this file does not authorize contacting people, spending money, or publishing externally by itself.

## 3. What counts as deterministic testing

A test has controlled inputs and an exact expected result. Use fixed fixtures, injected clocks, explicit message order, seeded randomness in tests, and mocked external SDK responses. Pin dependency versions and relevant browser/runtime versions.

Suitable checks include state transitions, exact points, validation result codes, authorized payload fields, DOM visibility, file sizes, asset dimensions, and explicit SDK call sequences.

- Production uses appropriate secure randomness; fixed test seeds must not become production role-selection behavior.
- Advance a virtual clock instead of waiting with real sleeps.
- Deliver, duplicate, delay, and reorder messages using a controlled test transport.
- Assert a single server reveal event/version, not identical physical arrival time on every device.
- Reject a late submission according to server receipt time, not a client-supplied timestamp.
- A scripted manual device check may use fixed actions and binary assertions. Record the device, browser, actions, and observed result. Do not grade whether it looks nice.
- Live-service outages make an external check blocked; they must not be hidden by retries until a pass occurs.
- Variable real-world latency, retention, playtime, and subjective enjoyment are observations, not deterministic test gates. Record them separately and do not claim deterministic tests prove them.
- No live LLM calls or model-based clue judgments are needed. Clue policy uses explicit rules and versioned word lists.

## UI and UX requirements for every phase

Create a distinctive, deliberately designed party game. The UI and UX must not look like a generic AI generated game. Use a coherent visual identity, purposeful typography, consistent spacing, clear hierarchy, and components designed around clues, suspicion, voting, and reveals. Avoid placeholder copy, unrelated dashboard elements, and decorative clutter. This is a design direction, not an LLM graded acceptance test.

The game must remain playable across different screen sizes. Design for small phones, tablets, embedded CrazyGames frames, and desktop screens. Preserve readable clues, accessible actions, visible timers, keyboard access, touch input, safe areas, and usable layouts when the mobile keyboard opens. Essential controls must not overlap, clip, or require horizontal scrolling.

Accessibility is part of these shared requirements. Communicate each role and status with visible words, not color alone. A submitted clue shows "Submitted" as well as its visual treatment. Provide visible keyboard focus, logical Tab order, labeled inputs, and buttons operable with Enter or Space as appropriate. Voting must not depend on dragging or hovering. Announce phase changes and accepted submissions through accessible status text without reading the timer every second or exposing secret information to another player.

Respect the device preference for reduced motion and offer an in game motion setting. With reduced motion enabled, replace shakes, zooms, and moving reveals with immediate state changes or a simple fade. Animation completion must never control a server deadline or reveal time. Use readable typography, sufficient text contrast, and layouts that remain usable at 200 percent browser zoom. As project design defaults, use at least 16 CSS pixels for essential body text and a target area of at least 44 by 44 CSS pixels for primary touch actions. These defaults are project choices, not a claim of formal accessibility certification.

Do not include emoji, a single dash, a double dash, or typographic dash variants in game authored text. This includes buttons, instructions, role descriptions, timers, scores, errors, loading messages, accessibility labels, and submission copy we write. Use words such as "to" for ranges and "No clue" for missing values. Do not use emoji as icons; use purpose made graphical assets when icons are needed.

Validate player submitted clues against the same character restriction before publication. Keep required platform profile information intact; third party account names and platform owned screens are external data, not copy we author. Document any conflict with required profile display for QA rather than silently changing a user's identity. Source code operators, command flags, URLs, and Markdown formatting syntax are not player facing text.

Use deterministic checks for measurable behavior and authored text. Scan the complete copy catalogue and rendered text fixtures for U+002D, Unicode dash punctuation, U+2212, and emoji sequences using pinned Unicode data. Cover flags, variation selectors, modifiers, and keycap sequences without rejecting ordinary digits. Inspect nontext assets through the design deliverable checklist, not an AI image judge.

Use fixed viewport fixtures at 320 by 568, 360 by 800, 390 by 844, 768 by 1024, 800 by 450, 907 by 510, 1366 by 768, and 1920 by 1080 CSS pixels. Test long clues, long display names, validation errors, and all supported room sizes. These are project test cases, not a claim that CrazyGames mandates every dimension. Device specific keyboard and safe area checks still use the scripted device procedure.

Phases that change only documents or design carry these requirements forward without creating artificial tests. Phases that add or change UI or copy run the applicable deterministic text and layout checks. The design direction never introduces subjective grading or overrides the existing phase progression policy.

## 4. Phase overview

| Phase | Outcome | Deterministic tests | Exit |
| --- | --- | --- | --- |
| 0 | Written game rules and decisions | Not required | COMPLETE_NO_TESTS |
| 1 | Architecture, UI flow, compliance mapping | Not required | COMPLETE_NO_TESTS |
| 2 | Pure game engine and scoring | Required | PASS |
| 3 | Word packs, validation, moderation | Required | PASS |
| 4 | Authoritative multiplayer service | Required | PASS |
| 5 | Complete browser game | Required | PASS |
| 6 | New-player, sparse-room, and replay flows | Required | PASS |
| 7 | CrazyGames integration and launch profiles | Required | PASS |
| 8 | Release packaging and submission assets | Required for measurable requirements | PASS |
| 9 | Submission preparation and external review | No new deterministic suite | COMPLETE_NO_TESTS for preparation; external review tracked separately |
| 10 | Launch monitoring and Full Launch changes | Required only for changed behavior | PASS or COMPLETE_NO_TESTS as applicable |

All phases initially have status **NOT_STARTED**. Test names below are planned identifiers, not tests that already exist or have passed.

## Phase 0 - Freeze game rules

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** agreed concept.

Write a game specification covering roles, clues, timers, voting, scoring, and all terminal outcomes. Record these suggested defaults as project choices, not CrazyGames requirements:

| Decision | Proposed initial value |
| --- | --- |
| Human players | 3 to 8 per match |
| Suspicious players | Exactly one per match; selected securely by the server |
| Shared category | The same broad category is visible to every player; the suspicious player still never receives the answer |
| Answer history | No canonical answer repeats in a room session; reserve an answer when roles are delivered, even if that match later aborts |
| Exhausted word pool | Offer an unused eligible pack or an explicit new session; never silently repeat an answer. A new session clears history and session scores |
| Cases | Host selects 1 to 10, default 3; new word and vote in each |
| Clue rounds | Host selects 1 to 5 per case, default 2 |
| Turn time | Host sets 10 to 60 seconds per player independently for each clue round, default 20 |
| Reading interval | 8 seconds after each reveal |
| Voting | 20 seconds; one private vote per eligible player; no self-voting |
| Turn completion | Reveal each accepted clue immediately and pass the turn; timeout records a missing clue |
| Editing | Accepted clues are final; votes can change until the vote deadline |
| Deadline boundary | Server receipt strictly before the deadline is accepted; at or after it is rejected |
| Missing clue/vote | Visible missing clue marker at turn expiry; no vote counts as abstention |
| Vote result | A unique highest vote total identifies one accused player; a tie or no votes means nobody is caught |
| Informed-player score | 100 points for personally voting for the suspicious player |
| Suspicious-player score | 200 points if not caught by the group vote; otherwise zero |
| Aborted match | No score change |
| Next case | Same room, fresh word and roles; session totals retained until the selected case count is reached |
| Repeated clues | Allow cross player duplicates; reject any of the same player's earlier normalized clues in the case |
| Disconnection | 15-second reconnection grace; an expired departure leaving fewer than three eligible players aborts the match |
| Persistent progression | None in v1; session scores only |

The shared category, session answer history, bounded validation feedback, and accessibility requirements are accepted additions to the game scope. Tune their numerical implementation defaults during this phase without removing those requirements. Reconnecting or rematching does not start a new session or reset history. Define validation attempt limits per player and clue round, including rejected attempts, before implementation.

Also specify host departure, spectator permissions, validation attempt limits, and precisely when players become eligible for the next match. A disconnected player's previously accepted input remains unless the match aborts. No automatic role replacement during a match.

**Deliverables:** game specification, score examples, complete phase/state diagram, and a decision register. Resolve or replace the proposed defaults before coding against them.

**Testing:** none required. These are design decisions, not implemented behavior.

**Exit:** all decisions are explicit and mutually consistent. Mark COMPLETE_NO_TESTS and advance.

## Phase 1 - Architecture, UI flow, and compliance mapping

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** Phase 0.

Plan a lightweight browser client, an authoritative room server, and a small platform adapter. Choose the implementation stack and lock supported runtime versions during setup. Keep rules independent of networking and UI so they can be tested with a fake clock.

Define message schemas, allowed fields per role, state versions, reconnect identity, error codes, test commands, and evidence locations. The server stores the current answer, role mapping, validation lists, accepted clues, and votes. Other clients receive only their authorized views.

Separate the public category from private answer data. Maintain answer history by canonical answer identity on the server, including duplicate aliases across packs. Keep detailed moderation reasons in authorized internal diagnostics only. Map secret dependent failures to one generic public rejection result. Design labeled controls, focus behavior, text alternatives for statuses, and reduced motion behavior alongside every screen.

Sketch lobby, private role screen, clue entry, reveal, voting, results, and rematch. Account for the mobile keyboard and small embedded viewports. Map every applicable requirement from the two companion guides to a phase and a verification method.

Record external questions about core clue input under chat-disabled settings, the launch route, and onboarding while a group assembles. Draft questions now; obtaining an external answer is not a prerequisite for independent engine development.

**Deliverables:** architecture note, protocol contract, UI flow, requirement mapping, test harness design, external-question register.

**Testing:** none required for these documents and sketches. No LLM or human aesthetic rating is a gate.

**Exit:** each feature has an owner component, each requirement has a disposition, and no implementation-critical rule remains ambiguous. Mark COMPLETE_NO_TESTS and advance.

## Phase 2 - Game engine and scoring

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** Phases 0-1.

Implement the pure engine with injected time and randomness. Model lobby, role delivery, clue round one, reveal one, clue round two, reveal two, voting, results, and abort. A result and scoring operation must be final and idempotent.

**Required deterministic tests:**

- E01: the minimum and maximum supported room sizes produce exactly one suspicious player.
- E02: each case follows the configured 1 to 5 clue rounds, reading intervals and vote; no extra clue round is possible.
- E03: clues accepted at deadline minus one millisecond are used; inputs at and after the deadline are rejected.
- E04: accepted clues publish immediately and pass the turn once; a timeout records a missing clue and starts the next player clock.
- E05: correct accusation, wrong accusation, tie, all abstain, and partial abstention produce exact configured scores.
- E06: applying the same completion event twice does not award points twice.
- E07: abort yields no score changes; rematch clears previous private data and preserves only intended session totals.
- E08: missing inputs and out-of-phase actions produce defined outcomes without hanging.
- E09: all player views contain the same category; only informed players receive the answer, and category delivery does not disclose the selected answer ID or its forbidden list.
- E10: a fixed word pool is consumed without canonical repeats across rematches, reconnects, pack aliases, and aborts after role delivery. Exhaustion triggers the specified state rather than a random retry loop or silent history reset.
- E11: an explicit new session resets history and session scores; ordinary replay and reconnect preserve them.

Use expected score tables written independently from the scoring function. Include exhaustive small vote configurations where practical; avoid tests that merely repeat the implementation.

**Exit:** engine deliverables complete and E01-E11 pass. Advance to Phase 3.

## Phase 3 - Word content and deterministic validation

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** Phase 2.

Create versioned English word packs with explicit forbidden clues and separate moderation lists. Implement single-word syntax, normalization, length limits, repeat-clue policy, and safe error messages. Moderation occurs before publication.

Each word record includes a canonical answer identity and a broad category. Categories must cover multiple plausible answers; curation determines their breadth without an LLM judge. Require at least two canonical answers per category in the configured pack. This content check does not guarantee that players cannot infer an answer late in a session from remembered history.

Treat validation as a potential answer detector. Do not return different public reason codes, messages, or reason specific response fields for the exact answer, an obvious clue, and other secret dependent rejections. A message such as "Choose another clue" gives feedback without naming the reason. Public syntax guidance may explain a rule that does not depend on the secret word. Enforce bounded attempts and final submissions on the server; reconnects and parallel requests cannot reset that budget. Accepted clues cannot be overwritten.

Acceptance versus rejection still reveals some information. These controls reduce probing; they do not prove zero information leakage or prevent players sharing information outside the game. Do not claim timing based inference is eliminated by matching message bodies.

Automated tests can verify a curated list, not prove every potentially offensive or obvious expression has been identified. Content curation remains an editorial deliverable; do not substitute an LLM judge.

**Required deterministic tests:**

- V01: the secret answer and every explicit forbidden entry are rejected after normalization.
- V02: fixed fixtures cover case, whitespace, zero-width characters, Unicode normalization, punctuation, hyphens, apostrophes, empty inputs, and length boundaries according to the specification.
- V03: allowed examples pass, including chosen false-positive regression cases.
- V04: any of the same player's earlier clues in a case is rejected; another player's matching clue does not invalidate an accepted public submission.
- V05: HTML/script-like inputs cannot execute or render as markup.
- V06: rate limits have exact fake-clock boundaries; rejection messages do not return the answer or forbidden list.
- V07: further submissions cannot erase or overwrite a final accepted clue.
- V08: content files have unique IDs, required fields, and no invalid references.
- V09: submitted clues containing emoji or prohibited dash characters are rejected; ordinary letters and digits follow the specified word policy. Fixed fixtures cover single and repeated U+002D, Unicode dash variants, emoji sequences, and allowed near matches.
- V10: fixed probing sequences for the exact answer, obvious clues, and other secret dependent failures produce the same public rejection shape. No public result exposes the matched rule, answer, category candidates, or forbidden list.
- V11: sequential and simultaneous probing consume the configured budget atomically. Reconnect and locked submission fixtures cannot bypass it; a new clue round resets only the specified budget.
- V12: packs have valid category references and canonical identities; duplicate answer aliases do not evade session history. A category with only one canonical answer in the configured pack fails content validation.

**Exit:** word packs and policy are documented; V01-V12 pass. Advance to Phase 4.

## Phase 4 - Multiplayer server and secrecy

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** Phases 2-3.

Implement public/private room membership, role-specific snapshots, authenticated player actions, synchronization, reconnect grace, host transfer, and cleanup. Test using simulated clients first.

**Required deterministic tests:**

- N01: cross-room, spoofed-player, spectator, and duplicate actions cannot change unauthorized state.
- N02: the suspicious player's messages do not contain the current answer, its forbidden list, or privileged role mapping; no client receives another player's clue before reveal.
- N03: controlled dropped, reordered, delayed, and duplicated packets converge to the authoritative state using versions and snapshots.
- N04: client clock changes and forged timestamps cannot extend submission deadlines.
- N05: reconnect before/at/after the grace boundary follows the written policy and preserves the correct role.
- N06: host departure does not destroy a valid room; insufficient eligible players abort without awarding scores.
- N07: stale round IDs cannot overwrite the next round; final results occur once.
- N08: all players leaving triggers configured cleanup; expired rooms cannot be joined.
- N09: bounded queues and input limits reject fixed overload fixtures without corrupting room state.
- N10: fixed concurrent requests cannot obtain extra validation attempts or reset answer history through reconnect, membership changes, or a forged session identifier.

Inspect serialized payloads, not merely what the UI hides. Test known secret values through response bodies and player-visible logs. Do not rely on hiding the browser developer tools.

**Exit:** N01-N10 and affected engine/validation regressions pass. Advance to Phase 5.

## Phase 5 - Complete browser experience

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** Phase 4.

Implement the full silent match on desktop and supported mobile layouts. Show clear role instructions, accepted submission status, authoritative countdown, revealed clues, voting status, final roles, scores, and replay action.

**Required deterministic tests:**

- U01: scripted browser clients finish a match as informed and suspicious players using fixed inputs; visible results equal server results.
- U02: accepted clues lock immediately and pass the turn; another player cannot submit outside their turn. Votes remain editable until the vote deadline.
- U03: unsubmitted drafts stay absent from other players' DOM and received payloads. Accepted clues become public immediately and are final; secret words and votes remain private.
- U04: missing submissions, invalid clues, disabled controls, and disconnect notices have the exact expected states.
- U05: keyboard-only navigation, Enter submission, touch controls, and focus behavior follow the documented interaction contract.
- U06: fixed viewport fixtures assert no horizontal overflow, overlapping essential controls, or clipped clue/vote actions using layout measurements.
- U07: browser refresh/rejoin restores the current phase without exposing privileged data.
- U08: all game authored copy and rendered text fixtures satisfy the emoji and dash restrictions, including error, loading, empty, accessibility, and result states. User profile fixtures are identified separately as external data.
- U09: the fixed screen size matrix preserves essential control visibility, clue readability, timer visibility, and input access with long content and supported room sizes. Use exact DOM and layout assertions.
- U10: every role, submission state, vote state, and result has a visible text label independent of its color. Inputs and buttons expose the expected accessible names and semantic roles.
- U11: a complete match can be operated by keyboard using a fixed focus sequence, with visible focus and no keyboard trap. Native buttons respond to the specified activation keys; no essential action requires hover or dragging.
- U12: with reduced motion enabled through the device preference or the game setting, the tested screens contain none of the prohibited shake, zoom, or moving reveal effects. Server events, deadlines, and results remain identical in both motion modes.
- U13: the agreed viewport fixtures at 200 percent zoom retain essential actions and text. Assert the configured minimum text size and primary touch target dimensions; compare rendered palette values to the documented contrast threshold selected in Phase 1 using a fixed formula.
- U14: fixed accessibility tree and status fixtures announce phase changes and submission results once without announcing each timer tick. They expose only the current player's authorized role and answer data.

Use pinned browser fixtures and explicit DOM/geometry assertions. Screenshots may be diagnostic artifacts but are not judged by an LLM or a visual-quality score.

**Exit:** U01-U14 pass for the declared support matrix. Advance to Phase 6.

## Phase 6 - Empty lobbies, learning, and rematches

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** Phase 5.

Address the failure pattern identified in the submission guide: visitors may arrive without enough simultaneous opponents. Implement a clear private-room invitation flow and public matching. Define what happens with zero, one, and fewer-than-minimum opponents.

A clearly labeled, scripted practice example is the proposed fallback while waiting. It must explain that it is practice and cannot award competitive points. It supplements the human game rather than disguising bots as people. If this fallback is excluded, document and implement another explicit low-population flow; never leave an unexplained spinner.

**Required deterministic tests:**

- F01: fixed arrival/departure schedules match eligible players without duplicating membership or overfilling rooms.
- F02: sparse rooms show the defined wait/invite/practice state and allow leaving.
- F03: any scripted practice has fixed clues/results, identifies itself clearly, and cannot affect live scores.
- F04: invited and late-arriving players join or spectate according to room state.
- F05: rematch preserves the group; a spectator becomes eligible only at the defined boundary.
- F06: onboarding is skippable where specified and never unexpectedly reappears on an invitation.
- F07: practice explains the shared category, sequential public clues, private words and generic rejection feedback. Its separate word pool and scores cannot consume live session answers. Exhaustion and explicit session restart have accessible text and working keyboard actions.

Do not impose a subjective fun score or guaranteed retention target. Whether enough real people will arrive is an external launch risk, not a property a local simulation can prove.

**Exit:** the selected population flow is complete and F01-F07 pass where applicable. Advance to Phase 7.

## Phase 7 - CrazyGames adapter and launch profiles

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** Phase 6. Resolve external requirements before enabling dependent publication behavior.

Provide explicit local, Basic Launch, and Full Launch configurations. Initialize the SDK correctly, report genuine gameplay transitions, support guests, integrate room/invite information, and show platform identities where required. If persistence is later introduced, implement its applicable account/progress requirements.

Basic Launch must operate with monetization disabled. Ads remain out of the initial gameplay implementation; if later added, use only the platform SDK and place them between completed matches. An absent optional ad feature is NOT_APPLICABLE, not an unfinished mandatory test.

**Required deterministic tests, using a fake SDK:**

- C01: initialization, unsupported/local environment, and initialization failure follow the adapter contract without crashing.
- C02: start/stop events match playable phases; lobby waiting is not reported as active gameplay.
- C03: guest, signed-in, profile change, and expired/invalid token fixtures produce the prescribed identity behavior.
- C04: invite parameters, joinability, Instant Multiplayer, and rematch update room state correctly.
- C05: the platform's chat setting exercises the QA-confirmed clue behavior. Until clarified, mark this dependency BLOCKED rather than assuming an exemption.
- C06: Basic Launch makes no ad request and offers no unusable reward control.
- C07, only if ads are implemented: completion, failure, no-fill, and blocked-ad fixtures resume safely; active matches are never interrupted and an error never grants a reward.
- C08, only if persistence is implemented: fixed account-switch and save-conflict fixtures preserve the specified progress ownership.

Actual portal/app compatibility also needs scripted binary checks on the real environment; mocked SDK success alone is insufficient. A missing account, outage, or unresolved QA interpretation is recorded separately as an external blocker. Continue unrelated packaging work while it is resolved.

**Exit:** all applicable integration checks pass and required behavior is settled for the selected release profile. Advance to Phase 8.

## Phase 8 - Release package, assets, and compatibility

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** Phases 2-7 for a release candidate; asset preparation may begin earlier.

Produce a versioned client bundle and matching server release configuration, three cover sizes, preview videos, description, instructions, declared lobby sizes, and reviewer notes. Use the exact specifications in the requirements guide and recheck official documentation before actual submission.

**Required deterministic tests/checks:**

- R01: production build and static checks succeed; the bundle has no development endpoints, privileged secrets, or unintentionally public server-only word packs.
- R02: a script counts files/bytes and checks relative bundled asset paths against the applicable platform limits.
- R03: image/video metadata matches required dimensions, aspect ratios, file-size limits, duration limits, and absence of an audio stream.
- R04: fixed viewport/device scenarios complete submission, both reveals, voting, results, and replay with exact expected states.
- R05: scripted actual-device checks confirm keyboard visibility, safe areas, and essential control reachability for each claimed mobile environment.
- R06: the portal preview resolves assets, connects to the intended backend, and follows the SDK/room contract. Use explicit observable outcomes; an unavailable preview environment is BLOCKED.
- R07: backend unavailable, timeout, and retry fixtures display defined recovery behavior without leaking data or awarding points.
- R08: run the complete deterministic release suite once against this candidate; repeat only after changes or failures justify it.
- R09: scan the release copy catalogue, submission text, and scripted rendered states for prohibited emoji and dash characters; run the defined screen size matrix against the actual release bundle.
- R10: run the shared category, session history, validation probing, keyboard, text alternative, zoom, accessible name, and reduced motion fixtures against the release candidate. Document supported device results without claiming automatic tests prove complete accessibility.

Real-device load time, frame rate, and server latency measurements are recorded observations under named conditions. Do not label them deterministic or silently waive the platform's performance expectations. Collect them for release review; unresolved material performance issues remain release risks for actual QA.

Titles, art, permitted rights, accurate portrayal, and age suitability are editorial/compliance deliverables. Record the checklist and provenance; do not create automated beauty, originality, or PEGI classifiers. External QA may still reject content despite technical passes.

**Exit:** R01-R10 pass for the selected profile, assets/checklists are complete, and the exact candidate is recorded. Advance to Phase 9.

## Phase 9 - Submission preparation and external review

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** Phase 8.

Prepare the portal entry, reviewer instructions, moderation explanation, population plan, and answers to outstanding platform questions. Include only features actually implemented. Record build version, backend version, supported devices, applicable launch route, and test evidence.

**New deterministic testing:** none required unless submission preparation changes code, assets, or configuration. Reuse Phase 8 evidence for the unchanged candidate. Reopen affected gates if the candidate changes.

**Preparation exit:** complete deliverables and record COMPLETE_NO_TESTS. This permits moving to monitoring preparation without inventing another test suite.

**External submission/approval:** actual submission follows the user's authorization and platform access. Record submitted, changes requested, rejected, or accepted from real platform feedback. Do not mark external approval complete because our phase passed. Do not publish or begin a platform-dependent launch without the necessary real approval.

If QA requests changes, map each request to the affected phase, make the change, rerun its deterministic checks, and resubmit only through the available workflow. Do not assume repeated Basic Launch opportunities are guaranteed.

## Phase 10 - Launch observations and Full Launch preparation

**UI and UX reminder:** Make this feel like a deliberately designed game, never a generic AI generated game. Keep it playable across phone, tablet, embedded, and desktop screen sizes. Use no emoji, single dash, double dash, or typographic dash characters in game authored text. Apply the shared UI and UX requirements to every deliverable in this phase; keep testing deterministic only.

**Depends on:** the actual platform outcome for launch-dependent actions; monitoring preparation can proceed after Phase 9 preparation.

Track room wait, first accepted clue, match completion, replay, disconnect, and validation failures. Keep these separate from CrazyGames' own metrics. Conversion, retention, and playtime are observational data, not deterministic test assertions or fixed approval promises.

For Basic Launch, use the platform's current test window and dashboard. If invited to Full Launch, finish all remaining applicable integration requirements and submit the new candidate for the necessary review. A QA-selected direct Full Launch route skips Basic Launch monitoring only, not full integration checks.

**Required tests when behavior changes:**

- L01: synthetic event fixtures emit the correct analytics events once, with no secret answers or unrevealed clues.
- L02: any new SDK, ad, persistence, rules, or networking behavior reruns its relevant earlier gate and regression cases.
- L03: a changed production candidate passes the release suite and packaging checks before submission.

**No-test path:** if the phase only records external feedback, dashboard observations, or an unchanged release decision, no new deterministic tests are needed. Record COMPLETE_NO_TESTS and continue the next authorized operation.

**Exit:** applicable changes pass their gates and the actual platform decision is recorded separately. Never infer Full Launch approval from local tests or an engagement threshold.

## 5. Evidence and status format

During implementation, maintain a phase log with these fields:

| Field | Required record |
| --- | --- |
| Phase and status | NOT_STARTED / IN_PROGRESS / PASS / COMPLETE_NO_TESTS / FAIL / BLOCKED |
| Build | Commit or build identifier; client/server versions where applicable |
| Deliverables | Paths to completed artifacts |
| Required checks | Test IDs and applicable launch/device profile |
| Test environment | Runtime/browser versions, fixtures, seed, and fake-clock scenario |
| Result | Passed/failed check IDs and report locations; no AI score |
| Exclusions | NOT_APPLICABLE check IDs with an explicit feature/route reason |
| External dependencies | Actual response/status, owner, and date, or pending |
| Next phase | Advance after the required gate; otherwise name the unresolved dependency |

Do not mark any tests as passed in this plan. The test harness, scripts, and reports will be created during implementation. This plan adds no LLM evaluation service and no ongoing LLM grading cost.

## October turn and interface revision

UI and UX reminder: retain the crafted detective room and character style across phone, tablet and laptop screens. Authored game text must contain no emoji or dash characters. Use deterministic checks only.

1. Update the specification and architecture for cases, clue rounds, immediate reveal, final submissions and individual turn clocks. These document changes require no deterministic tests and can advance when complete.
2. Gate engine and service changes on exact clock, host authorization, settings bounds, turn ownership, skipped turns, reconnect, repeat clue, case limit, scoring and privacy assertions. A passing gate allows browser integration.
3. Gate browser integration on the configurable five round flow, guided practice, device layouts, keyboard operation, invitations, chat locking and SDK lifecycle checks. Test the full supported suite against the built client.
4. Gate the fixed interface on zero document and overlay scrolling, camera invariance during attempted wheel scrolling, visible controls within their sections, all suspects visible together with direct access to every ballot and complete clue history, and host settings and drafts surviving snapshots. Compact the mobile console and collapse empty message and notice space without moving the room camera. Use a closer camera, a larger unified case console, persistent chat, consistent button dimensions, grouped clue cards and a quiet notification area. UI and UX must feel like a game across phone, tablet and laptop sizes. Only deterministic checks gate this phase. Passing the gate permits local review; visual preference remains user feedback, without model grading.
5. Record evidence and update the local build. External platform and physical device gates remain as recorded; this revision does not authorize publication.
