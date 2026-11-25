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
  return `<button class="rehearsal-row home-resume" type="button" data-action="open-lesson" data-id="${escape(lesson.id)}" aria-label="Resume lesson">
    <span class="rehearsal-row-art">${lessonArtwork(lesson)}</span>
    <span class="rehearsal-row-copy"><strong>${escape(lesson.title)}</strong><small>${escape(detail)}</small></span>
    <span class="rehearsal-row-arrow rehearsal-resume-play" aria-hidden="true">${icon('play')}</span>
  </button>`;
}

export function renderRehearse({ data, icon, escape, lessonArtwork, browseHTML = '', browseOpen = false }) {
  const resume = referenceFor(data);
  const canBrowse = data.lessons.length || data.courses?.length || data.collections?.length;
  const shelves = browseOpen && typeof browseHTML === 'function' ? browseHTML() : browseOpen ? browseHTML : '';
  return `<main class="home-screen rehearsal-home" id="rehearsal-main">
    <section class="rehearsal-hero" aria-labelledby="rehearsal-heading">
      <div class="rehearsal-hero-copy">
        <h1 id="rehearsal-heading">Rehearse the change.</h1>
        <p>Your colleague expects the figures on Tuesday. The plan has changed. Give them a short update.</p>
        <button id="home-speaking-prompt" class="btn primary home-prompt" type="button" aria-haspopup="dialog" data-action="home-speaking-prompt">${icon('wave')} Talk now</button>
      </div>
      <div class="rehearsal-hero-art" aria-hidden="true"></div>
    </section>
    <div class="rehearsal-starts">
      <section${resume ? '' : ' class="first-lesson"'} aria-labelledby="rehearsal-reference-heading">
        <h2 class="rehearsal-group-title" id="rehearsal-reference-heading">${resume ? 'Resume a reference' : 'Add your first lesson'}</h2>
        ${resume ? resumeReference(resume, icon, escape, lessonArtwork) : `<button class="rehearsal-row" type="button" data-action="open-add" aria-label="Add lessons" aria-describedby="rehearsal-add-imports">
          <span class="rehearsal-row-art" aria-hidden="true">${icon('plus')}</span>
          <span class="rehearsal-row-copy"><strong>Add lessons</strong><small id="rehearsal-add-imports">Import a ZIP or prepare a YouTube reference.</small></span>
          <span class="rehearsal-row-arrow" aria-hidden="true">${icon('chevron')}</span>
        </button>`}
      </section>
      <section aria-labelledby="rehearsal-focus-heading">
        <h2 class="rehearsal-group-title" id="rehearsal-focus-heading">Choose a focus</h2>
        <button class="rehearsal-row" type="button" data-action="home-drills" id="rehearsal-pick-drill" aria-haspopup="dialog" aria-label="Pick a speaking drill" aria-describedby="rehearsal-drill-description">
          <span class="rehearsal-row-art" aria-hidden="true">${icon('spark')}</span>
          <span class="rehearsal-row-copy"><strong>Pick a speaking drill</strong><small id="rehearsal-drill-description">Try a short exercise for a specific part of your delivery.</small></span>
          <span class="rehearsal-row-arrow" aria-hidden="true">${icon('chevron')}</span>
        </button>
      </section>
    </div>
    <section class="rehearsal-browse" aria-label="Browse references">
      <div class="rehearsal-browse-actions">
        ${canBrowse ? `<button class="text-link rehearsal-browse-toggle" id="rehearsal-browse-toggle" type="button" data-action="home-browse" aria-expanded="${browseOpen}" aria-controls="home-browse-shelves">${browseOpen ? 'Hide reference shelves' : 'Browse reference shelves'}</button>` : ''}
        <button id="home-manage-categories" class="text-link home-manage-categories" type="button" data-action="home-categories">Manage categories</button>
      </div>
      ${canBrowse ? `<div id="home-browse-shelves"${browseOpen ? '' : ' hidden'}>${shelves}</div>` : ''}
    </section>
  </main>`;
}

export function renderDrills({ icon, escape, activities }) {
  return `<ul class="rehearsal-drills">${activities.map(activity => `<li>
    <button class="rehearsal-row" id="rehearsal-drill-${escape(activity.id)}" type="button" data-action="start-drill" data-id="${escape(activity.id)}" aria-labelledby="rehearsal-drill-title-${escape(activity.id)}" aria-describedby="rehearsal-drill-detail-${escape(activity.id)}">
      <span class="rehearsal-row-art" aria-hidden="true">${icon(activity.icon || 'spark')}</span>
      <span class="rehearsal-row-copy"><strong id="rehearsal-drill-title-${escape(activity.id)}">${escape(activity.title)}</strong><small id="rehearsal-drill-detail-${escape(activity.id)}">${escape(activity.description)}</small></span>
      <span class="rehearsal-row-arrow" aria-hidden="true">${icon('chevron')}</span>
    </button>
  </li>`).join('')}</ul>`;
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
      <button class="btn primary" type="button" data-action="view" data-view="home">${icon('home')} Go to Rehearse</button>
    </section>`}
  </main>`;
}
