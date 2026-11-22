# Confirmed player decisions, 18 November 2026

These later interview decisions take precedence over the original specification's player composition.

- The phrase is the main content. Do not show permanent phrase labels, duplicate counts, badges, timing rows or status markers.
- One primary control changes Play → Pause → Replay. Replay immediately repeats the current phrase.
- Next sits directly beside the primary control and becomes available at phrase completion. Its subtle highlight conveys forward progress without a modal or celebration to dismiss.
- Next marks the current phrase Practised and immediately plays the next. This records practice, not mastery.
- Automatic advancement and simply listening do not mark a phrase Practised.
- A smaller, low-emphasis control on the left immediately resets and plays the current phrase. It does not restart the lesson or erase marks.
- No permanent Previous button, speed selector, playback-mode tabs, phrase timeline or full-recording timeline. Keep these secondary tools in menus or the queue.
- Mobile has a dedicated gesture area between the phrase and controls. Left swipe behaves exactly like Next, including marking Practised and immediate playback. Right swipe plays the previous phrase without changing marks. These gestures do not apply to text selection, queue scrolling or desktop.
- Queue and gear access remain discreet. Word pronunciation remains available by tapping a word. Full-phrase IPA is optional and hidden until requested.
- Prepare a selected or last-used lesson at startup without playing it. YouTube controls buffering and does not support forcing lowest quality through its API.
- Lesson settings allow a user-supplied audio upload, private storage across devices, switching between that audio and the original YouTube source, and a timing offset for trimmed recordings. The app does not extract YouTube media.
- Main practice controls must fit within the viewport. A long phrase may use its own bounded text area; menus and the queue may scroll internally.

The user ended the interview and authorised implementation and deployment of the combined original specification and these decisions.

## Follow-up visual correction

The user rejected the oversized, sparse player, bulky notices and poor option discoverability. The revised layout uses a smaller, cohesive stage and readable text scale. Next remains visible as a secondary action and gains emphasis after phrase completion. Queue and Options have visible text labels. Options groups existing controls into Playback, Practice and Lesson tabs. Inactive range fields stay hidden until a range is selected. Brief notices link to details instead of displaying long explanations on the player.
