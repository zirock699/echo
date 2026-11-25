# Echo Mirror

Mirror is available on imported or uploaded audio lessons with a valid timed phrase. **Record** requests microphone access, plays the reference phrase, then starts recording. **Cancel** is available during permission or reference playback. When you tap **Stop**, a successful take opens **Listen back**. Replay, Play and Next stay together on the playback row.

Any delay before speaking remains in the recording. Choose a comparison track to play it. Closing Listen back returns to the player at the original position.

Open **Compare** at any time to see the reference and latest take. The previous take is expandable. Playing either track stops the other. Waveforms share a time scale beginning at each recording's start, with independently normalised heights. They show duration, pauses and loudness patterns. Reference playback uses the selected speed and audio timing offset, and user recordings play at recorded speed.

## Retention and privacy

The latest two successful attempts per phrase are held in session memory. Failed or cancelled recordings do not replace them. Temporary recordings are limited to 50 MB per session; reaching that limit cancels capture with a recovery message instead of silently losing earlier attempts.

**Save attempt** writes the selected recording to the separate `echo-mirror-local` IndexedDB database on this device. Saved attempts survive refresh but are never included in account sync, lesson export or server uploads. Delete controls distinguish temporary and saved copies. Saved attempts retain lesson/phrase IDs, timestamps, source-audio identity, offset, date and transcript text. If timing or audio changes, they are labelled as older/different rather than presented as a matching comparison.

Saved attempts for a lesson remain accessible from its comparison panel after phrase edits, including older phrase identities. Browser storage deletion removes them; device storage quotas can prevent saving. Error messages leave temporary practice available.

## Playback and resource handling

Mirror pauses the main player and uses the same lesson asset and phrase boundaries for comparison; it does not extract or generate original phrase files. Ending Mirror restores the main player's entry position, paused. Navigation, lesson-source changes, backgrounding and phrase navigation stop capture/comparison, release the microphone and preserve existing attempts. Temporary URLs and waveform buffers are released when superseded or the session closes.

Waveforms are decoded only when Compare opens. The current lesson's decoded original is cached. For mobile memory safety, original-waveform analysis is limited to audio up to 10 minutes and 50 MB encoded; longer files remain usable for listening, recording and comparison playback, with a waveform-unavailable explanation. Browser codec/decoder failures similarly preserve playback and recording. This limit concerns visualisation, not the lesson's supported playback duration.

YouTube-only lessons do not expose their audio for analysis and retain their existing player. Upload an audio source to use Mirror. Microphone use needs HTTPS (or localhost), MediaRecorder support and permission from both the browser and any embedding host. Record opens the real browser request, with a cancellable in-app explanation while it is pending. Denial, missing/busy devices, insecure origins and blocked iframe permissions have distinct recovery guidance; a denied permission must be changed in browser/site settings. If original playback is blocked after microphone access, Continue provides another user gesture without requesting the microphone again. Recording selects a supported WebM/Opus or MP4 format. Cancelling releases any granted stream, including permission grants that arrive after cancellation.

## Validation

Unit tests cover waveform silence preservation, normalisation, attempt rotation, edited-source detection, delayed-permission cancellation, unsupported microphones and entry-position restoration. The maintained Chromium journey uses generated native audio and a simulated microphone input to verify paused Listen back, exclusive comparison playback and device-only saves after reload. Physical microphones, iOS codecs and real-device interruption behaviour need separate device testing. [Browser journey](../tests/browser_echo_mirror.py)

## Main transport after engine recovery

Main Play/Pause/Replay always belongs to PlayerEngine, including after a recorded attempt or closing comparison. Main transport actions end the temporary Mirror playback session and restore its entry position before acting. Mirror original/attempt playback stays inside explicit recording/comparison actions. Saved and temporary attempts remain accessible.
