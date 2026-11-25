import { fmtTime } from './transcript.mjs';

const journalDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const lessonAddedAt = lesson => lesson.importedAt || lesson.createdAt || 0;
const journalModes = new Map([['manual', 'Manual'], ['automatic', 'Automatic'], ['continuous', 'Continuous']]);

function referenceFor(data) {
  return data.lessons.find(lesson => lesson.id === data.lastLessonId) ??
    data.lessons.reduce((latest, lesson) => {
      return !latest || lessonAddedAt(lesson) > lessonAddedAt(latest) ? lesson : latest;
    }, null);
}

function resumeReference(lesson, icon, escape, lessonArtwork) {
  const speaker = lesson.speaker || lesson.channel;
  const position = lesson.progress?.position;
  const detail = [speaker, position > 0 ? `${fmtTime(position)} in the recording` : 'Ready to start']
    .filter(Boolean).join(' · ');
  return `<button id="home-resume" class="home-resume" type="button" data-action="open-lesson" data-id="${escape(lesson.id)}" aria-label="Resume lesson" aria-describedby="home-resume-title home-resume-detail">
    ${lessonArtwork(lesson)}
    <span class="home-resume-copy"><strong id="home-resume-title">${escape(lesson.title)}</strong><small id="home-resume-detail">${escape(detail)}</small></span>
    <span class="home-resume-play" aria-hidden="true">${icon('play')}</span>
  </button>`;
}

export function renderHome({ data, icon, escape, lessonArtwork, shelvesHTML = '' }) {
  const resume = referenceFor(data);
  return `<main class="home-screen rehearsal-home" id="rehearsal-main">
    <header class="home-appbar">
      <h1>Home</h1>
      <button class="btn ghost" type="button" data-action="view" data-view="search">${icon('search')} Search</button>
    </header>
    ${resume ? `<section class="home-continue" aria-labelledby="home-continue-heading">
      <h2 id="home-continue-heading">${resume.id === data.lastLessonId ? 'Continue practising' : 'Most recent lesson'}</h2>
      ${resumeReference(resume, icon, escape, lessonArtwork)}
    </section>` : `<section class="first-lesson" aria-labelledby="home-empty-heading">
      <h2 id="home-empty-heading">Add your first lesson</h2>
      <p>Import a ZIP or add a YouTube link and transcript.</p>
      <button id="home-add-lesson" class="btn primary" type="button" data-action="open-add">${icon('plus')} Add lesson</button>
    </section>`}
    ${shelvesHTML}
    ${shelvesHTML ? '<button id="home-manage-categories" class="text-link home-manage-categories" type="button" data-action="home-categories">Manage categories</button>' : ''}
  </main>`;
}

function journalTimestamp(session, escape) {
  const date = new Date(session.finishedAt || session.startedAt);
  return Number.isFinite(date.getTime())
    ? `<time class="journal-entry-date" datetime="${date.toISOString()}">${escape(journalDate.format(date))}</time>`
    : '<small class="journal-entry-date">Earlier session</small>';
}

function sessionDetails(session) {
  const details = [];
  const mode = journalModes.get(session.mode);
  if (mode) details.push(mode);
  if (session.activeSeconds > 0) details.push(session.activeSeconds < 1 ? 'Less than a second of listening' : `${fmtTime(session.activeSeconds)} listening`);
  if (session.metricsVersion === 1 && Array.isArray(session.coveredIds)) {
    const heard = session.coveredIds.length;
    if (heard) details.push(`${heard} ${heard === 1 ? 'phrase' : 'phrases'} heard`);
    if (session.practised > 0) details.push(`${session.practised} marked practised`);
    if (session.difficult > 0) details.push(`${session.difficult} marked difficult`);
  }
  return details.join(' · ') || 'Reference practice';
}

export function renderJournal({ data, icon, escape }) {
  const lessons = new Map(data.lessons.map(lesson => [lesson.id, lesson]));
  const visibleSessions = data.sessions.slice(0, 100);
  const entries = visibleSessions.map((session, index) => {
    const lesson = lessons.get(session.lessonId);
    const rowId = escape(session.id || `older-${index}`);
    const note = typeof session.journalNote === 'string' ? session.journalNote.trim() : '';
    return `<li class="journal-entry">
      <div class="journal-entry-copy">
        ${journalTimestamp(session, escape)}
        <h2 class="journal-entry-title" id="journal-lesson-${rowId}">${escape(lesson?.title || 'Deleted lesson')}</h2>
        <p class="journal-entry-detail">${escape(sessionDetails(session))}</p>
        ${note ? `<p class="journal-entry-note">${escape(note)}</p>` : ''}
      </div>
      ${lesson ? `<button class="text-link journal-entry-open" id="journal-resume-${rowId}" type="button" data-action="journal-resume" data-id="${escape(lesson.id)}" aria-describedby="journal-lesson-${rowId}">${icon('play')} Open saved reference</button>` : ''}
    </li>`;
  }).join('');
  return `<main class="rehearsal-journal" id="rehearsal-main">
    <header class="rehearsal-journal-header"><h1>Journal</h1><p>Pick up where a rehearsal left off.</p></header>
    ${entries ? `<ol class="journal-list" aria-label="Completed reference sessions">${entries}</ol>${data.sessions.length > visibleSessions.length ? '<p class="muted">Showing 100 sessions.</p>' : ''}` : `<section class="journal-empty" aria-labelledby="journal-empty-heading">
      <h2 id="journal-empty-heading">Your first session belongs here</h2><p>Finish a reference session to keep a record of what you practised.</p>
      <button class="btn primary" type="button" data-action="view" data-view="home">${icon('home')} Go to Home</button>
    </section>`}
  </main>`;
}
