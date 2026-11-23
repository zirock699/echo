# ZIP courses and audio-first library

Use **Add lessons → Import ZIP** from Home, Library, the mobile Add tab or desktop sidebar, choose a ZIP, review detected lessons and warnings, then select an existing course or name a new course. Course category/tags are optional and are never inferred from accent or content. Confirm to upload each lesson's audio and images to the existing authenticated private bucket and save its metadata through the versioned library API.

Both `echo_media/<video-id>/…` and direct lesson folders work, including an additional enclosing folder. A manifest establishes ordering; missing or malformed manifests fall back to discovery. Metadata paths have conventional-filename fallbacks. Audio can be MP3, M4A, AAC, WAV, OGG, WebM or FLAC when supported by the browser. Invalid headers or undecodable audio are skipped. One failed lesson does not cancel valid lessons.

Valid captions survive malformed neighbouring cues; warnings identify skipped cues. Caption discovery tolerates case differences, conventional caption names, a unique SRT/VTT in the lesson folder and UTF-16 exports. Existing broken imports with recoverable stored source are repaired without resetting progress; otherwise re-import the package with **Repair missing transcripts only**, which retains audio and course membership. Original SRT is retained verbatim in the lesson's `source` field; `transcriptAsset` identifies that source. Parsed cues are a separate editable layer. Missing or invalid transcripts produce audio-only lessons, with phrase-dependent actions disabled. Transcript replacement and the existing non-destructive regroup/undo tools remain available. Artwork prefers thumbnail, then frame, then a neutral placeholder. No YouTube media is extracted by Echo Studio.

## Duplicates

External video ID is the primary identity. Import options are:

- Skip the existing lesson.
- Move/reuse the existing lesson in the destination course without uploading another audio copy.
- Replace assets and transcript, retaining lesson identity, playback position, completion and conservatively remapped practice markers. This is an explicit selection, never the default.

A lesson has one parent course. Moving it preserves progress and removes its old course membership. Existing collections remain independent and old lessons stay available after schema migration.

## Organisation

Library defaults to Courses when courses exist; Lessons and Unassigned are separate views, avoiding duplicate course content on the landing screen. Search spans all courses and lessons. List/grid preferences are device-local. Results are paginated at 24 items, including inside courses; selection can explicitly include all filtered results across pages. ZIP preview/results are paginated at eight items and confirmation stays fixed outside the scrolling dialog body. Library search includes courses, lesson titles, source channels, categories and tags. Status chips combine with category/tag/course filters and recent/played/title/progress sorting. Pinned courses precede other courses. Course entry clears root-only filters and Back restores the prior filter/page context. Course detail preserves the ordered lesson list and offers Continue, metadata/cover edits and accessible up/down reorder controls.

Use **Select** on any input device or long-press an item on touch screens. Select filtered items and apply valid bulk operations. Categories and tags can be managed across the library. Course deletion preserves its lessons by default; deleting contained lessons is a separate explicit choice. Destructive deletes require confirmation.

## Persistence and boundaries

- Production uses the existing Sites `DB` and `BUCKET` bindings and trusted owner identity. Audio/images are private file objects, not base64 state. Reads, range requests and deletes are owner-scoped.
- The browser caches library metadata in IndexedDB. That cache alone does not provide cross-device audio storage. Failed cloud saves retain pending local changes and use existing conflict/retry handling.
- `node scripts/dev.mjs` uses disposable in-memory preview stores. Page refresh persistence was tested; stopping the preview server discards its server assets/state. Production persistence depends on the managed bindings.
- ZIP limit: 300 MB compressed, 600 MB declared extracted, 5,000 entries and 50 MB per file. Very high expansion ratios, unsafe paths, symlinks, duplicate paths, unsupported payloads, encryption, split ZIPs and ZIP64 are rejected. Metadata/transcripts are limited to 2 MB each; artwork uploads are limited to 5 MB. Preview images are capped to avoid retaining an entire archive's artwork in memory.
- The existing state API has a 3 MB metadata snapshot limit. Import uses a conservative 2.7 MB preflight threshold, including transcripts and cues, and reports skipped lessons when the library approaches it. This remains a scalability limit for transcript-heavy libraries; supporting larger libraries requires a separate per-lesson document persistence migration, not embedding media in snapshots.
- Cancel finishes the current file, retains completed lessons and discards uncommitted lesson uploads where deletion is reachable. Failed individual imports attempt cleanup of their uploaded files. A browser/process crash between upload and commit can leave unreferenced private objects; server-side garbage collection is not present in this hosting API.
- Practice recording uses MediaRecorder and microphone permission on a secure origin. Recordings are local to the current browser session with a download option, not synced. They stop when closing options or navigating away. Physical-device permissions and codec support vary.

## Verification and publication

`npm test` covers the existing playback/persistence functionality plus ZIP integrity/path rejection, wrapped/root discovery, manifest fallback, invalid SRT, missing audio/metadata, migration, progress-preserving moves and combined filters. `npm run build` embeds new browser modules into the existing Worker. No lint script is configured.

Browser integration was exercised with generated valid WAV and encoded MP3 packages, including invalid audio, missing/invalid captions, skip/reuse/replace, microphone simulation, bulk tags, moves, pinning, refresh and 320/375/430/tablet/desktop/landscape layouts. Generated fixtures are test data, not production lessons. Real YouTube streaming and physical-device microphone behaviour remain separate checks.

Preserve `.openai/hosting.json`. Building or pushing Git commits does not deploy the hosted Site. This environment exposes no deployment tool or authenticated deployment command; publish through the existing Site's supported workflow when available.

## Scale boundaries

Bounded rendering was regression-tested with 10,000 in-memory results; only 24 rows are mounted per page. This does not imply support for storing a million lessons. The existing backend still accepts at most 3,000 lessons and a 3 MB versioned metadata snapshot. Pagination solves unbounded DOM/scroll length, not those persistence limits. Larger-scale storage needs a separate per-lesson persistence/API migration.
