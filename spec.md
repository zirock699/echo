# Confirmed updates and precedence

Later requirements below override conflicting parts of the original specification.

- Mobile first. The player fills the visible viewport without page scrolling, including loading, buffering, errors, queue and settings states.
- Text and audio are primary. The visible YouTube iframe is 200 × 200 pixels. Uploaded personal audio uses no video.
- One main button changes Play/Pause/Replay. A quieter restart button restarts the current phrase and plays immediately. Next marks the current phrase Practised and immediately plays the next eligible phrase.
- Mobile left swipe in the gap between text and controls behaves exactly like Next. Right swipe plays the previous phrase without marking. Do not apply gestures to text or the queue.
- Loading and buffering use an indicator inside the main button. Other short playback feedback stays in a fixed metadata row. Detailed errors are available on demand.
- Keep secondary options and full recording position in sheets. Queue is a desktop sidebar and mobile sheet. No unlimited-loop control.
- Normal listening follows the first application (`f69042d`): Continuous playback, original source cues, zero lead-in, no automatic cut at cue ends. Manual/Automatic remain explicit shadowing modes. Unedited generated lessons recover once with backups; deliberate transcript edits are preserved.
- Preserve Manual, Automatic and Continuous modes, supported speeds, lead-in, speaking pauses, phrase editing, IPA corrections, filters, progress, collections and private audio uploads.
- Prepare the last-used or selected lesson on startup without autoplay. YouTube controls actual buffering and quality; do not promise forced lowest quality or guaranteed preloading.
- Adapt phrase typography to available space; keep a readable minimum and preserve unusually long or enlarged text within its own reading area.

## Source and verification

This repository contains the recovered published source plus the mobile layout update. Source tests and build pass. Earlier browser checks measured 200 × 200 video, no page overflow at 320 × 568 through desktop sizes, and identical control positions in ready, buffering and stalled states. The reconstructed export has not had a new browser run. Streaming remained stalled in the test browser. No production lessons or audio are included.

Approved visual references: [desktop](docs/reference-desktop.png), [mobile](docs/reference-mobile.png). Older screenshots in docs/screenshots show the earlier larger-video revision.

---

# ECHO STUDIO
## Master Development Specification and Implementation Prompt

### Your role

Act as a senior full-stack software engineer, product architect, UI/UX designer and quality assurance engineer.

Your task is to **design, build, test and deploy a complete, production-quality application called Echo Studio using ChatGPT Sites**.

You are responsible for making appropriate technical decisions, writing the application code, integrating the required services, implementing data persistence, creating a polished user interface, testing all functionality and deploying the result.

**Do not produce only a plan, prototype, design mock-up or collection of disconnected components. Build the complete working application.**

The requirements below represent final product decisions. Do not restart discovery or ask the user to repeat requirements already defined.

Use sound engineering judgement to resolve minor implementation details. If a technical limitation prevents a particular feature, implement the closest compliant alternative, clearly explain the limitation and never pretend unsupported functionality works.

---

# 1. Product vision

## 1.1 What is Echo Studio?

Echo Studio is a private, personalised speech-shadowing application designed to improve spoken English pronunciation, fluency, rhythm, intonation and confidence.

It takes inspiration from:

- Spotify and YouTube Music for the immersive listening experience, playback controls and personal library.
- Shadowing.tech (https://shadowing.tech/home) for the concept of practising natural speech through imitation.

However, Echo Studio must have its own visual identity and interaction design.

**The central concept is simple: turn a YouTube recording into an interactive, phrase-by-phrase speaking exercise.**

A user imports a YouTube video and a timestamped transcript. Echo Studio divides the transcript into natural speaking phrases and presents them through a music-player-style interface.

The user listens to a phrase, repeats it aloud, replays it if necessary, then moves to another phrase.

The primary objective is to reproduce the original speaker's natural pronunciation, phrasing, sentence stress and rhythm.

## 1.2 Target user

The application is initially intended for one private user.

The user's primary goal is to improve natural British English pronunciation, speaking clarity, rhythm and confidence.

The user regularly practises using interviews, podcasts, speeches, presentations and other recordings.

The application must work comfortably on both desktop and Android mobile devices.

## 1.3 Core product principles

1. **Audio-first, visually focused:** The current phrase is the central visual element, replacing the album artwork found in traditional music players.
2. **Minimal friction:** Import a recording, generate phrases and start practising.
3. **Immersive listening:** Practice should feel more like using a premium music application than working through educational forms.
4. **User control:** Every phrase can be replayed, skipped, edited, looped or revisited.
5. **Persistent learning:** Lessons, progress, preferences and collections survive browser restarts and synchronise across devices.
6. **No unnecessary infrastructure:** Reuse YouTube playback, ChatGPT Sites' native hosting and managed persistence wherever practical.
7. **Real functionality:** Every visible interactive control must perform its advertised action.

Do not implement microphone recording, voice recording, pronunciation scoring or voice-comparison features. These are explicitly out of scope.

---

# 2. Hosting and technical constraints

## 2.1 Preferred hosting

Build and deploy Echo Studio using **ChatGPT Sites**.

Use capabilities provided by the actual Sites environment, including:

- Supported frontend frameworks and server-side functions.
- Managed D1 database for persistent structured data.
- Platform-supported authentication and access restrictions.
- Managed hosting and deployment.
- Platform-supported secrets and configuration.
- PWA functionality where supported.

Before selecting libraries or architecture, inspect the available Sites runtime and current official documentation.

Do not assume arbitrary Python execution, persistent background workers, native mobile APIs or unrestricted filesystem access.

Use a clean, maintainable TypeScript and React architecture where compatible with Sites. If the supported runtime favours another approach, choose the most appropriate implementation.

## 2.2 External services

Keep external dependencies to a minimum.

The expected architecture is:

- **Frontend:** Echo Studio application hosted on ChatGPT Sites.
- **Backend:** Site-supported server-side functions.
- **Database:** Managed D1.
- **Media playback:** YouTube IFrame Player API.
- **Transcripts:** User-imported timestamped transcripts.
- **IPA:** Built-in British English pronunciation resources, with optional external enhancement.

Do not introduce Firebase, Supabase, a separate Node.js server, self-hosted Python services or independent cloud infrastructure when ChatGPT Sites already provides the necessary functionality.

External services are acceptable only where a required capability cannot reasonably be implemented using native services.

## 2.3 Technical feasibility checks

Before implementation, verify:

- ChatGPT Sites' supported frameworks and server runtime.
- D1 bindings and database migration workflow.
- Available authentication and private-site settings.
- Supported static assets and browser APIs.
- YouTube IFrame embedding and playback restrictions.
- PWA installation and service-worker restrictions.
- External HTTP request capabilities.
- The feasibility of optional automatic transcript retrieval.

Record any limitations, but continue implementing all feasible requirements.

## 2.4 Non-negotiable YouTube rules

Use the official YouTube IFrame Player API:

https://developers.google.com/youtube/iframe_api_reference

Comply with:

https://developers.google.com/youtube/terms/developer-policies

https://developers.google.com/youtube/terms/required-minimum-functionality

Requirements:

- Keep the embedded YouTube player visible during playback.
- Maintain at least the required minimum player viewport of 200 × 200 pixels.
- Do not obscure YouTube controls, branding or attribution.
- Do not extract, download, separate or independently stream YouTube audio.
- Do not use a hidden YouTube player as a background audio source.
- Do not bypass advertisements, embedding restrictions or geographic restrictions.
- Use only supported player API operations.
- Respect mobile autoplay and browser media restrictions.
- Do not claim that lock-screen or background playback is available unless verified.

The YouTube video should remain visually secondary to the phrase, but it must still be displayed compliantly.

---

# 3. Application structure

Create a complete application with the following principal areas.

## 3.1 Home

A personalised landing screen inspired by modern music-streaming applications.

Include:

- Continue Listening.
- Recently Added.
- Favourites.
- My Collections.
- All Lessons.
- Search.
- A prominent Add Lesson action.

Show useful information without cluttering the interface.

Each lesson card should include:

- Video thumbnail.
- Lesson title.
- Speaker when known.
- Duration when available.
- Practice progress.
- Favourite status.

Users should be able to open, resume and organise lessons directly from the home screen.

## 3.2 Library

Provide a complete searchable library of imported lessons.

Support:

- Search by title or known speaker.
- Favourites.
- Recently added sorting.
- Collection membership.
- Progress indicators.
- Resume from the last position.
- Rename a lesson.
- Remove a lesson with confirmation.
- Add or remove lessons from collections.

Support custom collections or playlists.

A lesson can belong to multiple collections.

## 3.3 Add Lesson

Provide a streamlined lesson-import experience with:

1. YouTube URL input.
2. Transcript upload or paste.
3. Transcript validation.
4. Automatic phrase generation.
5. Generated phrase preview.
6. Save and begin practising.

## 3.4 Practice Player

This is the primary experience and must receive the greatest design and engineering attention.

The player should feel like the Now Playing screen in Spotify or YouTube Music.

The current phrase replaces album artwork as the dominant visual element.

## 3.5 Phrase Queue

Provide a complete, navigable list of phrases.

On mobile, display it as a slide-up panel.

On desktop, display it as a collapsible sidebar.

## 3.6 Settings

Provide a restrained settings interface covering:

- Theme.
- Playback mode.
- Playback speed.
- Phrase-length preference.
- Automatic pause configuration.
- Lead-in duration.
- Text visibility preferences.
- IPA preferences.
- Accessibility preferences.
- Relevant data and synchronisation controls.

Avoid exposing technical configuration unnecessarily.

---

# 4. Lesson creation and transcript importing

## 4.1 YouTube URL support

Support common YouTube URL formats, including standard watch links, shortened links, Shorts links and compatible embedded links.

Extract and validate the video ID.

Reject invalid links with clear explanations.

Use supported methods to obtain basic metadata, including:

- Title.
- Thumbnail.
- Duration.
- Channel or speaker information when available.

If metadata retrieval is unavailable, provide editable title and metadata fields rather than blocking lesson creation.

Validate video availability and embedding permissions before starting practice wherever possible.

## 4.2 Required transcript formats

Support:

- SRT.
- WebVTT.
- Timestamped JSON.
- Pasted timestamped transcript content.

Automatically detect supported formats where practical.

Accept drag-and-drop and conventional file upload.

Support common timestamp representations, including milliseconds and seconds-based formats.

Create a common internal transcript model with:

- Segment ID.
- Start time.
- End time.
- Text.
- Optional speaker identifier.
- Optional individual word timestamps.

Normalise timestamps to floating-point seconds internally.

Preserve the original transcript for future reprocessing.

## 4.3 Transcript validation

Validate:

- Missing timestamps.
- Negative timestamps.
- End times preceding start times.
- Segments extending beyond the video duration.
- Invalid or unsupported formatting.
- Empty text.
- Duplicate caption segments.
- Unexpected overlapping timestamps.

Some transcript overlaps may be legitimate, especially with rolling automatic captions or simultaneous speakers. Handle them intelligently rather than discarding all overlapping segments.

Allow the user to preview validation results.

Errors must distinguish between problems that prevent import and warnings that can be corrected later.

## 4.4 Global timestamp offset

Provide a way to shift the entire transcript forward or backwards to correct synchronisation.

For example, if the transcript consistently appears 1.5 seconds before the corresponding audio, allow the user to apply a +1.5-second offset.

Show the adjusted timing in the preview.

Prevent invalid negative timestamps.

Store the selected offset with the lesson.

## 4.5 Transcript replacement

Allow the transcript to be replaced without deleting the lesson.

Before applying replacement:

- Validate the new transcript.
- Generate a preview.
- Show the effect on phrase grouping.
- Preserve progress wherever reliably possible.
- Make the most recent replacement reversible.

## 4.6 Optional automatic transcript retrieval

Investigate whether the following library can be integrated safely and compliantly:

https://github.com/jdepoix/youtube-transcript-api

Preferred version for evaluation: 1.2.5.

This is a Python library and may not run directly in the ChatGPT Sites environment.

Automatic retrieval is **optional, not a prerequisite**.

Only implement it if a supported execution environment and a compliant retrieval method are available.

Do not build a fragile workaround using unsupported Python execution, hidden scraping or unreliable browser-side requests.

If retrieval is implemented:

- Allow the user to paste only a YouTube URL.
- Attempt to retrieve an available timestamped transcript.
- Prefer English when appropriate.
- Preserve original timing data.
- Explain when automatic retrieval fails.
- Fall back to manual import.

Never make automatic retrieval failure prevent manual transcript import.

---

# 5. Intelligent phrase segmentation

Echo Studio must convert timestamped subtitle segments into natural, meaningful speaking phrases.

Do not assume individual subtitle segments are suitable practice phrases.

## 5.1 Segmentation principles

Consider:

- Punctuation.
- Natural pauses between segments.
- Sentence boundaries.
- Clause boundaries.
- Speaking rhythm.
- Number of words.
- Overall duration.
- Available word-level timing.

Avoid splitting phrases at unnatural points.

Prioritise natural speaking units over rigid duration targets.

## 5.2 Phrase-length settings

Provide three settings for each lesson.

| Setting | Target duration |
|---|---|
| Short | Approximately 2 to 4 seconds |
| Balanced | Approximately 4 to 8 seconds |
| Long | Approximately 8 to 15 seconds |

Balanced should be the default.

These are guidelines, not absolute rules.

If a natural phrase falls slightly outside the target range, preserve the natural boundary where appropriate.

## 5.3 Segmentation constraints

Never fabricate word-level timestamps.

When a transcript contains only segment-level timing, grouping multiple complete segments is acceptable.

Splitting inside a subtitle segment requires sufficiently accurate word-level timing or explicit manual timing.

If accurate timing is unavailable, preserve the reliable original segment boundary rather than inventing a midpoint.

Clearly distinguish timestamp accuracy from estimated grouping.

## 5.4 Non-speech markers

Exclude non-speech-only segments from phrase practice.

Examples:

- `[Music]`
- `[Applause]`
- `[Laughter]`
- Similar non-speech markers.

Do not remove actual spoken words merely because a caption also contains a non-speech annotation.

Preserve the original recording timeline.

## 5.5 Regrouping

Allow users to change a lesson between Short, Balanced and Long grouping.

Before applying a new grouping:

- Generate a preview.
- Preserve manual corrections where possible.
- Match existing practice progress to the new phrases.
- Flag uncertain progress matches.
- Allow undoing the change.

---

# 6. Phrase editing

Editing must be available directly from the phrase queue.

Do not force the user into a separate complex editing application.

Provide contextual editing actions for:

## 6.1 Correct text

Allow the user to correct transcription mistakes.

Preserve phrase timestamps unless specifically edited.

## 6.2 Split phrase

Allow a phrase to be divided into smaller phrases.

Use existing word timing where available.

Otherwise provide manual selection of the split timestamp and a way to preview it against the video.

## 6.3 Merge phrases

Allow neighbouring phrases to be merged.

Preserve chronological timing and the combined text.

## 6.4 Adjust timing

Allow editing of phrase start and end times.

Include a preview control so the user can hear the adjusted range.

Validate boundaries before saving.

## 6.5 Editing behaviour

- Make edits available through contextual menus.
- Save successful changes automatically.
- Keep the active phrase selected after editing.
- Update the player and queue immediately.
- Prevent invalid or zero-length audio ranges.
- Preserve playback progress.
- Support undo for the most recent structural change.

---

# 7. Playback engine

Build a reliable, centralised playback controller using the official YouTube IFrame Player API.

Avoid creating separate YouTube player instances for individual phrases.

Maintain one player instance that survives ordinary navigation inside the application.

## 7.1 Three playback modes

Implement all three modes, switchable during a session.

### Mode A: Manual

This is the deliberate listen-and-repeat mode.

Behaviour:

1. Play the selected phrase.
2. Automatically pause at its end.
3. Allow the user to repeat it aloud.
4. Remain on the phrase until the user acts.
5. Allow Replay, Previous, Next and direct phrase selection.

Do not automatically advance unless the user has activated looping or another explicit playback behaviour.

### Mode B: Automatic

This is a hands-free phrase practice mode.

Behaviour:

1. Play the selected phrase.
2. Stop at its end.
3. Wait for the configured speaking pause.
4. Move to the next selected phrase.
5. Continue until the selected practice range is complete.

Support:

- Fixed pauses.
- Duration-based pauses.
- Per-phrase pause overrides.

For duration-based pauses, calculate the speaking pause from the phrase duration and a configurable multiplier.

Provide sensible defaults, minimum and maximum pause safeguards, and clear controls.

### Mode C: Continuous

Play the original YouTube recording continuously.

Behaviour:

- Preserve its natural timing.
- Preserve normal silence and transitions.
- Update the displayed phrase as the playhead advances.
- Update highlighting when word-level timing exists.
- Allow seeking, pausing and playback-speed changes.
- Keep the phrase queue synchronised.

Do not automatically skip gaps in Continuous mode.

For non-contiguous practice selections, such as difficult phrases only, explain that uninterrupted original playback and filtered phrase playback are different behaviours. Offer Manual or Automatic mode for filtered practice rather than silently changing Continuous mode.

## 7.2 Switching modes

Users can switch modes without losing the selected phrase or progress.

When changing modes:

- Preserve the current lesson.
- Preserve the current phrase.
- Preserve playback speed.
- Preserve applicable loop and pause preferences.
- Reconcile the playback state safely.
- Prevent duplicate timers or simultaneous playback actions.

## 7.3 Replay

Provide a prominent Replay control.

Replay should restart the current phrase from its configured start, including the optional lead-in.

Do not move to the next phrase.

## 7.4 Unlimited loop

Provide a dedicated loop toggle.

When enabled, repeat the current phrase indefinitely.

Respect the configured speaking pause between repetitions where appropriate.

Allow the user to stop the loop immediately.

Ensure looping cannot accidentally schedule multiple competing playback operations.

## 7.5 Adjustable lead-in

Allow the user to begin playback slightly before a phrase's official start.

Suggested options:

- 0 seconds.
- 0.25 seconds.
- 0.5 seconds.
- 1 second.
- 2 seconds.

Clamp the effective start to the beginning of the recording.

The purpose is to preserve natural context and avoid abrupt-sounding playback.

## 7.6 Playback speed

Support rates exposed by the current YouTube player.

Requirements:

- Accessible speed control.
- Current speed visible on the player.
- Quick reset to 1×.
- Remember preferred speed across sessions.
- Update the UI from actual player state, not merely the requested rate.

Never assume every YouTube video supports every playback speed.

## 7.7 Accurate phrase stopping

Use timestamp-aware playback control.

The player must:

- Seek to the correct phrase boundary.
- Monitor actual playback position.
- Stop at the configured end time.
- Account for seeking delays and buffering.
- Avoid accidentally playing substantial portions of the next phrase.

Use a robust playback state machine and appropriate timing checks.

YouTube's embedded player is not sample-accurate, so do not promise perfect millisecond-level trimming.

Prioritise perceptually accurate phrase playback and stable controls.

## 7.8 Playback state

Maintain explicit states such as:

- Idle.
- Loading.
- Ready.
- Playing.
- Paused.
- Buffering.
- Speaking pause.
- Ended.
- Error.

Playback commands must behave predictably from each state.

Avoid race conditions when the user rapidly presses Replay, Next, Previous or Play.

Cancel obsolete timers and transitions when seeking or changing modes.

---

# 8. Main player interface

This is Echo Studio's signature experience.

## 8.1 Visual inspiration

Create a premium, immersive music-player interface.

The current spoken phrase replaces the album cover.

The design should feel sophisticated, focused and modern, not like a classroom dashboard.

Use:

- Refined typography.
- Generous spacing.
- Subtle gradients.
- Smooth transitions.
- Carefully considered contrast.
- Responsive component sizing.
- Large, comfortable playback controls.

Avoid unnecessary panels, decorative charts and distracting effects.

## 8.2 Player composition

The player should include:

**Top area**

- Back or minimise control.
- Lesson title.
- Phrase queue access.
- Optional practice settings.

**Main content**

- Current phrase prominently displayed.
- Optional speaker label.
- Phrase index, such as 12 of 85.
- Optional expandable IPA information.

**Media area**

- Compact but compliant visible YouTube player.
- Clear YouTube attribution.

**Playback controls**

- Previous phrase.
- Replay phrase.
- Play/Pause.
- Next phrase.
- Loop toggle.
- Speed control.
- Playback mode selector.

**Progress area**

- Phrase timeline.
- Full recording timeline.

Keep the phrase visually dominant while ensuring the video player remains visible and unobstructed.

## 8.3 Text visibility

Provide a one-tap Show/Hide Text control.

When text is hidden, maintain the visual structure and control positions.

Do not cause major layout shifts.

## 8.4 Karaoke-style highlighting

When accurate word-level timestamps exist:

- Highlight the currently spoken word.
- Update highlighting smoothly.
- Keep the full phrase visible.
- Use subtle, tasteful emphasis rather than exaggerated animations.

When word-level timestamps do not exist:

- Display the phrase as static text.
- Do not invent approximate word timings merely to create an animation.

## 8.5 Dual timelines

Implement two seekable progress bars.

### Phrase timeline

Prominent and precise.

Shows:

- Current position within the phrase.
- Phrase duration.
- Draggable seek control.

### Recording timeline

Smaller and secondary.

Shows:

- Absolute position within the full recording.
- Total recording duration.
- Draggable seek control.

Seeking either timeline must update the player, current phrase and relevant state.

Seeking through the full recording must resolve the appropriate phrase from its timestamp.

---

# 9. Phrase queue

## 9.1 Responsive behaviour

On mobile:

- Open as a slide-up sheet.
- Support scrolling through all phrases.
- Automatically close after selecting a phrase.
- Preserve the current playback state.

On desktop:

- Open as a collapsible sidebar.
- Allow the user to continue viewing the main player.

## 9.2 Phrase list content

Each phrase row should show:

- Phrase number.
- Phrase text.
- Start timestamp.
- Current phrase indicator.
- Practised status.
- Difficult status.
- Speaker label when available.

The queue should scroll to the current phrase when opened.

## 9.3 Phrase selection

When the user selects another phrase:

- Seek to the selected phrase.
- Update its text immediately.
- If the player was playing, continue playback according to the active mode.
- If the player was paused, remain paused.
- Update the stored resume position.
- Close the mobile queue.

## 9.4 Contextual actions

Provide quick actions to:

- Replay.
- Mark Practised.
- Mark Difficult.
- Correct text.
- Split.
- Merge.
- Adjust timing.

Keep secondary actions inside a contextual menu so the queue remains readable.

---

# 10. Phrase status and progress tracking

## 10.1 Independent markers

Every phrase supports two independent Boolean statuses:

- Practised.
- Difficult.

A phrase can be both Practised and Difficult.

Removing Difficult must not erase Practised.

Do not automatically infer that a phrase is mastered simply because it has been played.

## 10.2 Listening progress

Track listening progress automatically.

Store:

- Last playback position.
- Last selected phrase.
- Listening coverage.
- Most recently practised time.
- Relevant playback preferences.

Distinguish actual listening coverage from simply moving the playhead.

For example, jumping to the final minute of a recording must not mark all preceding phrases as listened to.

## 10.3 Practice progress

Track:

- Number of phrases marked Practised.
- Number of phrases marked Difficult.
- Total available phrases.
- Percentage manually marked Practised.
- Last practice date.

Make progress visible in the library without adding excessive metrics to the main player.

## 10.4 Flexible practice selections

Support:

- All phrases.
- Difficult phrases only.
- Practised phrases only.
- Selected phrase range.

Provide a discreet Practice Options menu.

Preserve the source order of selected phrases by default.

Handle empty selections gracefully.

---

# 11. IPA pronunciation guidance

British English IPA is an optional learning aid.

It must remain hidden until requested.

## 11.1 Individual word IPA

When a user taps a word in the displayed phrase:

- Show its IPA pronunciation.
- Keep the interaction lightweight.
- Use British English pronunciation as the default.
- Handle punctuation and capitalisation properly.

Use a popover, small overlay or equivalent accessible interface.

## 11.2 Full-phrase IPA

Provide an expandable IPA panel beneath the current phrase.

Display the broad British English phonetic transcription when available.

The panel must not crowd the main player when collapsed.

## 11.3 Implementation approach

Prefer a built-in, appropriately licensed British English pronunciation dictionary or other reliable self-contained phonetic resource.

Build a reusable pronunciation service with a clearly defined interface.

The implementation should:

- Support word lookup.
- Account for common contextual pronunciation differences.
- Handle unknown words gracefully.
- Cache computed results.
- Allow manual IPA corrections.
- Persist corrections with lessons.

Do not present guessed phonetic transcriptions as authoritative.

Where necessary, label the output as a broad dictionary-based pronunciation rather than an exact reproduction of the speaker's actual connected speech.

## 11.4 Optional enhancement

Allow an optional external pronunciation service if it offers a meaningful improvement and can be integrated securely.

Do not require this service for ordinary lesson playback or practice.

Do not hardcode credentials in the frontend.

If the external service is unavailable, built-in functionality must continue working.

---

# 12. Speaker identification

Speaker identification is optional and depends on transcript metadata.

## 12.1 When speaker data exists

Show a subtle speaker label above the current phrase.

Allow filtering the practice queue to one or more speakers.

This is particularly useful for interviews and podcasts.

## 12.2 When speaker data is absent

Do not invent speaker identities.

Do not introduce artificial speaker-detection requirements.

Hide irrelevant controls and preserve normal lesson functionality.

## 12.3 Playback behaviour

Speaker-filtered practice should use selected phrases in Manual or Automatic mode.

If the user selects Continuous mode, preserve the original recording and explain that the speaker filter cannot remove other speakers without changing continuous playback behaviour.

---

# 13. Persistent personal library

Use ChatGPT Sites' managed database to persist user data.

The application must work across devices using the same authenticated identity.

## 13.1 Data to store

Persist:

- Lessons.
- YouTube video identifiers.
- Video metadata.
- Original transcript data.
- Normalised subtitle segments.
- Generated phrases.
- Phrase timestamps.
- Speaker metadata.
- IPA corrections.
- Phrase grouping preferences.
- Playback preferences.
- Practised and Difficult statuses.
- Collections.
- Favourites.
- Listening progress.
- Practice sessions.
- Session history.
- Recent lesson-edit snapshots.

Do not store copies of YouTube media.

## 13.2 Suggested data model

Design a compact relational schema with appropriate tables, including:

| Entity | Purpose |
|---|---|
| User | Private owner identity |
| Lesson | Video references and lesson metadata |
| TranscriptSegment | Original timed transcript information |
| Phrase | Generated and edited phrase information |
| PhraseStatus | Practised and Difficult markers |
| LessonProgress | Resume position and listening coverage |
| Collection | User-defined playlists |
| CollectionLesson | Collection membership |
| PracticeSession | Session history and statistics |
| UserPreferences | Application and playback settings |
| LessonRevision | Recent transcript and grouping changes |
| Speaker | Optional speaker metadata |
| IPAOverride | Manual phonetic corrections |

You may combine tables where sensible, but preserve relational integrity.

Use schema migrations, indexes, appropriate uniqueness constraints and transactional writes where required.

## 13.3 Synchronisation

Requirements:

- Automatically save changes.
- Synchronise across authenticated devices.
- Reload durable state on application startup.
- Show unsynchronised changes when relevant.
- Retry failed writes.
- Resolve simultaneous updates without silently losing data.
- Keep a temporary local pending-change queue when connectivity is interrupted, where supported.

Do not use browser local storage as the sole source of truth.

Local storage or IndexedDB may be used for temporary state, offline metadata caching and pending changes.

## 13.4 Security

The application is private.

Use supported ChatGPT Sites authentication and private access controls.

Enforce data ownership on the server.

Never trust user IDs supplied by the browser as proof of identity.

Protect every data modification and retrieval endpoint.

Do not expose private lesson records through public unauthenticated routes.

Use parameterised database queries and validate server-side inputs.

---

# 14. Progress preservation when editing lessons

Changing transcript grouping must not unnecessarily destroy previous practice history.

## 14.1 Intelligent remapping

When phrases are regenerated:

1. Compare old and new timestamps.
2. Compare normalised text.
3. Match phrases by reliable temporal and textual overlap.
4. Transfer Practised and Difficult statuses only where justified.
5. Flag uncertain matches for review.

Handle phrase splits and merges carefully.

For example, merging two phrases should not automatically produce a Practised result if only one original phrase had been practised.

Preserve Difficult markers conservatively where relevant.

## 14.2 Preview

Before applying major changes:

- Display the proposed new grouping.
- Show the number of affected phrases.
- Explain which progress markers can be preserved.
- Identify uncertain matches.

## 14.3 Undo

Allow the most recent phrase regrouping or transcript replacement to be reversed.

Store enough revision data to restore the previous phrase structure and associated progress.

Apply revisions and related progress changes transactionally.

---

# 15. Session completion and history

## 15.1 Completion summary

When a selected practice session finishes, show a clean summary.

Include:

- Phrases covered.
- Practice duration.
- Number of phrases marked Practised.
- Number of phrases marked Difficult.
- Relevant lesson progress.

Avoid overwhelming the user with analytics.

## 15.2 Completion actions

Provide:

- Review Difficult Phrases.
- Resume Later.
- Restart Session.
- Return to Library.

## 15.3 Session history

Save past practice sessions.

Store:

- Lesson.
- Start and end times.
- Actual practice duration.
- Phrase coverage.
- Practice selection.
- Relevant status changes.

Do not inflate practice time while the player is idle or the user is away.

Use actual recorded activity wherever practical.

---

# 16. Persistent player and navigation

The active lesson should remain available when the user navigates through Echo Studio.

## 16.1 Full player

The immersive full-screen practice interface.

## 16.2 Compact player

When the user browses the library or collections:

- Preserve the current session.
- Preserve play/pause state.
- Preserve current phrase.
- Preserve playback speed.
- Allow returning to the full player.
- Keep the YouTube player visible and compliant during active playback.

Use a persistent player host or equivalent architecture to avoid unnecessary player destruction and recreation.

On mobile, accommodate the minimum YouTube viewport without obscuring essential navigation.

If a particular viewport cannot display a compliant playing video and the surrounding interface simultaneously, prioritise compliance, explain the restriction and pause rather than creating hidden audio playback.

---

# 17. Mobile-first and PWA experience

The application should feel like a polished mobile app.

## 17.1 Mobile layout

Requirements:

- Large touch-friendly controls.
- Prominent phrase text.
- Responsive typography.
- Bottom-oriented playback controls.
- Slide-up phrase queue.
- Comfortable one-handed interactions where practical.
- Safe-area awareness.
- No unnecessary horizontal scrolling.
- Smooth transitions.

## 17.2 Desktop layout

Use the additional screen width appropriately.

Support:

- Spacious player composition.
- Optional phrase sidebar.
- Keyboard controls.
- Well-organised library views.

## 17.3 Installability

Where supported by ChatGPT Sites, implement PWA capabilities:

- Web app manifest.
- Appropriate application icons.
- Installable home-screen experience.
- Standalone display mode.
- Appropriate service-worker configuration.

Verify installation behaviour rather than assuming it works.

## 17.4 Offline metadata

Where supported, allow access to previously cached:

- Lesson metadata.
- Saved transcripts.
- Phrase text.
- Progress information.
- Collections.

YouTube playback requires an internet connection.

Do not cache or download YouTube audio or video for offline playback.

## 17.5 Screen wake lock

Support the Screen Wake Lock API where available and permitted.

Allow the user to keep the screen awake during an active practice session.

Release the lock when the session ends or the user disables the setting.

Handle unsupported browsers gracefully.

## 17.6 Swipe navigation

On mobile:

- Swipe left to advance to the next phrase.
- Swipe right to return to the previous phrase.

Do not allow these gestures to interfere with scrolling, the phrase queue or text selection.

## 17.7 Keyboard shortcuts

Provide desktop shortcuts.

Suggested mappings:

| Key | Action |
|---|---|
| Space | Play/Pause |
| Left arrow | Previous phrase |
| Right arrow | Next phrase |
| R | Replay current phrase |
| L | Toggle loop |
| Q | Open/close phrase queue |
| T | Show/hide phrase text |
| Escape | Close active overlay |

Do not trigger shortcuts while typing in input fields.

Make shortcut information discoverable.

## 17.8 Device media controls

Investigate the Media Session API and other supported browser capabilities.

Implement device media controls only where they work correctly with the embedded YouTube player and comply with YouTube's policies.

Do not imply guaranteed lock-screen or background playback.

---

# 18. Visual design system

## 18.1 Design direction

Use a premium music-player aesthetic.

The interface should be visually distinctive, polished and cohesive.

Take inspiration from high-quality streaming applications without copying their branding or exact UI.

Suggested visual language:

- Rich, dark surfaces.
- Restrained violet, indigo or similar accent colours.
- Subtle gradients.
- Soft elevation.
- Thoughtful typography.
- Consistent spacing.
- Fluid micro-interactions.
- Strong visual hierarchy.

Use restrained animations that support understanding rather than decoration.

## 18.2 Theme support

Support:

- System theme detection.
- Manual Dark mode.
- Manual Light mode.

Persist the manual preference across devices.

Keep both themes equally polished.

## 18.3 Typography

The displayed phrase is the most important text on the screen.

Use responsive typography that adapts to phrase length.

A short phrase should appear large and confident.

A long phrase should scale gracefully without becoming unreadable.

Avoid excessive scrolling in the main phrase area.

## 18.4 Accessibility

Implement:

- Accessible labels.
- Keyboard navigation.
- Visible focus indicators.
- Suitable colour contrast.
- Reduced-motion support.
- Comfortable touch targets.
- Screen-reader-friendly controls.
- Sensible error announcements.
- Support for browser text scaling.

## 18.5 Interaction consistency

Use a consistent icon set, component library, spacing system and design tokens.

Every clickable element must have a clear purpose.

Do not create decorative buttons that do nothing.

Use meaningful empty states, loading states, success states and error states.

---

# 19. Error handling and recovery

Implement robust recovery throughout the application.

## 19.1 YouTube errors

Handle:

- Invalid video ID.
- Removed or private video.
- Embedding disabled.
- Playback failure.
- Buffering.
- Network interruption.
- Unsupported playback-rate changes.
- Autoplay restrictions.
- Missing player readiness.
- Browser limitations.

Show actionable, non-technical error messages.

Provide Retry where appropriate.

## 19.2 Transcript problems

Handle:

- Missing timestamps.
- Invalid format.
- Out-of-range timestamps.
- Empty transcripts.
- Incorrect offsets.
- Missing speaker metadata.
- Missing word-level timing.
- Unavailable automatic transcript retrieval.

Never silently generate misleading timing data.

## 19.3 Database and synchronisation problems

Handle:

- Failed saves.
- Temporary database unavailability.
- Stale data.
- Conflicting updates.
- Lost connectivity.
- Partial write failures.

Preserve unsaved local changes until they can be synchronised where feasible.

Display a discreet synchronisation indicator when action is required.

## 19.4 Recovery behaviour

Automatically preserve:

- Current lesson.
- Current phrase.
- Resume position.
- Practice statuses.
- Playback mode.
- Playback speed.
- Relevant settings.

Avoid intrusive modal dialogs for recoverable problems.

---

# 20. Performance requirements

Optimise for real-world use on desktop and Android mobile.

Requirements:

- Responsive interactions.
- Smooth player transitions.
- Efficient phrase lookup.
- No unnecessary player reloads.
- No duplicated YouTube instances.
- No accumulating playback timers.
- No excessive database writes.
- Efficient rendering of long phrase lists.
- Debounced or throttled progress persistence.
- Appropriate handling of large transcripts.
- Lightweight initial loading.

Use virtualisation or other suitable techniques when rendering long phrase queues.

Avoid polling the YouTube player more aggressively than necessary.

Use actual player events to maintain authoritative playback state.

Keep the UI responsive during phrase regeneration and transcript parsing.

---

# 21. Application architecture

Create a modular, maintainable codebase.

Suggested responsibilities:

**Presentation**

- Home.
- Library.
- Lesson Import.
- Practice Player.
- Phrase Queue.
- IPA Popover.
- Settings.
- Session Summary.

**Domain logic**

- Transcript parsing.
- Transcript validation.
- Phrase segmentation.
- Phrase editing.
- Progress remapping.
- Practice-session management.
- IPA generation.
- Speaker filtering.

**Infrastructure**

- YouTube player adapter.
- Persistent storage repository.
- Authentication integration.
- Synchronisation.
- Settings persistence.
- Optional transcript retrieval.
- PWA integration.

**State management**

Maintain a single authoritative playback controller.

Avoid duplicating playback state across unrelated UI components.

Use clear domain types and typed interfaces.

Ensure that the actual YouTube player, displayed phrase, timelines, queue and session state remain synchronised.

## 21.1 Server-side operations

Implement suitable authenticated endpoints or equivalent Sites-supported server functions for:

- Creating and retrieving lessons.
- Updating lesson metadata.
- Saving transcript segments.
- Managing phrases.
- Updating phrase statuses.
- Saving playback progress.
- Managing collections.
- Saving practice sessions.
- Retrieving session history.
- Updating preferences.
- Applying and reversing lesson revisions.

Use appropriate validation and error handling.

## 21.2 Data portability

Implement a practical export facility for the user's personal data.

Export structured lesson metadata, transcripts, phrases, collections, statuses, history and preferences.

Do not export YouTube media.

Provide a compatible import or restore route where feasible.

This is especially important for preserving the value of the user's learning library independently of the hosting platform.

---

# 22. Critical user journeys

The application must handle the following complete journeys.

## Journey 1: Create a lesson

1. Open Echo Studio.
2. Select Add Lesson.
3. Paste a YouTube URL.
4. Upload an SRT transcript.
5. Preview the transcript.
6. Select Balanced phrase grouping.
7. Review generated phrases.
8. Save the lesson.
9. Start practising.

Expected result: The lesson appears in the library and its phrases play at the correct timestamps.

## Journey 2: Manual shadowing

1. Open an existing lesson.
2. Select Manual mode.
3. Play the first phrase.
4. Wait for playback to stop.
5. Repeat the phrase aloud.
6. Replay it.
7. Slow playback to a supported rate.
8. Reset speed to 1×.
9. Move to the next phrase.

Expected result: Every action behaves predictably, without unwanted advancement.

## Journey 3: Automatic practice

1. Select Automatic mode.
2. Choose a duration-based pause.
3. Start playback.
4. Listen to a phrase.
5. Repeat during the pause.
6. Allow the application to advance.

Expected result: The correct next phrase plays after the configured pause.

## Journey 4: Phrase navigation

1. Open the phrase queue.
2. Scroll to phrase 75.
3. Select it.
4. Return to the main player.
5. Replay the phrase.

Expected result: The player uses phrase 75's exact stored timing, preserves the prior playback state and updates the resume position.

## Journey 5: Difficult phrase review

1. Mark several phrases Difficult.
2. Continue practising.
3. Open Practice Options.
4. Select Difficult Phrases.
5. Start practice.

Expected result: Only the selected difficult phrases are included.

## Journey 6: Edit a phrase

1. Open the queue.
2. Select Edit.
3. Correct the phrase text.
4. Adjust the end timestamp.
5. Preview playback.
6. Save.

Expected result: Text and playback boundaries update consistently without losing practice status.

## Journey 7: Regroup phrases

1. Open an existing lesson with practice history.
2. Change Balanced to Short grouping.
3. Preview changes.
4. Apply regrouping.
5. Review remapped progress.
6. Undo the change.

Expected result: The original grouping and relevant statuses can be restored.

## Journey 8: Cross-device synchronisation

1. Import a lesson on desktop.
2. Practise several phrases.
3. Mark two phrases Difficult.
4. Close the desktop session.
5. Open Echo Studio on Android using the same account.

Expected result: The lesson, practice statuses and resume position are available.

## Journey 9: Continuous listening

1. Select Continuous mode.
2. Play the original interview.
3. Observe synchronised phrase changes.
4. Seek along the full recording timeline.
5. Pause.
6. Resume.

Expected result: The recording plays naturally without skipping transcript gaps.

## Journey 10: Network interruption

1. Start a practice session.
2. Interrupt connectivity.
3. Attempt a status update.
4. Restore connectivity.
5. Resume.

Expected result: The application reports and recovers from the interruption without silently discarding progress.

---

# 23. Testing requirements

Testing is part of the development task, not an optional follow-up.

## 23.1 Unit tests

Cover:

- SRT parsing.
- VTT parsing.
- JSON transcript parsing.
- Timestamp normalisation.
- Transcript validation.
- Non-speech filtering.
- Phrase grouping.
- Phrase editing.
- Duration calculations.
- Pause calculations.
- Phrase matching and progress remapping.
- Practice filtering.
- IPA lookup.
- Persistence transformations.

## 23.2 Integration tests

Cover:

- Lesson creation.
- Database persistence.
- Collection management.
- Authentication.
- Player state transitions.
- Phrase navigation.
- Resume behaviour.
- Lesson revisions.
- Synchronisation.
- Error recovery.

## 23.3 UI and end-to-end tests

Test real user flows using available browser tooling.

Cover desktop and mobile layouts.

Verify that:

- The phrase queue opens and closes.
- Buttons perform their actions.
- Keyboard shortcuts work.
- Swipe interactions do not interfere with scrolling.
- Timelines seek correctly.
- Theme changes persist.
- Status markers save.
- Session summaries contain accurate data.
- The persistent player survives internal navigation.
- The YouTube player remains visible and compliant.
- No major layout overflow occurs on narrow screens.

Where YouTube playback cannot be exercised automatically, test the surrounding playback logic with a deterministic mock player adapter, then verify real YouTube behaviour manually.

Mocks are permitted for testing, not as substitutes for production functionality.

## 23.4 Acceptance criteria

The implementation is complete only when:

- A real YouTube URL can be imported.
- A real timestamped transcript can be imported.
- Phrases are generated from actual transcript data.
- The player seeks to and plays real phrase ranges.
- Manual, Automatic and Continuous modes work.
- Replay, loop, pause, speed and navigation controls work.
- The phrase queue reflects the active phrase.
- Phrase editing is functional.
- Statuses persist.
- Lesson progress is saved.
- Collections work.
- Practice selections work.
- IPA guidance works for supported text.
- Session completion and history work.
- Cross-device persistence works using supported authentication.
- Responsive mobile and desktop interfaces are functional.
- Available PWA features are implemented and tested.
- Errors are handled predictably.
- The deployed application loads and operates correctly.

Do not mark a feature complete merely because its visual component exists.

---

# 24. Implementation priorities within the single development effort

**The user has explicitly chosen complete implementation in one development effort, not a phased MVP.**

You may organise engineering work internally, but do not defer agreed features to an unspecified future release.

The following engineering order is suggested for stability:

1. Establish the supported Sites environment, database, authentication and deployment configuration.
2. Build the shared application design system and navigation shell.
3. Implement transcript parsing, validation and segmentation.
4. Build and test the YouTube playback controller.
5. Implement the immersive practice player.
6. Add phrase navigation and editing.
7. Implement persistent library, collections and progress.
8. Add IPA, speaker filtering and advanced practice controls.
9. Implement PWA and supported device interactions.
10. Complete integration testing, usability checks and deployment verification.

These are internal work steps, not separate deliverables or permission to stop after a prototype.

---

# 25. Prohibited shortcuts

Do not:

- Produce a static prototype instead of a working application.
- Replace real YouTube playback with simulated audio.
- Pretend to retrieve transcripts when retrieval is unavailable.
- Hardcode example lessons as the only usable content.
- Use fabricated word timestamps.
- Add non-functional buttons.
- Implement fake synchronisation using temporary component state.
- Claim browser local storage alone provides cross-device synchronisation.
- Use hidden YouTube playback.
- Download or separate YouTube audio.
- Introduce unnecessary cloud providers.
- Build microphone features.
- Introduce an unrelated AI chatbot.
- Add social features or multi-user administration.
- Invent pronunciation scores.
- Present approximate IPA as an exact analysis of a speaker.
- Silently erase progress when regrouping phrases.
- Ignore mobile layouts.
- Ignore authentication or data ownership.
- Claim features are tested without actually testing them.
- Deliver an attractive interface while leaving the main playback logic incomplete.

Avoid excessive abstraction, dependency bloat and architectural complexity.

The product should remain maintainable by an individual developer using ChatGPT Sites.

---

# 26. Final deliverables

Produce and deploy the complete Echo Studio application.

The final result must include:

### A. Working application

A deployed ChatGPT Site with all feasible agreed functionality implemented.

### B. Source code

A maintainable, organised application codebase.

### C. Database

A working persistent database, schema and required migrations.

### D. Configuration

Any necessary environment settings and secrets configuration, excluding secret values from source control.

### E. Automated tests

Relevant unit, integration and UI tests.

### F. Documentation

A concise README covering:

- Application architecture.
- Main dependencies.
- Data model.
- Local development where supported.
- Deployment.
- Supported transcript formats.
- Playback behaviour.
- External integrations.
- Known platform restrictions.

### G. Verification report

Provide a factual implementation report identifying:

- Features completed and tested.
- Features implemented but not fully verifiable.
- Features restricted by ChatGPT Sites or YouTube policies.
- Any external services used and why they were necessary.
- Any remaining functional defects.

Include a brief record of the actual tests performed and their results.

Do not report a feature as operational if its implementation is missing or its execution failed.

---

# 27. Final success definition

The ideal Echo Studio experience is:

I open the application on my laptop or mobile phone.

I see a beautiful personal library, similar in quality and simplicity to a modern music-streaming application.

I paste a YouTube URL, import a timestamped transcript and let Echo Studio prepare a collection of natural speaking phrases.

I open the lesson.

The current phrase appears prominently in the centre of the screen, replacing the album artwork normally found in Spotify.

The original recording plays through a compact, visible YouTube player.

I listen to the phrase, repeat it aloud, replay it as many times as I like, or move to the next one.

I can switch between Manual, Automatic and Continuous playback.

I can slow the speaker down, view British English IPA, hide the text, open the phrase queue, jump anywhere in the recording and mark challenging phrases.

The application remembers everything important.

Later, I open Echo Studio on another device, find my lessons and continue from where I stopped.

**The experience should feel effortless, focused and enjoyable.**

Echo Studio is not intended to become a large educational management platform.

It is a beautifully designed, personal speech-shadowing studio built around natural spoken English, precise phrase navigation, reliable playback and long-term practice.

---

# 28. Execution instruction

Begin implementation now.

Inspect the available ChatGPT Sites development environment and official platform documentation.

Select the simplest supported architecture that fulfils these requirements.

Create the application, its persistent storage, the playback engine, the user interface and the necessary supporting services.

Use the platform's available development, browser-testing and deployment capabilities.

Make reasonable implementation decisions independently. Do not interrupt development for minor stylistic or technical choices already covered by this specification.

Implement the full agreed feature set within this development effort.

If a specific capability is technically unavailable, document the limitation, implement the closest compliant alternative where possible and continue with the remaining work.

Prioritise working functionality, reliable playback, a polished user experience and maintainable code.

**The final outcome must be a deployed, usable Echo Studio application, not another specification or development plan.**

---

# Echo Studio: Media Player UI/UX Redesign and Implementation

## Role and objective

Act as a senior frontend engineer, product designer, UI/UX specialist and quality assurance engineer.

Your task is to redesign and implement the existing Echo Studio media player, following the two attached visual prototypes:

1. **Desktop Reference:** The simplified desktop media player.
2. **Mobile Reference:** The immersive, portrait-oriented mobile player.

These images represent the approved visual direction for the application.

**Do not rebuild Echo Studio from scratch. Do not create a separate demonstration application. Modify the existing application and deploy the changes to the existing ChatGPT Site.**

Inspect the existing codebase, identify the current media player architecture and implement the redesign while retaining all existing functional capabilities.

The outcome should look and behave like a premium modern music player, adapted specifically for speech-shadowing practice.

---

# 1. Core design philosophy

Echo Studio is not a video-watching application or a conventional educational dashboard.

It is an immersive audio-led learning experience.

Think Spotify, Apple Music or YouTube Music, but with a spoken phrase replacing the album artwork.

The user should be able to open a lesson, listen to a phrase, repeat it aloud and move to the next phrase with minimal effort.

The interface must follow a strict visual hierarchy.

### Primary elements

These must always be prominent and immediately accessible:

1. Current phrase text.
2. Play/Pause.
3. Replay current phrase.
4. Next phrase.

### Secondary elements

These should remain accessible without dominating the interface:

- Current phrase position and progress.
- YouTube video player.
- Phrase queue.
- Practised and Difficult markers.

### Tertiary elements

These should be hidden inside contextual menus, collapsible panels or settings:

- Playback mode (Manual, Automatic, Continuous).
- Playback speed.
- British English IPA.
- Full recording timeline.
- Transcript editing.
- Speaking pause settings.
- Phrase lead-in.
- Other playback preferences.

**Do not display all available controls simultaneously.**

The previous interface suffered from excessive controls, visual clutter and competing information.

The redesign must solve those problems rather than merely restyle the same layout.

---

# 2. How to use the attached screenshots

The screenshots are visual specifications, not loose inspiration.

Before editing the application:

1. Examine both attached images carefully.
2. Identify the layout structure, spacing, typography, proportions, colours and interaction hierarchy.
3. Identify which components are shared between desktop and mobile.
4. Compare the screenshots with the current application's code.
5. Reuse existing working components where possible.
6. Implement the new presentation without duplicating existing functionality.

Use the screenshots as the primary reference for:

- General composition.
- Phrase prominence.
- Placement of controls.
- Typography scale.
- Colour treatment.
- Background gradients.
- Rounded corners.
- Player positioning.
- Navigation.
- Collapsible secondary features.

The final interface should be recognisably close to the provided prototypes.

However, the screenshots are illustrative, not evidence of exact production behaviour. Adapt them where necessary for accessibility, responsive design, real transcript content and YouTube's embedding requirements.

Do not hardcode the example text, timestamps, speaker or video shown in the images.

Use the actual lesson data.

---

# 3. Desktop player redesign

Follow the attached Desktop Reference.

## 3.1 Overall layout

Create a spacious, immersive player occupying the main application viewport.

Use a deep navy or charcoal base with subtle purple accents and dynamic ambient lighting.

Avoid excessive card borders and nested containers.

The layout should feel like one cohesive experience.

### Header

Keep the header minimal.

Include:

- Echo Studio branding.
- Current lesson title.
- Back/navigation control.
- Access to settings or secondary options.

Avoid multiple competing navigation bars.

### Main phrase

The current phrase is the dominant visual element.

Requirements:

- Large, crisp typography.
- Comfortable line height.
- Generous surrounding space.
- Natural line wrapping.
- Responsive font sizing.
- Clear contrast against the background.

When word-level timestamps exist, subtly highlight the currently spoken word.

The text must remain readable when the phrase is unusually long.

Do not use excessive word animations, bouncing text or distracting effects.

### YouTube player

Display a compact but clearly visible embedded YouTube player.

It should be secondary to the phrase.

Preserve appropriate proportions and branding.

Do not attempt to hide the iframe or use it as an invisible audio source.

Maintain a compliant player viewport.

### Player controls

Place the primary controls together in a visually balanced arrangement:

**Replay | Play/Pause | Next**

Play/Pause should be substantially more prominent.

Replay and Next should be smaller but comfortable to click.

Do not display an unlimited-loop button.

The user has explicitly decided that automatic looping is unnecessary.

### Progress

Keep a discreet progress indicator for the current phrase.

The full recording timeline should be available inside a collapsible section.

When collapsed, the recording timeline must not continue occupying space.

### Phrase queue

Use a collapsible sidebar on the right.

Requirements:

- Expand and collapse smoothly.
- Remember its open/closed preference.
- Highlight the active phrase.
- Allow jumping directly to a phrase.
- Allow browsing all phrases.
- Preserve playback state when selecting another phrase.

The sidebar should not permanently consume a large proportion of the screen.

When collapsed, the main player should reclaim the available width.

---

# 4. Mobile player redesign

Follow the attached Mobile Reference.

This is not simply a smaller version of the desktop interface.

Build a deliberately mobile-first player with its own carefully considered layout.

## 4.1 Overall composition

Use a vertically arranged, immersive music-player interface.

The screen should contain:

1. Minimal header.
2. Lesson title and phrase position.
3. Large central phrase.
4. Embedded YouTube player.
5. Compact phrase progress.
6. Primary playback controls.
7. Discreet secondary options.

The user should immediately understand how to listen, repeat and continue.

## 4.2 Header

Include:

- Back navigation.
- Echo Studio branding or compact lesson identity.
- Phrase queue access.

Do not crowd the header with settings, status indicators and additional buttons.

## 4.3 Phrase display

The phrase is the visual centrepiece.

It should be:

- Large enough to read comfortably.
- Visually balanced.
- Responsive to available screen height.
- High contrast.
- Free from unnecessary surrounding panels.

Use responsive typography rather than a fixed oversized font.

A short phrase may occupy two large lines.

A longer phrase should use a smaller font or additional lines without becoming clipped.

Do not truncate the actual spoken phrase.

## 4.4 YouTube video

Keep the video visible and compliant.

The YouTube IFrame Player API requires the embedded player viewport to be at least 200 × 200 pixels. The interface should respect this even on narrow phones.

For a narrow mobile viewport, a suitable non-16:9 container with letterboxing may be preferable to making the iframe too short.

Do not crop, obscure or replace the YouTube player with a decorative screenshot.

If the viewport is short, allow the content to scroll naturally while keeping the essential controls accessible. Do not sacrifice phrase readability to force everything onto one screen.

## 4.5 Primary controls

Create three large touch-friendly controls:

**Replay | Play/Pause | Next**

The central Play/Pause button should be the strongest visual element after the phrase.

Requirements:

- Comfortable thumb reach.
- Clear pressed and disabled states.
- Immediate visual response.
- Consistent iconography.
- No unnecessary text labels when the icons are sufficiently clear and accessible.

Do not add an unlimited loop control.

## 4.6 Bottom options

Use a compact More Options control or bottom sheet.

Secondary settings should appear only when requested.

The sheet can contain:

- Playback mode.
- Playback speed.
- IPA.
- Phrase lead-in.
- Automatic pause configuration.
- Full recording timeline.
- Other existing practice settings.

Avoid a long, permanently visible list of controls.

## 4.7 Phrase queue

Open the phrase queue as a slide-up sheet.

It must:

- Show the currently selected phrase.
- Support smooth scrolling.
- Allow direct phrase selection.
- Close automatically after selection where configured.
- Maintain player state.
- Support existing Practised and Difficult markers.

---

# 5. Dynamic ambient background system

Implement a distinctive background system inspired by modern music-streaming applications.

The objective is to make each lesson feel visually different without relying on decorative stock artwork.

## 5.1 Preferred behaviour

When a lesson loads:

1. Obtain the YouTube video's thumbnail URL from the existing lesson metadata.
2. Analyse the thumbnail's dominant colours.
3. Generate a complementary ambient colour palette.
4. Apply that palette to the player background.
5. Transition smoothly between palettes when switching lessons.

For example:

- A warm video thumbnail may produce deep burgundy, orange and plum accents.
- A blue thumbnail may produce navy, indigo and cyan.
- A predominantly green thumbnail may produce forest green, teal and muted emerald.

These are examples, not mandatory mappings.

## 5.2 Recommended library

Prefer the open-source **Color Thief** library:

https://github.com/lokesh/color-thief

npm package:

`colorthief`

Its current API supports dominant-colour extraction, palettes and useful colour information.

It is suitable for extracting colours from a thumbnail without needing to process the actual YouTube video frames.

Example conceptual integration:

```typescript
import { getPalette } from "colorthief";

const palette = await getPalette(imageElement, {
  colorCount: 5
});

const colours = palette.map(color => color.hex());
```

Adapt the implementation to the installed library version and existing build environment.

Alternative:

https://github.com/Vibrant-Colors/node-vibrant

Use Vibrant if its colour-swatches API produces a better result for the intended design.

Do not introduce both libraries unless there is a clear technical need.

## 5.3 Important technical constraint

YouTube video frames inside a cross-origin iframe cannot be assumed accessible for pixel analysis.

Do not attempt to read pixels directly from the embedded YouTube player.

Use the video's thumbnail instead.

If thumbnail image access is restricted by CORS, use a supported server-side image-processing approach only where permitted.

Otherwise, fall back to a predefined palette.

A failed colour extraction must never prevent lesson playback.

## 5.4 Palette refinement

Do not simply apply raw thumbnail colours directly to the background.

Some thumbnails contain saturated red, bright white, yellow or visually unpleasant combinations.

Create a colour-processing layer that:

- Selects useful dominant and secondary colours.
- Reduces excessive saturation.
- Produces darker, comfortable background tones.
- Maintains contrast for text.
- Avoids distracting colour combinations.
- Generates harmonious gradients.

Use CSS variables for the generated palette.

For example:

```css
--ambient-primary
--ambient-secondary
--ambient-accent
--ambient-glow
--player-surface
--player-text
```

Then use layered gradients, subtle radial glows and restrained transparency.

The result should resemble a premium music application rather than a brightly coloured dashboard.

## 5.5 Ambient movement

Allow very subtle ambient motion.

Possible effects:

- Slowly moving gradient.
- Soft diffused colour glow.
- Gentle transition between colour layers.

Do not create flashing, rapidly moving or distracting effects.

Respect `prefers-reduced-motion`.

Avoid heavy animation libraries if CSS transitions can achieve the required result.

## 5.6 Palette persistence

Calculate the palette once per lesson, not on every render.

Cache the result and persist it with existing lesson metadata where appropriate.

When reopening a lesson, reuse the palette.

Allow the theme system to maintain usable contrast in both light and dark modes.

---

# 6. Recommended frontend libraries

Inspect the current application's dependencies before installing anything.

Prefer existing compatible libraries rather than replacing the frontend stack.

| Purpose | Preferred solution |
|---|---|
| Icons | `lucide-react` |
| Dynamic colour extraction | `colorthief` |
| Animations | CSS transitions; `motion` only if needed |
| Drawer and sheet interactions | Existing accessible primitives, or Radix UI Dialog |
| Styling | Existing Tailwind CSS or current styling system |
| YouTube playback | Existing YouTube IFrame Player API integration |
| Responsive layouts | CSS Grid, Flexbox, container queries |
| Persistent data | Existing ChatGPT Sites D1 integration |

Useful references:

- Lucide: https://lucide.dev
- Motion: https://motion.dev
- Radix UI: https://www.radix-ui.com/primitives
- Color Thief: https://github.com/lokesh/color-thief

Do not migrate frameworks or install a large UI component system solely for this redesign.

A lightweight, consistent implementation is preferable.

---

# 7. Playback behaviour must remain functional

The redesign must preserve the existing playback engine.

## 7.1 Primary actions

**Play/Pause**

- Starts or pauses the current phrase.
- Reflects the actual YouTube player state.
- Works in all supported playback modes.

**Replay**

- Returns to the beginning of the current phrase.
- Applies the configured lead-in when enabled.
- Does not advance to the next phrase.

**Next**

- Advances to the next applicable phrase.
- Respects the active practice selection.
- Preserves the intended playback state.

## 7.2 Playback modes

Retain:

- Manual.
- Automatic.
- Continuous.

Make mode selection available from More Options or an unobtrusive contextual menu.

The currently selected mode must remain active even when the user closes the settings panel.

Automatic progression should continue to work according to existing pause configuration.

## 7.3 Remove unlimited looping

Remove unlimited-loop controls from the main player.

Do not silently remove the replay function.

Replay and loop are different behaviours:

- Replay plays the current phrase again on demand.
- Loop repeatedly replays it without further action.

Only Replay is required as a primary control.

## 7.4 Playback speed

Preserve adjustable speed using supported YouTube rates.

Move the speed selector into secondary options.

Retain the existing speed preference and quick reset to 1× where available.

## 7.5 IPA

Preserve existing IPA functionality, but hide it by default.

Allow it to be opened from secondary options.

Do not permanently display phonetic transcription beneath the current phrase.

## 7.6 Phrase queue and progress

Preserve:

- Phrase selection.
- Practised and Difficult states.
- Resume position.
- Listening progress.
- Current phrase synchronisation.
- Existing editing functionality.

Do not alter database records simply to accommodate the visual redesign.

---

# 8. Responsive layout and interaction requirements

Use responsive layouts rather than duplicating the entire player into separate implementations.

Share the playback controller and business logic across desktop and mobile.

Allow presentation components to differ where needed.

Suggested responsive behaviour:

| Element | Desktop | Mobile |
|---|---|---|
| Current phrase | Large central text | Large stacked text |
| YouTube player | Compact secondary region | Visible responsive media area |
| Primary controls | Grouped beneath progress | Large bottom-oriented controls |
| Phrase queue | Collapsible sidebar | Slide-up sheet |
| Playback settings | Popover | Bottom sheet |
| IPA | Expandable or contextual | Hidden sheet |
| Full recording timeline | Collapsible | Collapsible |
| Ambient background | Wide layered gradients | Immersive vertical gradient |

Test at:

- 320px mobile width.
- 375px mobile width.
- 390px mobile width.
- 430px mobile width.
- Tablet widths.
- 1280px desktop width.
- 1440px desktop width.
- Larger desktop viewports.

Also test short mobile screens, landscape orientation, browser zoom and larger accessibility text settings.

Do not allow controls to overlap the iframe, phrase text or system navigation areas.

---

# 9. Preserve the existing application

This is a UI refactoring and enhancement task.

Before editing:

- Inspect the existing application structure.
- Identify its current components.
- Identify playback state management.
- Identify transcript synchronisation logic.
- Identify persistence and database dependencies.
- Identify theme and styling conventions.
- Identify existing working routes and screens.

Preserve the following unless a change is directly necessary:

- Existing lesson library.
- Transcript importing.
- Phrase segmentation.
- Lesson editing.
- Progress persistence.
- User preferences.
- Authentication.
- Collections.
- Existing database schema and records.
- Application deployment configuration.

Do not reset, recreate or discard the existing D1 database.

Do not introduce breaking changes to existing lesson data.

Prefer refactoring the player view rather than replacing the playback engine.

---

# 10. Interaction and animation guidelines

Animations should communicate state, not decorate the interface.

Use restrained transitions for:

- Opening and closing the phrase queue.
- Expanding settings.
- Switching themes.
- Changing ambient colour palettes.
- Updating the current phrase.
- Showing playback state changes.

Suggested transition behaviour:

- Small control interactions: approximately 100–200ms.
- Panels and sheets: approximately 180–300ms.
- Ambient palette transitions: approximately 500–900ms.

These are starting points, not rigid requirements.

Avoid heavy blur effects and large animated layers that degrade performance on mobile.

Preserve smooth scrolling and responsive touch interactions.

---

# 11. Design quality requirements

The redesigned player must not look like a typical AI-generated dashboard.

Specifically avoid:

- Excessive floating cards.
- Too many bordered containers.
- Numerous unrelated buttons.
- Large empty panels.
- Every control being equally prominent.
- Multiple competing accent colours.
- Oversized controls that force unnecessary scrolling.
- Decorative elements without a practical purpose.
- Text overlapping controls.
- Fixed layouts that break on smaller devices.

Use a limited design system.

A sensible starting point is:

- Near-black or deep navy surfaces.
- Purple as the primary brand accent.
- Thumbnail-derived colours for ambient backgrounds.
- White or softly tinted typography.
- Rounded, tactile playback controls.
- Subtle translucent secondary surfaces.

Allow the background to be visually expressive while the controls remain restrained.

The phrase should always command attention.

---

# 12. Implementation and verification

Implement the redesign in the existing project.

Do not stop after producing mockups or CSS suggestions.

## 12.1 Required verification

After implementation, verify:

1. A real lesson loads.
2. The phrase text is populated from the actual transcript.
3. The YouTube player works.
4. Play/Pause works.
5. Replay returns to the correct phrase start.
6. Next advances correctly.
7. Automatic mode still works.
8. Continuous mode still works.
9. Phrase queue navigation works.
10. IPA is accessible but hidden by default.
11. Speed controls remain functional.
12. Progress is preserved.
13. Dynamic background colours are generated or a suitable fallback is used.
14. The player remains usable on mobile.
15. Desktop and mobile layouts match the attached visual references.
16. No existing lessons or user data are lost.

## 12.2 Visual comparison

Capture screenshots of the actual implementation at desktop and mobile sizes.

Compare each against its supplied reference image.

Evaluate:

- Composition.
- Visual hierarchy.
- Phrase typography.
- Control placement.
- Video sizing.
- Background treatment.
- Spacing.
- Responsiveness.
- Overall design consistency.

Iterate on the implementation to correct meaningful differences.

Do not declare the visual redesign complete without comparing the rendered application against both references.

Pixel-perfect reproduction is not necessary when it conflicts with real content, accessibility or browser restrictions.

However, the implemented interface must closely reflect the approved design direction.

## 12.3 Functional regression tests

Test existing player behaviour after the visual changes.

Use automated tests where practical and browser-based checks for actual interaction.

Do not rely solely on static screenshots.

---

# 13. Acceptance criteria

The redesign is successful when:

- The interface looks and feels like a premium modern music player.
- The current phrase is the dominant visual element.
- Play/Pause is the most prominent control.
- Replay and Next are immediately accessible.
- Secondary settings no longer clutter the screen.
- The phrase queue is collapsible on desktop and accessible as a sheet on mobile.
- The YouTube player remains visible and compliant.
- Desktop and mobile layouts closely follow their respective screenshots.
- Dynamic ambient colours create a polished, lesson-specific visual identity.
- All existing playback modes and core features remain functional.
- User data and lesson progress are preserved.
- The application runs smoothly on desktop and Android mobile.
- The implementation is deployed to the existing ChatGPT Site.

---

# 14. Execution instructions

**Begin modifying the existing Echo Studio application now.**

Use the attached Desktop Reference and Mobile Reference images as your visual specifications.

Inspect the current project before making changes.

Implement the redesign using the existing architecture wherever possible.

Introduce Color Thief for dynamic thumbnail-based ambient colours if supported, with an appropriate fallback.

Use a minimal set of supporting libraries.

Keep the main player focused on the current phrase, Play/Pause, Replay and Next.

Move infrequently used controls into contextual menus or collapsible panels.

Preserve all existing lessons, progress and functional capabilities.

Test the implementation, compare actual screenshots with the supplied references, fix visual and functional defects and deploy the updated application.

Do not deliver only a description or a new prototype.

**Deliver the redesigned, fully functioning Echo Studio media player in the existing application.**