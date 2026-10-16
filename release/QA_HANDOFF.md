# Questions for CrazyGames QA

Draft for review. No message has been sent and no game has been submitted.

## Game summary

Perfectly Suspicious is a silent word deduction game for 3 to 8 people. In each match, most players see a secret word and one sees only its category. Everyone types a single clue of 2 to 20 letters during two timed rounds. Clues reveal simultaneously. Players then vote privately. The exact answer and prepared obvious clues are rejected. There is no voice or image upload. Separate text chat is available only between cases and is blocked by the server during every active phase. Guided practice is explicitly scripted and uses separate content. Live gameplay needs at least three humans.

## Decisions needed

1. Does the SDK disableChat setting apply to the mandatory timed clues in this game? If so, should the game be unavailable when that setting is enabled, or is a prescribed alternative required? The local SDK preview currently blocks entry and hides room content when this setting is true. This is provisional.
2. Should this game follow Basic Launch or direct Full Launch, given the three person minimum and optional scripted practice? Please confirm the applicable account and Friends integration requirements for that route.
3. Is the proposed explicit filtering of player names and clues sufficient for initial review, and what reporting or moderation controls are required? The current word lists are prototype content and are not presented as complete moderation.
4. Which mobile environments must be included in this submission, and are there any platform requirements specific to simultaneous timed text entry?

## Integration prepared

Local SDK preview supports guest entry, startup invitations, Instant Multiplayer, live invitation callbacks, same room replay, room capacity reporting, copied platform invite links, gameplay start and stop, SDK failure recovery and settings propagation. Browser fixtures use controlled SDK responses and the running multiplayer service.

Verified platform identity, complete platform profile display, a hosted HTTPS and WSS backend, portal verification, physical device evidence and final preview footage remain pending. No ads, purchases or durable account progress are implemented.

## Hosting inputs still needed

Record the chosen hosting provider, backend hostname, region, operating owner and allowed client origins before deployment. The current room service uses one process and in memory state. A restart ends sessions. The client bundle alone does not host multiplayer rooms.

## Review record

QA response date: Pending.

Confirmed launch route: Pending.

Confirmed clue setting behavior: Pending.

Required moderation and account changes: Pending.

Portal and device evidence: Pending.
