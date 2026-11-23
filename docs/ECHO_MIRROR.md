# Echo Mirror

Mirror is available on imported or uploaded audio lessons with a valid timed phrase. The player keeps its existing replay/next controls and uses a split main control: the larger area plays, the smaller **Record** area requests microphone access, plays the original phrase, then starts recording. Tap **Stop** when finished. During permission or original playback, the smaller area offers **Cancel**.

There is no countdown, silence detection, trimming, time stretching, automatic alignment, scoring or AI service. Any delay before speaking remains in the recording. Capturing an attempt never automatically plays it. The comparison panel stays closed after recording, with a quiet ready message.

Open **Compare** to see the original and latest attempt. The previous attempt is expandable. Play controls are independent and mutually exclusive: playing one stops the other. Waveforms share a time scale beginning at each recording's start, with independently normalised heights. They show duration, pauses and loudness patterns, not pronunciation accuracy. Original playback uses the selected speed and audio timing offset; user recordings play at recorded speed.

## Retention and privacy

The latest two successful attempts per phrase are held in session memory. Failed or cancelled recordings do not replace them. Temporary recordings are limited to 50 MB per session; reaching that limit cancels capture with a recovery message instead of silently losing earlier attempts.

**Save attempt** writes the selected recording to the separate `echo-mirror-local` IndexedDB database on this device. Saved attempts survive refresh but are never included in account sync, lesson export or server uploads. Delete controls distinguish temporary and saved copies. Saved attempts retain lesson/phrase IDs, timestamps, source-audio identity, offset, date and transcript text. If timing or audio changes, they are labelled as older/different rather than presented as a matching comparison.

Saved attempts for a lesson remain accessible from its comparison panel after phrase edits, including older phrase identities. Browser storage deletion removes them; device storage quotas can prevent saving. Error messages leave temporary practice available.

## Playback and resource handling

Mirror pauses the main player and uses the same lesson asset and phrase boundaries for comparison; it does not extract or generate original phrase files. Ending Mirror restores the main player's entry position, paused. Navigation, lesson-source changes, backgrounding and phrase navigation stop capture/comparison, release the microphone and preserve existing attempts. Temporary URLs and waveform buffers are released when superseded or the session closes.

Waveforms are decoded only when Compare opens. The current lesson's decoded original is cached. For mobile memory safety, original-waveform analysis is limited to audio up to 10 minutes and 50 MB encoded; longer files remain usable for listening, recording and comparison playback, with a waveform-unavailable explanation. Browser codec/decoder failures similarly preserve playback and recording. This limit concerns visualisation, not the lesson's supported playback duration.

YouTube-only lessons do not expose their audio for analysis and retain their existing player. Upload an audio source to use Mirror. Microphone use needs HTTPS (or localhost), MediaRecorder support and permission from both the browser and any embedding host. Record opens the real browser request, with a cancellable in-app explanation while it is pending. Denial, missing/busy devices, insecure origins and blocked iframe permissions have distinct recovery guidance; a denied permission must be changed in browser/site settings. If original playback is blocked after microphone access, Continue provides another user gesture without requesting the microphone again. Recording selects a supported WebM/Opus or MP4 format. Cancelling releases any granted stream, including permission grants that arrive after cancellation.

## Validation

Unit tests cover waveform silence preservation, normalisation, attempt rotation, edited-source detection, delayed-permission cancellation, unsupported microphones and entry-position restoration. Browser checks use an encoded MP3 lesson and Chromium's simulated microphone to exercise listen/record/stop, closed comparison, two attempts, waveforms, explicit playback, local saving and saved-attempt refresh. Responsive checks cover 320/375/430px phones, tablet, desktop and short landscape. Physical microphones, iOS codecs and real-device interruption behaviour still need device testing.
