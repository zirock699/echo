# Playback and transcript synchronisation

The media clock is the source of truth. Manual/Automatic practice keeps the chosen phrase through its configured lead-in and stops at its end. Continuous mode follows the original timeline without skipping gaps. These fixes change timing and lifecycle handling, not the screen design or practice modes.

## Confirmed defects corrected

- A seek previously accepted any clock sample after 1.5 seconds, including the position before the seek. Pausing also discarded the seek guard. Pending seeks now survive pause, wait for clock evidence near the requested position, and wait for native `seeking` to finish. An unresolved seek stops with a retryable error after eight seconds. Stale playback is paused while waiting; a late result after timeout cannot automatically restart it.
- Native scrubbing while paused did not update the displayed phrase; scrubbing just past an adjacent cue could stop against the previous cue. Native `seeked` distinguishes application seeks from external scrubbing. YouTube state changes and clock discontinuities reconcile the phrase with its actual source position. Application seeks preserve their selected lead-in context.
- Old `ended`/pause/playing callbacks could complete a newly selected phrase or hide an error. Source generations isolate retried/replaced players, and pending seeks reject stale completion. Native paused media cannot be revived by a queued `playing` event.
- Edit preview could hit the ordinary phrase boundary before its requested end. Preview now owns its boundary while displayed text follows the actual preview position.
- A 100 ms poll and 45–50 ms early-stop thresholds could clip phrase endings or spill farther into the next cue at higher speed. The controller now samples every 20 ms and stops on the actual end timestamp. This remains browser-scheduled media control, not a promise of sample-accurate YouTube playback.
- Grouping overlapping captions used the final cue's end, which could truncate an earlier, longer cue. Groups retain the maximum source end.
- Manual SRT import could absorb adjacent numbered cues into the first caption's text when blank separators were absent. ZIP and manual imports now share the parser. Original caption timestamps and source text remain intact.
- Word-array indices were assumed to equal displayed token indices. Highlighting now requires a matching text/timing map, handles supplied multiword intervals, and stays static when the map is unreliable. No word timestamps are invented.

## Clock domains and bounds

Transcript/phrase/word times and saved position use original recording seconds. The transcript import offset is applied once when validating segments. For uploaded audio, the adapter converts using `mediaTime = transcriptTime + audioOffset`; it converts the clock back once for the controller. Available source bounds clamp full-recording seeks, and a phrase wholly outside an uploaded recording is blocked with offset/recovery guidance rather than playing unrelated audio.

Coverage excludes seek jumps. Next remains the action that marks a phrase Practised; replay, automatic progression and native seeking do not add practice marks.

## Existing lesson recovery

A versioned migration repairs only recognisable old parser contamination (caption timestamps embedded in generated text) or the generated overlapping-group end bug, and only for lessons without edit revisions. It preserves the raw source, audio, position, coverage, existing status records and matching phrase IDs. It adds an undo revision before changing generated phrases. Edited or otherwise ambiguous lessons are left untouched. Successful repairs are persisted once; repeated normal migrations do not rescan unchanged timing arrays.

## Verification and limits

Run `npm test` and `npm run build`. No lint script is configured.

For browser integration, start a **disposable** local server:

```sh
node scripts/dev.mjs --host 127.0.0.1 --port 4192
python tests/browser_sync.py --url http://127.0.0.1:4192
```

The script requires Playwright, Chromium and FFmpeg with flite. It replaces only the local development library. It synthesises three spoken phrases with known source boundaries, encodes an actual MP3 and exercises the actual app and media decoder. It covers native scrubbing, rapid seeks, replay, lead-in, 0.5×/1×/2× end boundaries, Automatic pauses, Continuous text/clock samples, minimise/expand, saved resume/refresh, and real ZIP MP3/SRT import. Native stopping is asserted within 120 ms of the cue end. Screenshots are captured in `/tmp`; the player was inspected at 320, 390, 820 and 1440px. Separate native clock checks covered offsets −1, 0 and +1 seconds.

YouTube API contract/event ordering is covered by Node tests. A live YouTube browser probe in this cloud environment failed to load `https://www.youtube.com/iframe_api` with `net::ERR_TUNNEL_CONNECTION_FAILED`. Real YouTube streaming, device-specific timing and background/mobile browser scheduling remain unverified; simulated API events are not evidence of live streaming success.
