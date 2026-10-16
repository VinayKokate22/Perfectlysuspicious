# Draft questions for CrazyGames

Prepared locally. This has not been sent.

We are developing Perfectly Suspicious, a silent multiplayer deduction game for 3 to 8 people. Every player sees a category. One player does not see the secret word. Everyone privately submits a single related word. Accepted clues reveal simultaneously after a timer, twice per match, followed by private voting.

The clue field accepts 2 to 20 English letters. Exact answers, prepared obvious clues, personal repeated clues and an explicit moderation list are blocked. Attempts are limited per player and round. Separate text chat is available only between cases, with an explicit filter, message limit, cooldown and expiring speech bubbles. There is no voice, image upload, or GIF feature. The clue input is the core game action.

1. Does the SDK disableChat setting apply to these mandatory timed clue submissions? If it does, what interaction should the game provide for affected players?
2. For a game requiring three live players, should we use Basic Launch or request review for the multiplayer Full Launch route?
3. Is an optional clearly labeled scripted practice plus direct room entry an appropriate approach for low population periods and Instant Multiplayer?
4. What moderation, reporting and player name controls are expected for this specific single word mechanic?
5. Which guest and platform profile display requirements should this game implement if it has no durable accounts or progress?

The local prototype is playable and has deterministic rule, transport, browser and SDK boundary tests. It has not been deployed, submitted, or approved. We will validate the selected flow in the developer portal before claiming platform readiness.
