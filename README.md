# Echo Studio

A beautiful, mobile-first speech-shadowing application for improving spoken English pronunciation, fluency, and confidence.

## Features

- ✅ **ZIP-based Lesson Importing** - Import pre-processed YouTube content with audio and transcripts
- ✅ **Audio-First Player** - Large, readable transcript with synchronized audio playback
- ✅ **Course Organization** - Organize lessons into courses with tagging and search
- ✅ **Phrase Navigation** - Jump to any phrase, replay, and control playback speed
- ✅ **Progress Tracking** - Track completed lessons and phrases
- ✅ **Mobile Responsive** - Optimized for mobile (320px+) with desktop support
- ✅ **Persistent Storage** - All data saved locally using IndexedDB

## Architecture

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS for styling
- Lucide Icons for UI components

**Storage:**
- IndexedDB for local persistence (abstracted for D1 migration to ChatGPT Sites)

**ZIP Import:**
- JSZip for ZIP parsing and validation
- Robust error handling with detailed feedback

**Audio/Transcript:**
- HTML5 Audio API for playback
- SRT subtitle parsing with accurate timestamp synchronization

## Project Structure

```
src/
├── components/
│   ├── Player.tsx        # Main audio player with transcript sync
│   └── Library.tsx       # Course and lesson browser
├── services/
│   ├── storage.ts        # IndexedDB abstraction
│   ├── zipImporter.ts    # ZIP file processing
│   ├── srtParser.ts      # SRT parsing
│   └── audioSync.ts      # Audio playback controller
├── types/
│   └── index.ts          # TypeScript interfaces
├── styles/
│   └── globals.css       # Tailwind setup
├── App.tsx               # Main app component
└── main.tsx              # React entry point
```

## ZIP File Format

Expected structure produced by the Python importer:

```
echo_media/
├── manifest.json
├── video_id_001/
│   ├── audio.mp3
│   ├── transcript.srt
│   ├── thumbnail.jpg
│   ├── frame.jpg (optional)
│   └── metadata.json
└── video_id_002/
    ├── audio.mp3
    ├── transcript.srt
    ├── thumbnail.jpg
    └── metadata.json
```

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build

```bash
npm run build
npm run preview
```

## Usage

1. **Import ZIP:**
   - Click the "Import" button in the Library
   - Select a ZIP file from your Python importer output
   - Choose a destination course (new or existing)
   - Lessons are imported automatically

2. **Practice:**
   - Select a course and lesson from the Library
   - The player opens with the transcript displayed
   - Use controls to play, pause, replay, and navigate phrases
   - Use the speed control to slow down playback

3. **Manage Content:**
   - Search courses and lessons
   - Track progress visually
   - View lesson details in the sidebar

## Platform-Specific Features

### Mobile
- Full-screen player experience
- Bottom-oriented controls for thumb-friendly interaction
- Scrollable transcript with context
- Collapsible sidebar
- Swipe-friendly navigation

### Desktop
- Split-view with library on left, player on right
- Sidebar with lesson details
- Keyboard support for common actions

## Data Persistence

All data is stored locally in IndexedDB:
- Courses and lesson metadata
- Audio and image assets
- Progress and completion status
- Playback positions

Data persists across browser restarts. For cross-device sync, export/import functionality can be added, or migration to ChatGPT Sites' D1 database can be implemented.

## Known Limitations

- Audio playback requires a supported browser
- Very large ZIP files (>500MB) may require extended import time
- Mobile browsers have restrictions on continuous background playback
- Some browsers restrict autoplay of audio without user interaction

## Future Enhancements

- IPA pronunciation guidance
- Speaker identification and filtering
- Recording and playback comparison
- Session history and statistics
- Cross-device synchronization via D1 migration
- PWA installation support
- Keyboard shortcuts

## Deployment to ChatGPT Sites

This application is designed to migrate to ChatGPT Sites:

1. Storage layer is abstracted and can be switched from IndexedDB to D1
2. Static assets can be hosted on ChatGPT Sites
3. Server-side functions can handle ZIP uploads and validation
4. Authentication can be added via ChatGPT Sites' built-in auth

See inline comments in `src/services/storage.ts` for D1 migration notes.

## License

Private application for personal use.

---

**Built with React, TypeScript, and Tailwind CSS**