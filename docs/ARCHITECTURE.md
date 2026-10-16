# Architecture and UI flow

Phase 1 completed on 10 October 2026. Local development only. No platform approval or deployment has occurred.

## Stack and components

Node 24 with native ESM. A pure JavaScript engine accepts explicit time and injected random selection. The server uses the native HTTP module and ws for transport. Vanilla HTML, CSS, and browser modules keep the client small and the build free of a framework runtime. Exact dependency versions and package lock pin inputs. Node test runner provides engine and service tests. Playwright provides scripted browser tests. No LLM evaluator is included.

1. core/engine.js owns phases, deadlines, roles, history, voting, scoring, and authorized views.
2. core/validation.js owns explicit normalization and rejection rules.
3. server/content.js contains curated answers and forbidden clues. It is never shipped in the client bundle.
4. server/service.js owns membership, bearer identity, reconnects, request limits, and room matching.
5. server/main.js serves only public files and transports authorized snapshots over WebSocket.
6. public/app.js manages browser state and local drafts. public/views.js renders the game menu, entry dialog, suspect board, private file, and results. public/art.js supplies original vector portraits. None make scoring or role decisions.
7. public/platform.js isolates CrazyGames SDK behavior from local play.
8. public/practice.js supplies a clearly labeled scripted example with separate content and no live scores.
9. server/platform-preview.js starts a separate loopback SDK review server. Its explicit configuration override does not alter the normal client build.
10. public/audio.js synthesizes the original score and action cues using Web Audio. It controls activation, preference, platform mute, page visibility and bounded scheduling independently of game state.

Production randomness uses node:crypto randomInt and randomBytes. Tests inject a fixed selection function and virtual clock. There is no production test endpoint for changing time, answers, or roles.

## Protocol

Client sends JSON objects with type, requestId, and payload fields. Supported requests are create, join, quick, resume, configure, start, reset, clue, vote, chat and leave. Room and player identity come from the authenticated connection, not a claimed actor in the message. clue and vote require the current matchId and phase. create and join accept a display name of 2 to 18 plain letters and spaces. configure accepts cases and roundSeconds only from the authenticated host in the lobby. Server bounds are 1 to 10 cases, 1 to 5 clue rounds and 10 to 60 seconds per player. Snapshots expose settings, caseNumber, round, turn order, current turn and seriesComplete. Validation failures return a code and authored message, never internal exception text.

Server messages are welcome with the current client's token, snapshot with state version and role filtered data, and ack with requestId, success, and message. Snapshots contain serverNow and deadline for display only. Clients ignore older versions and request a fresh connection snapshot after transport failure. Client countdowns do not change the server clock. Duplicate request IDs are bounded and remembered for the lifetime of a seat so reconnect cannot repeat mutations.

Only one current socket controls a seat. Resume replaces the old transport without treating the displaced socket closure as a new disconnect. Inactive participants retain their seat and history during grace and cannot create a new role by resuming. Each room session is in memory; production scaling requires sticky room ownership or shared authoritative storage and is outside the local prototype.

## UI flow

The title screen is a game menu inside the detective room. Quick play, private room, join, and guided practice are immediate menu choices. Player name and room code are collected in a native modal dialog only after choosing a mode. Invitation entry opens that dialog directly. The title screen contains no inline form, promotional sections or website footer. On ordinary phone and tablet screens, it occupies the dynamic viewport without page scrolling. Portrait layouts allocate separate rows to the title, room, menu and player count. Landscape layouts place controls beside the room. The scene absorbs height changes instead of adding fixed blank space. The current fixed console targets a minimum CSS viewport of 320 by 568. The earlier zoom gate has not been reestablished below that effective size.

The current revision replaces the flat evidence presentation with a procedural 3D room rendered by the locally bundled, pinned Three.js dependency. A single reusable WebGL canvas fills the window behind the title and evidence controls. Geometry, lights, shadows and seated characters establish depth. Pointer ray casting activates the same authoritative vote action as each accessible ballot button. The renderer receives only already authorized public view content and cannot choose roles or advance phases. Reduced motion stops character movement and renders on state or layout changes. Hidden documents stop drawing. A failed or lost graphics context keeps the functional HTML presentation available.

Camera framing uses the actual table and character bounds transformed into camera space. Horizontal and vertical field of view independently determine the distance. Landscape title framing reserves space for controls with an off center projection. Portrait framing removes that offset. The renderer and camera use the measured canvas rectangle and update after orientation or size changes. The table retains the same physical proportions when turned for a narrow board. Deterministic projection and browser geometry assertions cover these properties without grading images.

Room numbers distinguish duplicate names consistently across evidence, voting and results. Server snapshots contain both the original name and a generated display label. The default minimum is three, with the same threshold applied to entry, public queue countdown, rematch and population checks.

Client request identifiers contain sixteen random bytes encoded as hexadecimal, generated with crypto.getRandomValues. This works on the plain HTTP WiFi preview as well as secure and loopback origins. The game does not require crypto.randomUUID, which is unavailable in the ordinary HTTP context used by a phone opening the computer's network address. Session credentials still come exclusively from the server.

Invite copying validates the full URL and uses the SDK generated link in the platform preview. Local loopback links are labeled test invites and explicitly describe their computer only scope. Clipboard writes use the current API, then a compatibility copy operation, then a selectable field when automatic copying is blocked. Selection, drag and context menu gestures are suppressed on scenery while normal text field editing and browser zoom remain available.

Lobby presents an illustrated suspect lineup and empty seats. Each match uses a shared evidence board and a private case file. Suspect cards retain their positions across the clue rounds and vote. One slot per configured clue round begins waiting. Every accepted clue opens immediately and passes the turn. Missed turns display No clue. A submitted clue cannot be changed. Turn order reverses each clue round and the first seat rotates between cases. Voting occurs on the suspect cards. Results identify the suspicious player, show the verdict and point changes, and expose rematch controls. Scripted practice uses the same board language and remains clearly labeled.

The fixed HUD uses a stationary canvas behind a board and a larger case console. Desktop layouts put the console on the right; portrait layouts place it below the room. The console owns the phase heading, identity, current action, persistent chat row and case controls. All suspects remain on the board at once. Compact cards preview recent clues and open a full clue history with a ballot during voting. Stable player identifiers preserve the selected suspect across snapshots, including duplicate names. A phase change closes the inspector. Rules and scores use bounded pages. There is no suspect pagination, clue round dropdown or scrolling game panel. Chat inputs remain visible and become disabled during every active case phase; the server enforces the same restriction. The FixedHUD controller owns presentation and dialog focus only. It never controls game outcomes. Snapshot updates preserve drafts and focus. All game decisions and deadlines remain server authoritative. The mobile console fits its content and collapses empty message and notification space. Portrait camera framing depends on the viewport rather than the changing console height. The camera has no scroll handler and buffer dimensions change only with viewport size or pixel ratio. Native dialogs contain focus and support Escape. Notifications use an atomic polite status region without moving keyboard focus. A floating notification region is separate from the console layout. It uses the first clear gap near the top of the room when the message fits and compact spacing when necessary. Crowded phone layouts redistribute existing row gaps to keep a permanent lane for short notices without shifting controls when a message appears. If a larger message cannot fit any gap, the largest gap is the fallback. With the keyboard open it sits near the console bottom, below the editing controls. A new message replaces the previous message and resets its six second lifetime. Only opacity animates; reduced motion skips that animation. The strip collapses when empty. The timer does not announce ticks. Reduced motion disables ambient and transition animation.

There is no top header or navigation bar. A corner settings button opens sound and motion controls. Raised action controls use gradients, borders, press feedback and text labels. Bungee and Barlow font files and their original licenses are bundled locally. The base layout remains in style.css; gamefeel.css supplies the more expressive game presentation. Audio scheduling uses a short lookahead, stops scheduled voices when muted and skips missed time after suspension. It never changes room deadlines or role information.

Source for the contrast calculation: [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).

## SDK review flow

The normal client selects the local adapter. The separate SDK preview initializes the real loader before entry, accepts startup invite parameters and live room callbacks, creates a guest seat for Instant Multiplayer, and uses the platform invite link API. Guest names remain server validated. A room transition resumes an existing session when needed, leaves its previous room, then joins the target. Repeated callbacks are serialized and a request for the current room preserves the seat. Practice results and match results stop gameplay reporting.

The preview has bounded startup waits and an explicit reload screen on SDK failure. Its provisional restricted setting screen prevents room entry and clears an active local session when disableChat becomes true. This behavior remains subject to QA confirmation. Full platform identity and profile display are not implemented by this guest preview. Tests replace the external SDK script response while running the production loader, UI and multiplayer transport.

## Requirement mapping

| Requirement group | Implementation | Gate |
| --- | --- | --- |
| Game rules and no repeat answers | core engine and server content | Phase 2 |
| Moderation and clue probing | validation and per seat attempts | Phase 3 |
| Secrecy, deadline, reconnect, room ownership | engine snapshots and service | Phase 4 |
| Screen sizes, copy restrictions, keyboard, reduced motion | public UI and browser tests | Phase 5 |
| Low population, clear practice, invitation, group replay | matching service and practice | Phase 6 |
| Guests, genuine gameplay signals, invite bridge | platform adapter | Phase 7 |
| Relative assets, small bundle, no server secrets | build and package checks | Phase 8 |
| Profiles, chat settings interpretation, QA route | external answers plus adapter | Phase 7 blocked until verified |
| Real mobile app, Chromebook, portal preview | specified physical or external environments | Phase 8 blocked when unavailable |
| Artwork rights, honest description, content suitability | release checklist and original assets | Phase 8 deliverables |
| Actual submission and approval | authorized portal operation | Phase 9 external |

## External question register

Unanswered: whether mandatory clues must be disabled by the platform chat setting, the required multiplayer launch route, permitted group assembly onboarding, and precise moderation/reporting expectations. These do not block local engine or browser implementation. They do block asserting platform readiness. No representative has been contacted.

## Test and evidence contract

Use npm run test:engine, test:validation, test:server, test:ui, check, and build. Unit suites use exact input/output assertions. Browser fixtures control the clock and server randomness in a separate test harness process that is never the production entry point. Reports live under test-results; phase status is summarized in PHASE_LOG.md. No screenshots are judged for aesthetics. Browser binaries and software versions are recorded with results.

## Speech bubbles and score arrangements

The room owns a bounded map of one message per member and the authoritative send times. Every request uses the authenticated session and passes a phase gate, cooldown and validator before broadcasting. Snapshots omit chat during active gameplay and omit expired messages. The client uses the server clock offset to fade existing bubbles without restarting their lifetime on snapshot refresh. The renderer positions them above the corresponding character. Text is escaped, drafts and input selection survive other players' updates, and no chat transcript is stored.

Audio selects one of four fixed musical arrangements from public phase state. Longer variations add melody changes and quieter harmonic layers. Notes are scheduled from the audio clock; changing phase never changes the server clock or gameplay state. The existing master mute, hidden page pause and SDK audio priority apply to every arrangement.


The phone and tablet case console uses a Room menu for Rules, Scores, Invite, Leave and Settings. The current action and chat input stay directly visible. Its latest message readout uses the server message sequence to select the newest public message, retains it after the transient message expires, and clears on an active case or room change. At widths up to 1100 CSS pixels or with a coarse primary pointer, overhead bubbles are hidden and the full latest message appears in the console in either orientation. The pointer condition includes wide tablets. Larger desktop layouts retain overhead bubbles. UI measurements include actual wrapped text, maximum length messages, card separation and touch targets rather than only container dimensions. Compact previews can ellipsize long text because their direct inspector exposes the full name and every clue without pagination. Snapshot focus restoration includes room menu controls and the stable identity of each suspect card, as well as inputs and ballots.


The service defaults publicMatchmaking to false. The main server enables it only when PUBLIC_MATCHMAKING is true and emits the authoritative value through config.js. While disabled, direct queue requests, public room joins and public room resumes are rejected. The preserved queue and countdown run when explicitly enabled. Private create, code entry, invitations and guided practice remain available. The home menu promotes private creation while the queue is disabled.


## Separate frontend hosting

The Vercel configuration runs npm run build:web and publishes dist/hosted/client. This build requires GAME_BACKEND_URL, normalizes an HTTPS or WSS address to the secure /play endpoint and generates a public config.js without altering public/config.js. Only backendUrl, platform and publicMatchmaking enter that file. Local review builds still use dist/0.1.0/client and the same origin configuration. The manifest hashes describe the actual generated files.

Render runs server/main.js as one Node 24 service. ALLOWED_ORIGINS lists the permitted frontend origins for WebSocket upgrades. Rooms remain in process memory, so no autoscaling or persistent room recovery is claimed. Frontend PUBLIC_MATCHMAKING is a build setting; the independent backend switch still enforces access. Both default to false. See DEPLOYMENT.md for the account setup and final hosted check.
