# CrazyGames submission process and developer lessons

Research checked: 10 October 2026.
Game: Perfectly Suspicious, a word-only multiplayer deduction game.
Companion: [Official requirements and project checklist](CRAZYGAMES_REQUIREMENTS.md).

## Evidence and limits

**Official** sections summarize CrazyGames documentation. **Developer report** sections describe personal experiences, not verified explanations from the review team. **Our takeaway** sections are recommendations for this project.

Rejection before Basic Launch and failure to progress after a public test are different outcomes. Completing a checklist, installing the SDK, or achieving one good metric does not guarantee approval. Do not interpret comments from other developers as unpublished platform policy.

## 1. Prepare a reviewable game

**Our preparation checklist:**

- [ ] Finalize clue/voting rules, including ties, absent players, deadlines, and scoring.
- [ ] Complete one match and replay with a real group.
- [ ] Test an unfamiliar player arriving alone, not just invited friends.
- [ ] Validate private clues, hidden roles, and simultaneous reveals over the network.
- [ ] Complete the companion requirements checklist.
- [ ] Freeze a version identifier and keep the matching client/server builds available.
- [ ] Record known limitations honestly and resolve progression-blocking issues.
- [ ] Keep a concise change history for any later resubmission.

Do not use platform review as the first multiplayer test. Our intended silent-play experience must work without someone explaining it on a call.

## 2. Assemble the submission

Use the [CrazyGames Developer Portal](https://developer.crazygames.com/).

Prepare the web build, description, controls, covers, and preview footage. Test the uploaded build in the portal preview before submitting. Reviewers evaluate function, content, and quality; a successful upload is not acceptance. SDK integration is optional for Basic Launch and required for Full Launch, subject to the chosen route.

Source: [Submission and preview FAQ](https://docs.crazygames.com/faq/).

Use the exact dimensions in the companion guide; inspect the portal for any current additional fields.

Source: [Artwork specifications](https://docs.crazygames.com/requirements/game-covers/).

**Suggested reviewer note, to adapt only when true:**

> This is a silent multiplayer word deduction game. Most players receive the same word; one does not. Everyone receives the same broad category. Players privately submit one word clues in two timed rounds, with simultaneous reveals, then vote. Please advise how the chat disabled setting applies to this core clue input. Minimum players: [confirmed number]. Room/testing instructions: [actual instructions]. Backend availability: [actual status].

Do not claim bots, a tutorial, moderation, or mobile support before implementing and testing them.

## 3. Determine the multiplayer launch route

Ask QA which route suits the finished game and explain the minimum player count and low-population behavior. Some audience-dependent multiplayer titles may bypass Basic Launch; that decision belongs to QA and requires full integration. Do not assume a private-room game automatically qualifies.

Source: [Multiplayer launch route](https://docs.crazygames.com/requirements/multiplayer/).

## 4. Initial review, then the appropriate launch stage

**Official:** QA reviews the submission. The usual route is Basic Launch followed by selection for Full Launch. Selection depends on quality and engagement, not submission order. Basic Launch does not monetize; Full Launch requires the relevant SDK integration and further review.

Source: [Launch overview](https://docs.crazygames.com/).

If rejected, identify the stated issue, make meaningful improvements, and resubmit through the permitted workflow. A second review or launch opportunity is not guaranteed. Keep questions specific and attach a version/change summary wherever the portal or support channel allows it.

Source: [Rejection and resubmission FAQ](https://docs.crazygames.com/faq/).

## 5. Understand Basic Launch metrics correctly

**Official:** the test ends after both seven days and 500 plays, or after 21 days if the play threshold is not reached. The dashboard updates daily; Day 1 retention has an additional delay. Updates can be made during testing.

The current guide defines:

| Metric | Meaning |
| --- | --- |
| Average play time | Time spent per session |
| Day 1 retention | Share returning the next day |
| Conversion | Share playing for at least one minute after starting |

The guide mentions 10+ minutes, 10–15% retention, and 80%+ conversion as examples of strong performance, not universal guaranteed acceptance thresholds. Follow the current dashboard and QA guidance.

Source: [Basic Launch metrics guide](https://docs.crazygames.com/resources/basic-launch-metrics/).

**Important distinction:** thumbnail click-through rate measures a different step from the current guide's gameplay conversion. Do not substitute one for the other when reading older posts.

**Our instrumentation proposal:** track room wait, first accepted clue, completed match, replay, disconnect, and failed submission. Diagnose where people stop before changing the whole design. Do not manufacture playtime with long timers or mandatory waiting.

## 6. What developers reported

### A. Plenty of impressions did not produce playable multiplayer rooms

**Developer report, September 2026:** a multiplayer artillery developer reported acceptance into Basic Launch, substantial impressions, but poor engagement because players could not find opponents. They also found progression bugs after real users arrived. Adding bots and submitting again reportedly did not lead to another approval.

This is the developer's account; its impression counts and theory about scoring are not official benchmarks.

**Our takeaway:** test sparse traffic before submission. For this social game, bots are not automatically a good substitute for people. Options to evaluate include a clearly identified practice experience, a genuinely workable small-room mode, or a QA-agreed multiplayer launch plan. Do not add simulated players that pretend to be real people, and do not assume these options guarantee acceptance.

Source: [Developer's failed Basic Launch account](https://www.reddit.com/r/IndieDev/comments/1woa2wx/our_crazy_games_basic_launch_failed_heres_what_we/).

### B. Adding features and an SDK did not resolve a vague quality rejection

**Developer report, April 2025:** a puzzle developer described a rejection, then adding levels, polishing graphics, improving listing art, and integrating the SDK. The next submission reportedly received another generic rejection.

The actual review team's detailed reasoning was not available in this account.

**Our takeaway:** more content and SDK integration are not substitutes for a compelling first minute. Ask unfamiliar testers whether they understand the bluffing objective, enjoy the first reveal, and want a second match.

Source: [Puzzle developer's repeated rejection report](https://www.reddit.com/r/gamedev/comments/1k5otdv/anyone_have_experience_publishing_games_on_web/).

### C. Basic Launch still had a quality bar

**Developer report, April 2026:** the Color Spin creator reported two rejections. A community reviewer criticized unfamiliar controls, sluggish feedback, simple visuals, and a weak distinguishing hook. That commenter explicitly was not a portal reviewer.

**Our takeaway:** use the feedback as a testing hypothesis, not a confirmed rejection diagnosis. Our game should make the two simultaneous reveals and social deduction easy to understand, with responsive inputs and readable clue cards.

Source: [Color Spin rejection and community feedback](https://www.reddit.com/r/gamedev/comments/1ssmext/my_game_uploaded_to_crazygames_was_rejected_what/).

### D. The listing failed to explain the game

**First-person development report, June 2026:** Cyber Gomoku's developer reported weak early click-through and revised the cover to show the board and distinctive abilities. They also added goals because players lacked a clear reason to continue. The article describes changes and hypotheses; it does not establish a controlled causal improvement or guaranteed approval.

**Our takeaway:** communicate word clues, suspicion, and voting in the listing. Avoid a cover that suggests an unrelated action game. Make replaying with the same friends obvious after the reveal.

Source: [Cyber Gomoku development report](https://www.cybergomoku.com/en/articles/crazygames-metrics-improvements).

## 7. Mistakes to avoid, with evidence strength

| Mistake | Evidence | Action for this game |
| --- | --- | --- |
| Assuming first QA acceptance guarantees Full Launch | Official staged process | Treat QA and audience performance as separate milestones |
| Expecting guaranteed repeat launches after failure | Official selection process plus report A | Submit a stable, tested experience first |
| Assuming traffic means simultaneous opponents | Developer report A | Test empty and sparse lobbies |
| Treating extra levels or SDK installation as a quality fix | Developer report B | Observe first-time players and fix demonstrated friction |
| Treating peer criticism as the confirmed rejection reason | Developer report C | Separate hypotheses from official feedback |
| Confusing thumbnail clicks with gameplay conversion | Current metrics guide versus report D | Label metrics and measurement dates |
| Ignoring whether the core clue input counts as chat | Unresolved application of official rules | Get QA guidance; implement moderation |
| Freezing when an ad cannot load | Explicit official ad requirement | Test disabled, blocked, failed, and completed ads |
| Using misleading covers or a mismatched game identity | Official quality guidance | Show the actual deduction experience |
| Resubmitting an unchanged build repeatedly | Official FAQ calls for meaningful improvements | Preserve versioned changes and test evidence |

For the last two official topics, see [ad requirements](https://docs.crazygames.com/requirements/ads/) and [quality guidance](https://docs.crazygames.com/requirements/quality/). The source sections above support the other rows.

## 8. Our final pre-submission rehearsal

These are project recommendations, not extra platform rules.

1. Give an unfamiliar tester only the game link; do not explain the rules aloud.
2. Have them join alone, join an invitation, and rejoin after a connection loss.
3. Play both informed and suspicious roles on desktop and a phone.
4. Submit allowed, prohibited, malformed, empty, and last-second clues.
5. Confirm no player's clue appears before the reveal.
6. Run both clue rounds, voting, ties, results, and another match.
7. Check room behavior when someone leaves in each phase.
8. Test guest identity and platform account integration for the chosen stage.
9. Repeat in the actual portal preview with production backend settings.
10. Record failures and fix them before the submission.

Also run the accepted project checks in [the development plan](DEVELOPMENT_PLAN.md): a shared category without answer leakage, no repeated answers within a session, bounded generic validation feedback, keyboard operation, text alternatives to color, usable zoom, accessible labels, and reduced motion. These are fixed scenario checks, not LLM graded evaluations.

## 9. Do not turn anecdotes into rules

- No verified universal retention/playtime score guarantees approval.
- The current public guide is more reliable than an old forum threshold.
- No source here proves our particular game will be approved or rejected.
- A reported failed resubmission does not prove resubmission is forbidden.
- A game working in our browser does not prove it works in the platform iframe or app.
- None of the sources says our blocked-clue list alone satisfies content moderation.

## 10. Submission record to complete later

| Field | Value |
| --- | --- |
| Build/version | Not submitted |
| Backend version | Not deployed |
| Portal preview tested | Not yet |
| Minimum/maximum players | To decide |
| QA guidance on clue input | Not obtained |
| QA-selected launch route | Not obtained |
| Review date/result | Not submitted |
| Changes since previous review | Not applicable |
| Next action | Build and test the agreed rules |

No game was submitted and no developer or platform representative was contacted while preparing this guide.

