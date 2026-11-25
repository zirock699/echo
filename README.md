# Echo Studio

An audio-first speech-shadowing app, with YouTube and private uploaded-audio playback, timestamped transcript import, phrase practice, progress, collections and British IPA guidance.

See [spec.md](spec.md) for the original specification, reference-driven redesign and confirmed updates. Latest mobile viewport rules take precedence.

## Run and verify

The browser uses locally vendored ESM assets. No install is required to run the checked-in code.

```sh
npm start
```

Open http://127.0.0.1:4173. `npm start`, `npm run dev` and `node scripts/dev.mjs` run the same development server with disposable in-memory database and audio storage.

```sh
npm test
npm run build
```

The build creates a Worker at `dist/server/index.js`, embedding the versioned app shell and routing `/api/state` and `/api/audio`. Sites uses managed D1 `DB`, R2 `BUCKET` and trusted authenticated owner identity. Preserve `.openai/hosting.json` when updating the existing site. Use `server/schema.sql` to provision a fresh database. For an existing original database, bring its recorded migrations through `drizzle/0000_user_state.sql` and the additive `drizzle/0001_snapshot_payload.sql` before serving the new Worker. A database that already uses the current schema has the payload column. After the first media retirement record is written, rollback requires a Worker that can read the retirement ledger.

`colorthief` is pinned in package.json; its browser bundle and licence are checked in for dependency-free browser execution.

`npm test` includes a smoke test for a freshly built Worker. To run the browser checks, use Python with Playwright and Chromium. The spoken-audio checks also require FFmpeg with `flite` and `libmp3lame`.

```sh
python3 tests/browser_navigation.py
python3 tests/browser_original_playback.py
python3 tests/browser_sync.py
python3 tests/browser_private_library.py
python3 tests/browser_media_integrity.py
python3 tests/browser_practice_integrity.py
python3 tests/browser_first_practice.py
python3 tests/browser_player_focus.py
python3 tests/browser_queue_window.py
python3 tests/browser_playback_scale.py
python3 tests/browser_offline.py
```

Each script starts its own loopback service with synthetic data. The playback scale check reports timings for the 36-lesson and 16,950-cue audit workload and requires FFmpeg with `libmp3lame`. The offline check exercises a built Worker and uses real Chromium service workers. The older `browser_smoke.py` and `browser_extended.py` are historical inline fixtures.

After the first online visit installs the app shell, a fresh offline tab can open the shell and retry sign-in when the connection returns. A previously verified open tab can keep working from its owner-scoped data during an outage. Private state and audio are excluded from the app shell cache. An updated shell takes over when the previous version's tabs close.

## ZIP import and courses

Use **Library → Import** for ZIP packages containing audio, captions, artwork and metadata. See [ZIP import, course management, storage limits and verification](docs/ZIP_IMPORT.md). Existing lessons and collections are retained.

## Echo Mirror

Timed audio lessons support listen-then-record practice with an expandable waveform comparison and explicitly saved device-local attempts. See [Echo Mirror behaviour, privacy and limits](docs/ECHO_MIRROR.md).

## Main files

- `src/app.mjs`: views, importing, lesson settings, queue and event handling.
- `src/player.mjs`, `src/audio.mjs`: shared playback controller and native audio adapter.
- `src/player-layout.mjs`, `src/mobile-player.css`: fixed mobile viewport, feedback and phrase fitting.
- `src/transcript.mjs`: SRT, VTT, JSON and timestamped text parsing and segmentation.
- `src/store.mjs`: IndexedDB cache and optimistic D1 snapshot synchronisation.
- `src/ambient.mjs`: cached thumbnail palette extraction with fallback.
- `server/`: authenticated persistence and private audio storage.
- `tests/`: automated checks and browser QA fixtures.

## Verification limits

The local checks exercise native audio, including generated ZIP audio uploads. Live YouTube streaming, physical Android behaviour and hosted storage and sign-in still need separate verification. The IPA lexicon is a starter set. Persistence uses versioned per-owner snapshots with explicit conflict resolution.

This is a source export. Repository publication does not by itself redeploy the existing ChatGPT Site. No credentials, personal lessons, uploaded recordings or local caches are included.
