# Platform gates

The local game is under deterministic verification. It has not been submitted or approved. The project is not yet a public release candidate.

## Required decisions and environments

1. Clarify with CrazyGames how the platform chat disabling setting applies to mandatory timed single word clues. The public rules do not explicitly settle this case. Do not assume an exemption.
2. Confirm the appropriate Basic Launch or multiplayer Full Launch review route. The draft starts with guests and no monetization.
3. Confirm moderation and reporting expectations for player names and clues. The current explicit word filter is only a starting point.
4. Select and operate a reachable HTTPS and WSS backend, its allowed browser origins, region, capacity, and ownership strategy. The current service uses one process and in memory rooms.
5. Use the developer portal preview and the real supported mobile environments to perform the scripted connection, keyboard, safe area, and SDK checks.
6. Complete Full Launch identity integration and platform profile handling if that route is selected. Room bearer tokens are game session credentials, not verified platform account identity.

No external contact, hosting purchase, or submission has occurred. These dependencies keep the platform release gate open. Independent preparation may continue.

## Profiles

Local is enabled and uses the local service without SDK traffic. Basic is a draft profile with monetization disabled. Full is a draft profile requiring resolved identity and platform behavior. The build rejects a platform profile while these required decisions remain unresolved.

An SDK review preview is available through npm run preview:platform at http://localhost:3001. The preview server binds only to loopback, overrides config.js explicitly, and selects the Basic adapter. The browser also refuses this preview on a nonlocal hostname. It uses guest room credentials and is not a Full Launch identity implementation. The normal build and port 3000 continue using the local profile.

The application now connects SDK startup invitations, Instant Multiplayer, live room join callbacks, room capacity reporting, copied SDK invite links, gameplay transitions and practice results. Invitation entry resumes an existing seat before switching rooms and serializes repeated requests. Missing rooms return to a populated join dialog; failed SDK initialization offers reload. SDK calls have bounded initialization deadlines.

Until QA confirms C05, the SDK preview uses a provisional restrictive behavior: disableChat prevents all game entry, and a setting change hides existing room content, clears the local session and closes its connection. The normal server disconnect grace applies. Restoring the setting returns to the menu without automatically rejoining. This conservative preview behavior is not an agreed release policy or a substitute for QA clarification.

Deterministic browser fixtures replace the external SDK response while exercising the real application and local multiplayer server. Separately, the actual SDK initialized in its local environment on 10 October 2026 and showed the game menu with no captured page errors. That observation does not verify the portal or mobile app.

Ads and durable account progress are absent. Ad lifecycle and save conflict tests are not applicable to this prototype. This does not exempt applicable identity, room, chat, or guest requirements at release.

Optional music and action cues now follow the SDK muteAudio setting. Platform mute silences the master output, stops scheduling and disables the local sound toggle until the platform permits audio again. Local preferences and page visibility also control playback. This sound setting is independent of the unresolved clue interpretation.

## Official references checked 10 October 2026

The SDK requires initialization before module calls. See [SDK introduction](https://docs.crazygames.com/sdk/intro/). Room reporting, invite parameters, live join callbacks, settings, and gameplay events are described in [Game module](https://docs.crazygames.com/sdk/game/). The friend flow and Instant Multiplayer expectations come from [Multiplayer requirements](https://docs.crazygames.com/requirements/multiplayer/).

The requested social chat now has an explicit server phase restriction, cooldown, message length limit, deterministic filtering and expiring speech bubbles. It is available only between cases. The existing restrictive SDK preview gate prevents social chat when disableChat is true. The separate question about mandatory clue entry remains unresolved. Moderation and reporting sufficiency still need platform review. No external QA message has been sent.
