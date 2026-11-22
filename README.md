# Echo Studio

An audio-first speech-shadowing app, with YouTube and private uploaded-audio playback, timestamped transcript import, phrase practice, progress, collections and British IPA guidance.

See [spec.md](spec.md) for the original specification, reference-driven redesign and confirmed updates. Latest mobile viewport rules take precedence.

## Run and verify

The browser uses locally vendored ESM assets. No install is required to run the checked-in code.

```sh
node scripts/dev.mjs
```

Open http://127.0.0.1:4173. This development server provides disposable in-memory D1 and audio storage. It does not connect to production data.

```sh
npm test
npm run build
```

The build creates a Worker at `dist/server/index.js`, embedding the browser assets and routing `/api/state` and `/api/audio`. Sites uses managed D1 `DB`, R2 `BUCKET` and authenticated owner identity. Preserve `.openai/hosting.json` when updating the existing site. Apply `server/schema.sql` when provisioning a fresh database.

`colorthief` is pinned in package.json; its browser bundle and licence are checked in for dependency-free browser execution.

## ZIP import and courses

Use **Library → Import** for ZIP packages containing audio, captions, artwork and metadata. See [ZIP import, course management, storage limits and verification](docs/ZIP_IMPORT.md). Existing lessons and collections are retained.

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

39 automated tests and the Worker build pass. Real YouTube streaming stalled in the test browser and remains unverified end to end. Browser audio uploads and real-device Android behaviour still need verification. The IPA lexicon is a starter set. Persistence uses versioned per-owner snapshots, with explicit conflict resolution rather than field-level merging.

This is a source export. Repository publication does not by itself redeploy the existing ChatGPT Site. No credentials, personal lessons, uploaded recordings or local caches are included.
