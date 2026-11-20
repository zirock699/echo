# Echo Studio - Development Guide

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
# http://localhost:5173
```

## Development Commands

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview

# Type check
npm run type-check

# Run dev server with specific port
npm run dev -- --port 3000
```

## Project Architecture

### Component Hierarchy
```
App
├── Library (when no lesson selected)
│   └── CourseCard (repeated)
│       └── Lesson List (expandable)
└── Player (when lesson selected)
    ├── Thumbnail Background
    ├── Current Phrase Display
    ├── Playback Controls
    ├── Progress Bars
    └── Transcript Context (scrollable)
```

### Data Flow

1. **Initialization**
   - App loads IndexedDB
   - Fetches all courses and lessons
   - Sets state

2. **Importing**
   - User selects ZIP file
   - `zipImporter.ts` parses and validates
   - Extracts lessons, stores in IndexedDB
   - UI updates with new courses

3. **Playing**
   - User selects lesson from Library
   - Player loads audio URL from IndexedDB
   - SRT cues display
   - Audio synchronization begins
   - User controls playback

### Key Services

#### `storage.ts` - Database Layer
```typescript
// Courses
await saveCourse(course)
await getCourse(id)
await getAllCourses()
await deleteCourse(id)

// Lessons
await saveLesson(lesson)
await getLesson(id)
await getLessonsByCourse(courseId)
await deleteLesson(id)

// Assets (audio/images)
await saveAsset({ lessonId, type, blob, mimeType })
await getAsset(lessonId, type)
await deleteAsset(lessonId, type)
```

#### `zipImporter.ts` - ZIP Processing
```typescript
const result = await importZipFile(zipFile, courseName?, courseId?)
// Returns:
// {
//   course: Course,
//   lessons: Lesson[],
//   progress: ImportProgress,
//   errors: { [folder]: string }
// }
```

#### `srtParser.ts` - Transcript Parsing
```typescript
const cues = parseSRT(srtContent)
// Returns: TranscriptCue[]

const timeString = formatTime(seconds)
// Returns: "MM:SS.mmm" or "H:MM:SS"
```

#### `audioSync.ts` - Audio Controller
```typescript
const controller = createAudioSyncController()
controller.initialize(audioUrl)
controller.setLesson(lesson)
controller.play()
controller.pause()
controller.seek(time)
controller.nextCue()
controller.previousCue()
controller.replayCue()
controller.setPlaybackRate(rate)
controller.onCueChangeCallback(callback)
```

### Component Details

#### `Player.tsx`
- Receives: `lesson`, `audioUrl`, `onProgressUpdate?`
- Manages: audio element, playback state, cue tracking
- Renders: phrase, controls, timelines, transcript context
- Uses: HTML5 Audio API, refs for audio element

#### `Library.tsx`
- Receives: `courses`, `lessons` Map, callbacks
- Manages: search query, expanded course state
- Renders: search bar, import button, course cards
- File upload: accepts `.zip` files

#### `App.tsx`
- Manages: global state (courses, lessons, selected lesson)
- Handles: database init, import flow, lesson selection
- Routing: Library view vs. Player view

---

## Data Types

### Course
```typescript
interface Course {
  id: string              // Unique identifier
  title: string          // Course name
  description?: string   // Optional description
  coverUrl?: string      // Lesson thumbnail
  category?: string      // Category (e.g., "Interviews")
  tags: string[]         // Custom tags
  isPinned: boolean      // Pinned to top?
  createdAt: number      // Timestamp
  updatedAt: number      // Last modified
  lessonsCount: number   // # of lessons
  completedCount: number // # completed
  lastAccessedAt?: number // Last opened
}
```

### Lesson
```typescript
interface Lesson {
  id: string              // Unique identifier
  courseId: string       // Parent course
  videoId: string        // YouTube video ID (for reference)
  title: string          // Lesson title
  channel?: string       // Creator/channel
  youtubeUrl?: string    // Original URL
  durationSeconds: number
  audioUrl?: string      // Blob URL for audio
  thumbnailUrl?: string  // Blob URL for image
  frameUrl?: string      // Blob URL for frame
  transcriptCues: TranscriptCue[]
  practisedCount: number
  isCompleted: boolean
  tags: string[]
  importedAt: number
  lastPlayedAt?: number
  lastPlayedPosition?: number
}
```

### TranscriptCue
```typescript
interface TranscriptCue {
  id: string          // "cue-0", "cue-1", etc.
  startTime: number   // Seconds (float)
  endTime: number     // Seconds (float)
  text: string        // Subtitle text
}
```

---

## Styling

### Tailwind Classes Used
- `bg-slate-*` - Background colors (slate-900, slate-950, slate-800, etc.)
- `text-slate-*` - Text colors
- `border-slate-*` - Borders
- `rounded-*` - Border radius
- `p-*` - Padding
- `m-*` - Margins
- `gap-*` - Gaps
- `w-*` - Width
- `h-*` - Height
- `flex` - Flexbox
- `grid` - Grid layout
- `overflow-*` - Overflow handling
- `hover:*` - Hover states
- `transition` - Smooth transitions
- `opacity-*` - Opacity

### Color Palette
- **Primary:** Violet-600 (`#7c3aed`)
- **Background Dark:** Slate-950 (`#030712`)
- **Background Medium:** Slate-900 (`#0f172a`)
- **Background Light:** Slate-800 (`#1e293b`)
- **Text:** Slate-100/300/400
- **Borders:** Slate-700

### Responsive Breakpoints
- Mobile: default (320px+)
- Tablet: `md:` (768px+)
- Desktop: `lg:` (1024px+)

---

## Common Tasks

### Add a New Control to Player
1. Add button in Player's control section
2. Create handler function
3. Update audio or state
4. Persist if needed

Example:
```typescript
const handleMute = () => {
  if (audioRef.current) {
    audioRef.current.muted = !audioRef.current.muted
    // Update UI state if needed
  }
}

// In JSX:
<button onClick={handleMute}>
  {isMuted ? <VolumeX /> : <Volume2 />}
</button>
```

### Add a Filter to Library
1. Add state for filter in Library component
2. Add UI control (button/select)
3. Apply filter to courses array
4. Re-render filtered list

Example:
```typescript
const [filterTag, setFilterTag] = useState<string | null>(null)

const filtered = courses.filter(c =>
  !filterTag || c.tags.includes(filterTag)
)
```

### Modify Import Flow
1. Edit `zipImporter.ts` for parsing logic
2. Edit `App.tsx` for state management
3. Edit `Library.tsx` for UI
4. Test with sample ZIP

### Add Progress Persistence
1. Update `Lesson` interface with fields
2. Modify `storage.ts` to handle new fields
3. Update Player to track events
4. Save via `saveLesson()` on changes

---

## Debugging

### Check IndexedDB
Open browser DevTools → Application → IndexedDB → EchoStudio
- View courses, lessons, assets
- Inspect blob sizes
- Verify data structure

### Audio Debugging
```typescript
// In Player.tsx, add:
const handleTimeUpdate = () => {
  console.log('Time:', audioRef.current?.currentTime)
  console.log('Cue:', currentCue?.text)
  // ... existing code
}
```

### Import Debugging
```typescript
// In App.tsx, modify import handler:
catch (error) {
  console.error('Import error:', error)
  console.error('Stack:', error instanceof Error ? error.stack : 'N/A')
  setImportError(`Debug: ${String(error)}`)
}
```

### React DevTools
- Install React DevTools browser extension
- Inspect component hierarchy
- Check props and state
- Track re-renders

---

## Performance Optimization

### Current Performance
- Build: ~2 seconds
- Initial load: <2s
- Audio startup: <500ms
- Cue lookup: O(n) scan (adequate for <1000 cues)

### Potential Optimizations
1. **Memoize components**
   ```typescript
   export const Player = memo(({ lesson, audioUrl }: PlayerProps) => {
     // ...
   })
   ```

2. **Virtualize long lists**
   - For 1000+ cues, use react-window
   - Keeps DOM manageable

3. **Code splitting**
   - Split Library and Player into separate bundles
   - Load on demand

4. **Image optimization**
   - Compress JPEG thumbnails
   - Generate WebP versions

5. **IndexedDB indexing**
   - Add index on courseId (already done)
   - Add index on lastPlayedAt for sorting

---

## Testing

### Manual Testing Checklist
- [ ] Import ZIP file
- [ ] Course created and visible
- [ ] Lessons appear with correct metadata
- [ ] Thumbnails display
- [ ] Audio plays
- [ ] Transcript syncs with audio
- [ ] Seek by clicking timeline
- [ ] Speed control works
- [ ] Previous/Next buttons work
- [ ] Replay button works
- [ ] Search filters courses
- [ ] Progress bar updates
- [ ] Mobile layout looks good
- [ ] Data persists after refresh
- [ ] No console errors

### Browser Testing
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Deployment

### Build for Production
```bash
npm run build
# Creates: dist/
```

### Local Preview
```bash
npm run preview
# Serves dist/ locally
```

### Deploy to ChatGPT Sites
1. Zip the `dist/` directory
2. Upload to ChatGPT Sites
3. Configure server functions for:
   - ZIP upload handling
   - Database operations
4. Update storage layer to call server functions

See `IMPLEMENTATION_SUMMARY.md` for detailed migration guide.

---

## Troubleshooting

### Audio not playing
- Check browser console for errors
- Verify audio blob exists in IndexedDB
- Test audio.play() in console
- Check browser autoplay restrictions

### SRT not parsing
- Verify SRT format: `HH:MM:SS,mmm --> HH:MM:SS,mmm`
- Check for UTF-8 BOM
- Log parseSRT output

### ZIP import fails
- Verify ZIP structure matches spec
- Check file sizes (>100MB may be slow)
- Look for invalid characters in filenames
- Check errors in console

### UI not responding
- Open DevTools Performance tab
- Check for long tasks (>50ms)
- Look for memory leaks (DevTools Memory)
- Restart dev server if build cache corrupted

---

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com)
- [Vite Documentation](https://vitejs.dev)
- [MDN Web Docs - Audio API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement)
- [MDN - IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

## Notes for Future Developers

1. **Storage layer is abstraction-ready** - All DB code in one place
2. **Audio sync is modular** - Can be enhanced independently
3. **UI components are small** - Easy to modify individual features
4. **TypeScript is strict** - Helps catch bugs early
5. **No external backend yet** - Plan for server functions before migration

---

Good luck with development! 🚀
