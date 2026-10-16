# CrazyGames requirements for Perfectly Suspicious

Research checked: 10 October 2026.
Scope: a silent, word-based multiplayer deduction game. No GIF search, voice, or uploads.
Companion: [Submission process and developer lessons](CRAZYGAMES_SUBMISSION_GUIDE.md).

## How to use this document

- **Required** means an official platform requirement for the stated launch stage.
- **Recommended** means official guidance, not an automatic rejection condition.
- **Project decision** means a proposed engineering or design practice for our game.
- **Confirm with QA** means the public documentation does not settle our particular case.

These notes are a working checklist, not an approval guarantee. Recheck the linked official pages and portal before submission. An unchecked item means not yet verified, not necessarily missing.

## 1. Preserve the agreed game

Players know the same secret word, except one suspicious player who does not receive it. Everyone enters a private one-word clue. The exact secret word and a prepared list of obvious clues are prohibited. Clues are revealed together after a timer. A second simultaneous clue round follows, then players vote for the suspicious player.

**Accepted project additions:** every player sees the same broad category, including the suspicious player. Answers do not repeat within a room session. Validation gives bounded, generic feedback for secret dependent rejections to reduce answer probing. Accessibility includes text alongside color, keyboard operation, readable responsive layouts, accessible labels, and reduced motion. These are our project requirements, not additional rules attributed to CrazyGames. Details and deterministic checks are in [the development plan](DEVELOPMENT_PLAN.md).

Player count, timer durations, scoring, ties, missing submissions, repeat clues, and disconnect outcomes still need explicit design decisions. Do not silently change this into Clue Heist or a GIF game.

## 2. Launch stages

**Required:** Basic Launch permits an optional SDK and has no monetization. Full Launch requires the applicable platform integrations and further review. Passing technical checks alone does not guarantee selection.

Source: [Requirements overview](https://docs.crazygames.com/requirements/intro/).

**Confirm with QA:** some multiplayer games needing a larger audience may proceed directly to Full Launch, with full integration required. QA chooses this route; it is not an exemption developers can claim themselves.

Source: [Multiplayer launch rules](https://docs.crazygames.com/requirements/multiplayer/).

## 3. Technical package and device support

**Required, subject to the documented stage and device scope:**

- [ ] Total uploaded build is at most 250 MB and 1,500 files.
- [ ] Initial download is at most 50 MB; mobile-homepage eligibility requires at most 20 MB.
- [ ] Without SDK measurement, total file size is used for the initial-size limit.
- [ ] External loading reaches gameplay within the documented 20-second evaluation limit.
- [ ] Bundled asset references use relative paths.
- [ ] Chrome and Edge work; Safari failures can lead to Safari being disabled.
- [ ] Test on a 4 GB RAM Chromebook; poor operation can disable Chromium OS availability.
- [ ] Support mouse/keyboard and touch for the devices we claim.
- [ ] Fit desktop landscape; portrait presentation is allowed with suitable surrounding layout.
- [ ] Mobile support also works inside the CrazyGames app, respecting safe areas.
- [ ] Any sitelock allows the platform's documented website and app origins.
- [ ] Add the required notice if collecting additional personal data beyond SDK events.

Source: [Technical requirements](https://docs.crazygames.com/requirements/technical/).

**Project decision:** keep this text-focused build well below these ceilings. Verify that a mobile keyboard does not cover the clue field, submit button, or timer.

## 4. Content and gameplay

**Required:**

- [ ] English localization is available.
- [ ] Text and controls remain readable in embedded desktop sizes and on supported phones.
- [ ] Game runs smoothly with intuitive controls.
- [ ] Content is suitable for the platform's 13+ audience and PEGI 12 requirement, despite our intended adult audience.
- [ ] Name, assets, and presentation have an original identity.
- [ ] Do not add our own fullscreen button; the platform provides fullscreen.
- [ ] Avoid prohibited cross-promotion and in-game app-store links; follow documented exceptions for permitted links.
- [ ] For Full Launch, new players reach gameplay immediately or, where that is infeasible, within the documented one-click allowance.

Source: [Gameplay requirements](https://docs.crazygames.com/requirements/gameplay/).

**Project decision:** describe the bluffing objective with a short example, not a compulsory rulebook. Confirm how room joining and required player waiting fit the onboarding rule.

## 5. Clue moderation and chat settings

**Required:** chat must support the platform's disabling setting and have moderation. The official minimum example is a profanity filter. UGC also needs moderation.

**Confirm with QA:** our clue field is essential gameplay input. The public rules do not explicitly say whether timed one-word clues must be disabled when chat is disabled. Explain this exact mechanic to QA and obtain guidance; do not assume naming it a clue exempts it.

Source: [Chat and UGC requirements](https://docs.crazygames.com/requirements/multiplayer/).

**Project decisions:**

- [ ] Keep the answer/obvious-clue blocklist separate from profanity moderation.
- [ ] Validate clues on the server; client validation is only immediate feedback.
- [ ] Normalize case, spacing, and relevant Unicode variants before checking.
- [ ] Display player text as text, never executable HTML.
- [ ] Explain public syntax rules where useful, but give the same generic rejection for secret dependent failures. Never disclose whether a clue matched the answer or a forbidden alternative.
- [ ] Rate-limit invalid attempts so the validation endpoint cannot be used as an unrestricted word-guessing oracle.
- [ ] Test accidental false positives and blocked words entered just before timeout.
- [ ] Test validation probing, concurrent attempts, and reconnection against the same server enforced budget. Generic errors reduce inference but do not eliminate it.

## 6. Multiplayer and friends integration

**Required for the documented Full Implementation / Online with Friends eligibility:**

- [ ] Publish room identity, joinability, and invitation parameters through the SDK.
- [ ] Use SDK invite links if offering direct invitation links.
- [ ] Support the Instant Multiplayer entry path as documented.
- [ ] Keep the group together for another match.
- [ ] Supply lobby sizes in the submission.
- [ ] Display CrazyGames usernames so friends recognize each other.

**Recommended:** handle invitations while already playing; allow joining as a spectator during an active round, or explain room unavailability.

Source: [Multiplayer requirements](https://docs.crazygames.com/requirements/multiplayer/).

**Hosting fact:** CrazyGames hosts game files, not our multiplayer server. We must operate that service.

Source: [Hosting FAQ](https://docs.crazygames.com/faq/).

## 7. SDK, accounts, and progress

**Required when integrating the SDK:** initialize SDK v3 before using its methods. Handle local, platform, and disabled environments appropriately.

Source: [SDK initialization](https://docs.crazygames.com/sdk/intro/).

**Required:** if integrating the SDK in Basic Launch, report gameplay start at the actual playable state. Full integration requires gameplay start/stop events; loading start/stop events are optional. Do not mark a waiting lobby as gameplay merely to improve measurements.

Source: [SDK integration requirements](https://docs.crazygames.com/requirements/technical/).

**Required for the relevant account/progress scenario:**

- [ ] Guests can play.
- [ ] Do not require a separate email, Google, or Facebook login.
- [ ] For Full Launch with backend accounts, integrate the CrazyGames identity and verify user tokens on the server.
- [ ] Handle guests logging in and changed profile information.
- [ ] Do not automatically force an authentication prompt.
- [ ] If persistent progress exists, use an approved saving method and test account/device changes.

A match-only score is different from persistent progression. Choose the applicable integration rather than adding accounts merely to satisfy an imagined requirement.

Source: [Account and progress requirements](https://docs.crazygames.com/requirements/account-integration/).

## 8. Advertising

**Required if applicable:**

- [ ] Basic Launch works with ads disabled; no dead reward buttons or blocked progression.
- [ ] Use only advertisements requested through the CrazyGames SDK.
- [ ] No advertisements interrupt active gameplay.
- [ ] Pause interaction and mute audio during video ads; resume safely after completion or failure.
- [ ] Rewarded ads are optional; no reward is issued on an ad error.
- [ ] Ad blockers do not prevent normal gameplay or penalize players.
- [ ] In-game banners do not appear during gameplay.

Source: [Advertising requirements](https://docs.crazygames.com/requirements/ads/).

**Project decision:** place any future ads between completed matches. Never let one player's ad consume another player's clue/voting time. Ad-free operation is the first test case.

## 9. Submission artwork

**Required:**

- [ ] Three consistent covers: landscape 1920 x 1080, portrait 800 x 1200, square 800 x 800.
- [ ] No borders, store icons/logos, unauthorized imagery, or promotional text beyond the game title.
- [ ] Supply landscape and portrait preview videos in the documented 1080p formats.
- [ ] Keep preview video at 15–20 seconds and at most 50 MB.
- [ ] No sound, artificial fast-forwarding, black-screen/logo transitions, black bars, default cursor, or promotional text.
- [ ] Use the static cover as the opening frame.

**Recommended:** show a populated room, simultaneous clue reveal, and vote result. Present actual gameplay accurately.

Source: [Cover and video specifications](https://docs.crazygames.com/requirements/game-covers/).

## 10. Quality guidance

**Recommended, not a numeric approval guarantee:** make onboarding short and skippable, respond promptly to actions, use clear goals and consistent controls, and keep visuals coherent. Distinguish the game through its mechanic and identity. Do not change its fundamental genre after submission. Clearly explain if solo play is unavailable.

Source: [Quality guidelines](https://docs.crazygames.com/requirements/quality/).

## 11. Our multiplayer integrity checks

These are **project engineering recommendations**, not quoted CrazyGames rules.

- [ ] The suspicious player's responses, page source, logs, and downloaded data do not contain the current secret answer or its revealing blocklist.
- [ ] Unrevealed clues never reach other clients early.
- [ ] Server deadlines determine acceptance; local clocks cannot extend a turn.
- [ ] Duplicate messages cannot duplicate votes, clues, or points.
- [ ] Rules cover disconnections, timeouts, ties, insufficient players, and host departure.
- [ ] Spectators cannot affect votes or see privileged information.
- [ ] Rejoining preserves the correct role and current phase.
- [ ] No-player and low-player situations have a tested, honest experience.

## 12. Questions to resolve before submission

1. How does the platform's chat-disabled setting apply to our core clue field?
2. Does QA recommend Basic Launch or the multiplayer Full Launch route?
3. What entry flow satisfies onboarding requirements while players assemble?
4. What moderation and reporting behavior does QA expect for these clues?

Record answers and dates here when obtained. None has been obtained yet.

