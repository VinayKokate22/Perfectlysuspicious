# Perfectly Suspicious

A browser party game for 3 to 8 people that can be played without sound. One player sees only a category. Everyone else sees the secret word. Players take turns submitting clues that appear immediately, followed by a private vote and individual scoring.

The host opens Game rules in the lobby to choose 1 to 10 cases, 1 to 5 clue rounds per case and the time each player gets in each clue round. Defaults are three cases and two clue rounds with 20 seconds per player. Save changes before starting. Each case has a new word and one vote. Points accumulate across cases. Accepted clues are final, missed turns pass automatically and turn order reverses each clue round. The first seat rotates between cases.

## Run locally

Use Node 24. From this folder:

```powershell
npm ci
npm start
```

Open http://localhost:3000. Guided practice works alone. For a live game, create a room and join its code from at least two other independent browser contexts. Use separate browser profiles or separately opened tabs. Duplicating a tab can duplicate its session token and replace the original connection.

The server now listens on all IPv4 interfaces by default, so the PC and phones share one room list. On a phone connected to the same WiFi, open the computer's WiFi IPv4 address on port 3000. The address observed during this session is http://192.168.1.11:3000 and may change with the network. Keep one normal game server running. A second normal startup on the same port exits with a clear message. HOST can be explicitly set for a different binding. Friends outside this network still need a reachable hosted backend. No service has been deployed.

Opening localhost uses Copy test invite and explains its computer only scope. Open the WiFi address when sharing links between devices, or enter the room code manually. Clipboard failures offer a selectable invitation instead of claiming success. Game scenery cannot be selected or dragged; text fields keep normal editing and copy controls.

## Share a friends test

Follow [Vercel and Render deployment](docs/DEPLOYMENT.md) for the selected setup. The supplied vercel.json builds the frontend with npm run build:web and render.yaml defines one multiplayer server. Both connect to the same GitHub repository. Set GAME_BACKEND_URL on Vercel and ALLOWED_ORIGINS on Render as described in the guide. Open matchmaking stays disabled on both. No external hosting has been created.

[Friends test hosting](docs/FRIENDS_TEST.md) also describes serving the complete application from one Node service. Use one backend instance because room state lives in memory.

## Review the SDK integration locally

Run npm run preview:platform and open http://localhost:3001. This separate preview loads the real CrazyGames SDK in its local environment and uses guest seats. The normal game at port 3000 does not load the SDK. Both commands can run together.

The preview connects invitations, Instant Multiplayer, room reporting and gameplay events. It does not enable publication or verified platform identities. Its provisional response to a disabled chat setting is to block game entry until the final clue policy is confirmed by QA. See docs/PLATFORM_GATES.md and release/QA_HANDOFF.md for outstanding decisions.

## Check the game

```powershell
npm test
npx playwright install chromium
npm run test:ui
npm run check
npm run build
npm run test:release
```

Browser tests run their own loopback server on ports 3911 and 3912. They use an explicit server clock and fixed role selection. Production uses cryptographic randomness and real deadlines. The zoom fixture installs an extension only into an isolated temporary test browser. It does not modify your browser.

The build copies only public client assets into dist/0.1.0/client and writes a file size and SHA256 manifest beside them. It does not include secret answers or the multiplayer server. The release check runs all suites against this built client. Platform release profiles remain locked until the gates in docs/PLATFORM_GATES.md are resolved.

## Implementation notes

Scores and rooms live in server memory. Restarting the server ends sessions. Open matchmaking is disabled by default. Create a private room and share its invite or room code. The public queue is preserved behind the PUBLIC_MATCHMAKING setting, which must be true on the server to restore Quick play. Direct public queue requests are rejected while it is disabled. Empty rooms expire. Clue attempts are bounded, secret related rejection messages are identical, and reconnecting preserves accepted entries and attempt counts.

The current English pack contains 42 answers. Filtering uses explicit lists, not language model judgments. A short profanity list is a prototype control and needs content review before a public audience. The interface uses original SVG and CSS artwork and locally bundled Bungee and Barlow fonts with their licenses.

The game fills the scene without a top navigation bar. A corner settings button controls sound and motion. Original music and short action sounds start after interaction, pause in hidden tabs, and obey the platform mute setting. Muting preserves every gameplay cue in text and graphics. Reduced motion disables the ambient lights, portrait motion, reveals and timer pulses.

The menu and matches now use a real WebGL investigation room with a table, seated characters, lighting and shadows, built with the pinned Three.js renderer. Suspects can be selected in the scene during voting; named buttons remain available for keyboard operation. Evidence and controls remain HTML for readable text and accessible input. Devices without WebGL retain functional controls. This fallback is not the intended visual presentation.

The eight original suspects have rounded block proportions, articulated seated limbs, expressive faces and individual hair, hats and accessories. Layered coats include lapels, collars, cuffs and pocket details, with separate cloth, skin, leather and metal finishes. They blink, breathe and move their heads, with a subtle nod while speaking. Reduced motion holds a neutral pose. Models share cached geometry across room updates, while each player's animation stays independent. Camera framing and chat anchors account for the actual character and hat dimensions.

The detective lounge adds parquet flooring, paneled walls, a book cabinet, a framed evidence board with physical strings, a deep city window, leather seating and plants. The walnut table has a layered rail, brass inlay, cloth surface, patterned rug and detailed case files and coffee cups. A desk fan, clock hand, gentle pendant movement and translucent coffee steam animate around the characters. These details obey reduced motion and page visibility. Static room pieces are merged by finish, and table and place setting geometry is reused across room updates.

The room uses one stationary canvas across the game window. The closer camera keeps characters and furniture prominent without stretching them. A larger case console contains the heading, private identity, current action, persistent chat row, room controls and quiet notification area. Every suspect remains visible without Next or Back paging. Compact cards show recent clues and open directly to the full clue history and ballot. There is no clue round selector or scrolling overlay. Rules use bounded guide pages. Completed cases show a visual vote board and a separate leaderboard with total points and points gained in the case. A compact room menu keeps secondary controls out of the phone and tablet play area. On phones and tablets, chat appears only in the console, with three recent messages and the full latest message and sender name visible in either orientation. History opens the complete earlier messages. Desktop layouts retain overhead speech bubbles. The readout clears when a case starts. Empty chat and notification space collapses, and the mobile console fits its content while the camera stays stationary. Standard buttons share a 48 pixel height. Room notifications float separately over the scene, using open space between the evidence rows when available. The temporary card has clearer text and no UPDATE label. Showing or clearing it does not change console height or move game controls. With a phone keyboard open it uses the space below the editing controls. Messages wrap and fade after six seconds. Reduced motion skips the fade. Notifications never take keyboard focus or act as buttons. Chat sending remains locked throughout a live case to prevent clue leakage. Focus and drafts survive snapshot updates.

Buttons and panels share the characters' chunky construction through beveled faces, brass edges, inset paper, raised shadows and original game icons. Background lighting connects the controls to the room. The room backdrop and menu shading use the original dark blue palette with slightly deeper shading. The nearly opaque gathering and case heading panel shares the briefing panel's raised border, inset trim and surface. Lobby actions have a clear gap, clue submission uses a full width button in narrow panels, and phone room controls occupy separate aligned slots. Phone, tablet and laptop controls have larger touch targets with consistent spacing. The main menu is wider on laptop windows with taller actions and larger labels, while short windows retain compact controls. Entry dialogs keep their native focus behavior and use a brief fade and slide that never shrinks touch targets.

Live rooms support three to eight people. Duplicate names receive stable visible numbers such as Alex (1) and Alex (2). Names are preserved separately from the display labels, and scores, clues and votes remain keyed by private player IDs.

Run npm run build:covers to regenerate the three detective cover drafts. Their source, PNG exports and checked metadata are in release/covers.

Read PHASE_LOG.md for actual phase status, docs/GAME_SPEC.md for rules, and docs/TEST_EVIDENCE.md for coverage and limits. CrazyGames approval, real device compatibility, public population quality, and enjoyment have not been established by these tests.

Chat is available in the lobby and after a case. Each player has one speech bubble lasting seven seconds, with a slow fade over the final two seconds. The server locks chat throughout clue entry, reveals and voting, clears old messages on match start, limits messages to 80 characters, and enforces a three second cooldown. Explicit text filtering is a prototype moderation control, not a complete public moderation system.

The original score now has separate lounge, investigation, accusation and celebration arrangements with longer musical variation. All tracks share the sound toggle, page visibility pause and platform mute behavior.

Music gain is 35 percent higher than the previous revision. Action cues keep their previous gain through a separate music bus; both still obey the same master mute.
