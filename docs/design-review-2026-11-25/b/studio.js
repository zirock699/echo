const root = document.getElementById('app');
const announcement = document.getElementById('announcement');

const ICONS = {
  logo: '<path d="M3 13h3l3-7 4 13 3-8h5"/>',
  rehearse: '<path d="M4 20V4h16v16M4 15h16M8 8v3m4-4v5m4-4v3"/>',
  library: '<path d="M4 4v16M9 4v16M14 5l5 15"/>',
  journal: '<path d="M5 3h13a1 1 0 0 1 1 1v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m-2 14c0-1 1-2 2-2h13M8 7h7M8 10h5"/>',
  play: '<path d="m8 5 12 7-12 7z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  restart: '<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>',
  next: '<path d="m5 5 10 7-10 7zM19 5v14"/>',
  back: '<path d="m12 6-6 6 6 6M6 12h14"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 5 5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.3 1.1 6L12 17l-5.6 2.9 1.1-6L3 9.6l6.2-.9z"/>',
  settings: '<path d="M3 6h18m-18 6h18m-18 6h18"/><path d="M8 3v6m8 0v6m-5 0v6"/>',
  queue: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  compare: '<path d="M3 19V8m4 14V4m4 13V9m4 10V6m4 14V4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2m-6 8v3m-3 0h6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4 10-9"/>',
  folder: '<path d="M3 19V5h7l2 3h9v11z"/>',
  focus: '<path d="M6 5H4v3m14-3h2v3M6 19H4v-3m14 3h2v-3M9 12h6M12 9v6"/>',
  quote: '<path d="M4 6h6v6l-3 5M14 6h6v6l-3 5"/>',
  message: '<path d="M4 4h16v12H9l-5 4zM8 8h8m-8 4h5"/>',
};

const MEDIA = '../assets/';
const PORTRAIT = './assets/rehearsal.webp';
const STUDIO = './assets/studio.webp';
const LESSONS = [
  { id: 'deadline', title: 'Move a deadline', speaker: 'Nina Patel', duration: '02:18', collection: 'Work conversations' },
  { id: 'disagree', title: 'Disagree without shutting down the idea', speaker: 'Ellis Morgan', duration: '03:06', collection: 'Work conversations', text: 'I see the appeal. Could we test it on one project first?', time: 54, length: 4.14, file: 'reference-ellis.mp3' },
  { id: 'update', title: 'Give a clearer update', speaker: 'Maya Reid', duration: '01:54', collection: 'Speaking clearly', text: 'Here’s what changed since we last spoke.' },
  { id: 'request', title: 'Make the request land', speaker: 'Nina Patel', duration: '02:41', collection: 'Speaking clearly', text: 'Would you be able to send it before lunch?' },
  { id: 'flow', title: 'Keep the conversation moving', speaker: 'Ellis Morgan', duration: '02:36', collection: 'Work conversations', text: 'What’s the next thing you’d want to find out?' },
];
const PHRASES = [
  { time: 38, length: 2.66, text: 'I need a little more time with the figures.', file: 'reference-before.mp3' },
  { time: 42, length: 2.55, text: 'Could we move the review to Thursday?', file: 'reference.mp3' },
  { time: 46, length: 3.08, text: 'I’ll send the revised draft before lunch.', file: 'reference-after.mp3' },
];
const ORIGINAL_CUE = 'A colleague expects the draft on Tuesday. You’ll send it on Thursday. Ask them for feedback on Friday.';
const TRANSFER_CUE = 'A teammate expects tomorrow’s meeting to be online. It will be in the studio instead. Ask them to bring the draft.';
const DRILLS = {
  clarity: { title: 'Make the change clear', focus: 'Clarity', icon: 'focus', summary: 'Give the new date the most weight.', cue: 'Give the update twice. On the second try, put the emphasis on Thursday. Leave a small pause before you ask for feedback.' },
  rhythm: { title: 'Speak in thought groups', focus: 'Rhythm', icon: 'logo', summary: 'Let a small pause separate the change from the request.', cue: 'Say the change in one thought group. Pause, then ask for feedback. Try a second version with a slightly longer break.' },
  words: { title: 'Make an expression your own', focus: 'Vocabulary', icon: 'quote', summary: 'Adapt one useful expression from a reference.', cue: 'Use “Could we move…” to propose a different day. Then try another version in your own words.' },
  reply: { title: 'Reply on the spot', focus: 'Spontaneous speaking', icon: 'message', summary: 'Give one unrehearsed reply to a new situation.', cue: ORIGINAL_CUE },
  delivery: { title: 'Try a different emphasis', focus: 'Delivery', icon: 'mic', summary: 'Compare a neutral update with a warmer one.', cue: 'Say the update naturally. Try again, treating the request for feedback as an invitation. Listen for a difference in your delivery.' },
};
const params = new URLSearchParams(location.search);
const variant = params.get('case');
const emptyLibrary = variant === 'empty';
const unavailableReference = variant === 'unavailable';
const availableLessons = emptyLibrary ? [] : [...LESSONS];
const referenceAudio = new Audio();
const compareAudio = new Audio();
referenceAudio.preload = 'none';
compareAudio.preload = 'none';

const state = {
  lesson: 'deadline', phrase: 1, elapsed: 0, play: 'paused', mode: 'Manual',
  speed: 1, showText: true, filter: 'All', query: '', queue: false, awaiting: null,
  favourites: new Set(['request']), marks: new Set(), last: { deadline: { phrase: 1, elapsed: 0 } },
  entries: emptyLibrary ? [] : [{ label: 'Move a deadline', action: 'Sample rehearsal · Phrase 2', note: 'Listen for where the speaker stresses the new day.', route: 'practice/deadline' }],
  take: false, recording: false, recordStart: 0, recordTimer: null,
  playingTrack: '', referenceOrigin: 'rehearse', referenceOpened: false,
};
const openers = new Map();
const routeTrail = [readRoute()];
let trailIndex = 0;
let replacingRoute = false;
let currentRoute = '';
let hasAudioSource = null;

function icon(name) {
  return `<svg data-icon aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

function e(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function clock(value) {
  const seconds = Math.floor(Math.max(0, Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function link(route, label, { glyph, id, returning = false, className = 'button secondary' } = {}) {
  return `<a class="${className}" href="#${route}"${id ? ` id="${id}"` : ''}${returning ? ' data-return' : ''}>${glyph ? icon(glyph) : ''}${label}</a>`;
}

function button(action, label, { glyph, id, className = 'button secondary', disabled = false } = {}) {
  return `<button type="button" class="${className}" data-action="${action}"${id ? ` id="${id}"` : ''}${disabled ? ' disabled' : ''}>${glyph ? icon(glyph) : ''}${label}</button>`;
}

function symbol(action, label, glyph, attrs = '') {
  return `<button type="button" class="symbol" data-action="${action}" aria-label="${label}" ${attrs}>${icon(glyph)}</button>`;
}

function art(className = '', eager = false) {
  return `<img class="${className}" src="${eager ? PORTRAIT : STUDIO}" alt="" width="1200" height="800" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
}

function thumb(lesson) {
  return `<span class="thumb thumb-${lesson?.id || 'deadline'}" aria-hidden="true"><img src="${STUDIO}" alt="" width="53" height="53" loading="lazy"></span>`;
}

function announce(text) { announcement.textContent = text; }
function currentLesson() { return availableLessons.find(lesson => lesson.id === state.lesson) || LESSONS[0]; }
function playerBack() { return state.referenceOrigin; }
function playerBackLabel() {
  return state.referenceOrigin.startsWith('library') ? 'Back to Library' : state.referenceOrigin === 'journal' ? 'Back to Journal' : 'Back to Rehearse';
}
function practiceRoute() { return `practice/${state.lesson}`; }
function cueList() {
  if (state.lesson === 'deadline') return PHRASES;
  const lesson = currentLesson();
  return [{ time: lesson.time || 0, length: lesson.length || 1, text: lesson.text, file: lesson.file }];
}
function currentPhrase() { return cueList()[state.phrase] || cueList()[0]; }
function playingAvailable() { return Boolean(currentPhrase().file && !unavailableReference); }
function isLast() { return state.phrase === cueList().length - 1; }
function browsing(route) { return route === 'rehearse' || route === 'journal' || route.startsWith('library') && route !== 'library/add'; }

function nav(route, className) {
  const category = route.startsWith('library') ? 'library' : route === 'journal' ? 'journal' : 'rehearse';
  return `<nav class="main-nav ${className}" aria-label="Main navigation">${[
    ['rehearse', 'Rehearse', 'rehearse'], ['library', 'Library', 'library'], ['journal', 'Journal', 'journal'],
  ].map(([key, name, glyph]) => `<a href="#${key}" class="nav-link" ${category === key ? 'aria-current="page"' : ''}>${icon(glyph)}${name}</a>`).join('')}</nav>`;
}

function shell(content, route, layout = 'shell-content') {
  const compact = browsing(route) && state.referenceOpened && playingAvailable();
  return `<div class="shell${compact ? ' has-compact' : ''}">
    <header class="masthead"><div class="header-inner">
      <a class="brand" href="#rehearse"><span class="brand-mark">${icon('logo')}</span>Echo Studio</a>
      ${nav(route, 'desk-nav')}
      <a class="demo-link" href="#about">Design study</a>
    </div></header>
    <main id="main" class="${layout}" tabindex="-1">${content}</main>
    ${compact ? compactPlayer() : ''}
    ${nav(route, 'phone-nav')}
  </div>`;
}

function compactPlayer() {
  const lesson = currentLesson();
  return `<section class="compact-player on-night" aria-label="Current audio reference">
    <a class="compact-open" href="#${practiceRoute()}" id="compact-open" aria-label="Open player: ${e(lesson.title)}">
      ${thumb(lesson)}<span class="row-main"><strong>${e(lesson.title)}</strong><small class="clock" id="compact-clock"></small></span>
    </a>
    ${symbol('play', 'Play reference', 'play', 'id="compact-play"')}
  </section>`;
}

function heading(title, description = '') {
  return `<div class="page-heading"><h1 id="page-title" tabindex="-1">${title}</h1>${description ? `<p>${description}</p>` : ''}</div>`;
}

function back(route, label = 'Rehearse') {
  return link(route, label, {glyph: 'back', className: 'quiet-link back-link', returning: true});
}

function resumeRow() {
  const lesson = currentLesson();
  if (!availableLessons.length) return `<a class="text-row" href="#library">${icon('library')}<span class="row-main"><strong>Open your library</strong><small>Keep a reference for a later rehearsal.</small></span>${icon('chevron')}</a>`;
  const stored = state.last[lesson.id];
  const position = (lesson.id === 'deadline' ? PHRASES[stored?.phrase || 0].time : (lesson.time || 0)) + (stored?.elapsed || 0);
  return `<a class="resume-row" id="resume-reference" href="#practice/${lesson.id}">
    ${thumb(lesson)}<span class="row-main"><strong>${e(lesson.title)}</strong><small>${e(lesson.speaker || 'Text reference')}${lesson.file || lesson.id === 'deadline' ? ` · <span class="clock">${clock(position)}</span> in the recording` : ''}</small></span>
    <span class="resume-arrow">${icon('play')}</span>
  </a>`;
}

function home() {
  return `<section class="hero on-night">
    <div class="hero-copy">
      <h1 id="page-title" tabindex="-1">Rehearse the change.</h1>
      <p>A colleague is expecting your draft on Tuesday. The plan has changed. Give them a short update.</p>
      ${link('cue', 'Talk now', {id: 'talk-now', className: 'button primary', glyph: 'logo'})}
    </div>
    <figure class="hero-figure">${art('', true)}</figure>
  </section>
  <div class="desk-rail">
    <section aria-labelledby="resume-label"><h2 class="section-label" id="resume-label">${availableLessons.length ? 'Resume a reference' : 'Your references'}</h2>${resumeRow()}</section>
    <section aria-labelledby="drill-label"><h2 class="section-label" id="drill-label">Choose a focus</h2>
      <a class="text-row" id="pick-drill" href="#activities">${icon('focus')}<span class="row-main"><strong>Pick a speaking drill</strong><small>Clarity, rhythm, vocabulary or delivery.</small></span>${icon('chevron')}</a>
    </section>
  </div>`;
}

function libraryFilters() {
  return ['All', 'Favourites', 'Collections'].map(filter => `<button type="button" class="filter" data-action="filter" data-filter="${filter}" aria-pressed="${state.filter === filter}">${filter}</button>`).join('');
}

function libraryResults(collection = '') {
  const query = state.query.trim().toLowerCase();
  const lessons = availableLessons.filter(lesson =>
    (!collection || lesson.collection === collection) &&
    (collection || state.filter !== 'Favourites' || state.favourites.has(lesson.id)) &&
    (!query || `${lesson.title} ${lesson.speaker} ${lesson.collection}`.toLowerCase().includes(query)),
  );
  if (state.filter === 'Collections' && !collection && !query && availableLessons.some(lesson => lesson.collection)) {
    return `<ul class="library-results">${['Work conversations', 'Speaking clearly'].map(name =>
      `<li><a class="text-row" id="collection-${name === 'Work conversations' ? 'work' : 'clear'}" href="#library/${name === 'Work conversations' ? 'work' : 'clear'}">${icon('folder')}<span class="row-main"><strong>${name}</strong><small>${availableLessons.filter(lesson => lesson.collection === name).length} references</small></span>${icon('chevron')}</a></li>`,
    ).join('')}</ul>`;
  }
  if (!lessons.length) {
    return `<div class="empty"><h2>${availableLessons.length ? 'No matching references' : 'No references yet'}</h2>
      <p>${availableLessons.length ? 'Try a different title, speaker or collection.' : 'You can start with a short speaking cue while your library is empty.'}</p>
      ${availableLessons.length ? button('clear-search', 'Clear filters') : link('cue', 'Talk now', {className: 'button primary'})}</div>`;
  }
  return `<ul class="library-results">${lessons.map(lesson => {
    const favourite = state.favourites.has(lesson.id);
    return `<li class="lesson-row">
      <a class="lesson-main" id="open-${lesson.id}" href="#practice/${lesson.id}">${thumb(lesson)}
        <span class="row-main"><strong>${e(lesson.title)}</strong><small>${e(lesson.speaker || 'Text reference')}${lesson.duration ? ` · ${lesson.duration}` : ''}${lesson.id === 'deadline' ? ' · Recently used' : ''}</small></span>
      </a>
      ${symbol('favourite', `Favourite ${e(lesson.title)}`, 'star', `data-lesson="${lesson.id}" id="favourite-${lesson.id}" aria-pressed="${favourite}"`)}
    </li>`;
  }).join('')}</ul>`;
}

function library(route) {
  const collection = route.endsWith('/work') ? 'Work conversations' : route.endsWith('/clear') ? 'Speaking clearly' : '';
  return `${collection ? back('library', 'Library') : ''}
  <div class="library-heading">${heading(collection || 'Library')}${collection ? '' : link('library/add', 'Add reference', {id:'add-reference'})}</div>
  <div class="library-layout">
    <div class="library-controls">
      <label class="search-label" for="library-query">Search references
        <span class="search-field">${icon('search')}<input type="search" id="library-query" name="reference-query" autocomplete="off" placeholder="Title, speaker or collection…" value="${e(state.query)}"></span>
      </label>
      ${collection ? '' : `<div class="filter-row" aria-label="Filter references">${libraryFilters()}</div>`}
      <div id="library-results">${libraryResults(collection)}</div>
      <span class="sr-only" role="status" id="filter-status"></span>
    </div>
    ${emptyLibrary || collection ? '' : `<aside class="collection-feature">${art()}<h2>Work conversations</h2><p class="muted">Requests, changes and difficult replies.</p>${link('library/work', 'Explore collection', {className: 'quiet-link', id: 'featured-collection', glyph: 'chevron'})}</aside>`}
  </div>`;
}

function addReference() {
  return `${back('library', 'Library')}${heading('Add a text reference', 'Save a line you want to revisit in this tab.')}
    <form class="reflection" id="reference-form">
      <label for="reference-title">Title<input id="reference-title" name="title" maxlength="80" required></label>
      <label for="reference-text">Transcript<textarea id="reference-text" name="transcript" maxlength="450" required></textarea></label>
      <div class="button-row"><button type="submit" class="button primary">Add to library</button>${link('library', 'Cancel', {className:'quiet-link', returning:true})}</div>
    </form>`;
}

function cue(route) {
  const fromPlayer = route === 'cue/reference';
  const exit = fromPlayer ? practiceRoute() : 'rehearse';
  return `${back(exit, fromPlayer ? 'Back to reference' : 'Rehearse')}
  <section class="cue-paper on-night">
    <h1 id="page-title" tabindex="-1">${fromPlayer ? 'Give a different update.' : 'Give the new dates.'}</h1>
    <p class="cue-copy">${fromPlayer ? TRANSFER_CUE : ORIGINAL_CUE}</p>
    <p class="muted">${fromPlayer ? 'Give the new message in your own words. Borrow an expression or an emphasis from the reference if it helps.' : 'Reply in your own words. One short update is enough.'}</p>
    ${link(fromPlayer ? 'reflection/reference' : 'reflection', 'Finish this turn', {className: 'button primary', id: 'finish-cue'})}
  </section>
  ${fromPlayer ? '' : `<div class="button-row practice-note">${link('activity/clarity', 'Try with a clarity drill', {id: 'cue-drill', className: 'quiet-link'})}</div>`}`;
}

function activities() {
  return `${back('rehearse')}${heading('Pick a speaking drill', 'Choose one detail to work on during a short reply.')}
  <ul class="drills">${Object.entries(DRILLS).map(([id, drill]) => `<li><a class="drill-link" id="drill-${id}" href="#activity/${id}">${icon(drill.icon)}<span><strong>${drill.title}</strong><small>${drill.summary}</small></span>${icon('chevron')}</a></li>`).join('')}</ul>`;
}

function activity(route) {
  const id = route.split('/')[1];
  const drill = DRILLS[id] || DRILLS.clarity;
  const origin = openers.get(route)?.route;
  return `${origin?.startsWith('cue') ? back(origin,'Back to cue') : back('activities', 'Speaking drills')}
  <section class="cue-paper on-night">
    <h1 id="page-title" tabindex="-1">${drill.title}</h1>
    <p class="cue-copy">${drill.cue}</p>
    ${id !== 'reply' ? `<p class="muted">${ORIGINAL_CUE}</p>` : ''}
    ${link(`reflection/${id}`, 'Finish this drill', {className: 'button primary', id: 'finish-drill'})}
  </section>`;
}

function reflection(route) {
  const id = route.split('/')[1];
  const reference = ['reference', 'practice', 'comparison'].includes(id);
  const label = id === 'reference' ? 'A new conversation' : reference ? currentLesson().title : (DRILLS[id]?.title || 'A changed plan');
  const previous = { reference: 'cue/reference', practice: practiceRoute(), comparison: `compare/${state.lesson}` };
  const noteType = id === 'comparison' ? 'Comparison note' : id === 'practice' ? 'Reference rehearsal' : 'Speaking rehearsal';
  return `${back(previous[id] || (DRILLS[id] ? `activity/${id}` : 'cue'), 'Back to the exercise')}
    ${heading('Finish your rehearsal', 'A note can give you a starting point next time.')}
    <form class="reflection" id="reflection-form" data-label="${e(label)}" data-note-type="${noteType}" data-resume="${reference ? practiceRoute() : DRILLS[id] ? `activity/${id}` : 'cue'}">
      <label for="note">What did you want your listener to hear?
        <textarea id="note" name="note" maxlength="240" placeholder="For example, make Thursday clear before asking for feedback…"></textarea>
      </label>
      <div class="button-row"><button class="button primary" type="submit">Save to Journal</button>${link(reference ? practiceRoute() : 'rehearse', 'Done for now', {className: 'quiet-link', id: 'done-for-now', returning: true})}</div>
    </form>`;
}

function journal() {
  return `${heading('Journal', 'Pick up where a rehearsal left off.')}
    ${state.entries.length ? `<ol class="journal-list">${state.entries.map((entry, i) => `<li class="journal-entry">
      <small class="muted">${e(entry.action)}</small><h2>${e(entry.label)}</h2>
      ${entry.note ? `<p>${e(entry.note)}</p>` : ''}
      ${link(entry.route, entry.route.startsWith('practice') ? 'Resume reference' : 'Open exercise', {className: 'quiet-link', id: `resume-entry-${i}`, glyph: 'chevron'})}
    </li>`).join('')}</ol>` : `<div class="empty"><h2>Ready for your first note</h2><p>Finish a rehearsal and save a note to make it easy to return.</p>${link('cue', 'Talk now', {className: 'button primary', id: 'journal-talk'})}</div>`}`;
}

function about() {
  return `${back('rehearse')}${heading('About this design study')}
    <p>Try a rehearsal, open the sample library or compare the included example tracks. This study uses fictional materials and keeps your clicks and sample notes in this tab.</p>
    <div class="button-row practice-note"><a class="button secondary" href="?case=empty#rehearse">Empty library</a><a class="button secondary" href="?case=unavailable#practice/deadline">Unavailable reference</a></div>`;
}

function queueItems() {
  return `<ul class="dialog-list">${cueList().map((phrase, index) => `
    <li><button type="button" class="queue-choice" data-action="select-phrase" data-phrase="${index}" ${index === state.phrase ? 'aria-current="true"' : ''}>
      <small class="clock">${clock(phrase.time)}</small><span>${e(phrase.text)}${state.marks.has(`${state.lesson}/${index}`) ? '<small> · Practised</small>' : ''}</span>
    </button></li>`).join('')}</ul>`;
}

function player() {
  const current = currentPhrase();
  const lesson = currentLesson();
  const phrases = cueList();
  const previous = phrases[state.phrase - 1];
  const next = phrases[state.phrase + 1];
  return `<main class="player on-night" id="main" tabindex="-1" aria-label="Practice player">
    <header class="player-top">
      ${link(playerBack(), `<span class="sr-only">${playerBackLabel()}</span>`, {glyph: 'back', className: 'symbol', id: 'leave-player', returning: true})}
      <div class="source-title">${e(lesson.title)}<small>${e(lesson.speaker)} · ${lesson.duration} recording</small></div>
      ${symbol('settings', 'Player settings', 'settings', 'id="player-settings"')}
    </header>
    <div class="player-stage">
      <section class="transcript" aria-label="Transcript">
        <div class="transcript-meta"><span>Phrase ${state.phrase + 1} of ${phrases.length}</span><span class="clock" id="source-clock"></span></div>
        <div class="transcript-lines" tabindex="0" aria-label="Current phrase and surrounding transcript">
          ${state.showText && previous ? `<p>${e(previous.text)}</p>` : ''}
          <h1 id="page-title" tabindex="-1">${state.showText ? e(current.text) : 'Transcript hidden'}</h1>
          ${state.showText && next ? `<p>${e(next.text)}</p>` : ''}
        </div>
        <div class="phrase-exit" id="phrase-gesture">
          ${link('cue/reference', 'Try a new conversation', {id: 'reference-cue', className: 'button secondary on-night'})}
        </div>
      </section>
      ${state.queue ? `<aside class="player-art queue-side" aria-label="Phrase queue"><h2>Phrase queue</h2>${queueItems()}</aside>` : `<figure class="player-art">${art()}</figure>`}
    </div>
    <footer class="player-foot">
      <p class="player-message" id="player-status" role="status"></p>
      <div class="timeline-row">
        <div class="timeline"><label class="sr-only" for="phrase-time">Seek within phrase</label>
          <input type="range" id="phrase-time" name="phrase-time" min="0" max="${current.length}" step="0.05" value="${state.elapsed}">
          <small class="clock" id="phrase-clock"></small>
        </div>
        <div class="player-tools" aria-label="Practice tools">
          ${symbol('timeline', 'Recording timeline', 'clock', 'id="tool-timeline"')}
          ${symbol('queue', 'Phrase queue', 'queue', `id="tool-queue" aria-expanded="${state.queue}"`)}
          ${symbol('record', 'Record and compare', 'compare', 'id="tool-record"')}
        </div>
      </div>
      <div class="player-transport">
        ${button('replay', '<span>Replay</span>', {glyph: 'restart', id: 'player-replay', className: 'button secondary on-night'})}
        ${button('play', '<span>Play</span>', {glyph: 'play', id: 'player-play', className: 'button primary'})}
        ${button('next', isLast() ? 'Finish' : 'Next', {glyph: isLast() ? 'check' : 'next', id: 'player-next', className: 'button secondary on-night'})}
      </div>
    </footer>
  </main>`;
}

function dialog(title, body) {
  document.querySelector('dialog')?.remove();
  const element = document.createElement('dialog');
  element.setAttribute('aria-labelledby', 'dialog-title');
  element.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2>${symbol('close-dialog', 'Close dialog', 'close')}</div>${body}`;
  element.addEventListener('close', () => element.remove(), {once: true});
  root.appendChild(element);
  element.showModal();
  return element;
}

function settings() {
  dialog('Practice settings', `
    <label class="dialog-field" for="practice-mode">Playback mode
      <select id="practice-mode">${['Manual', 'Automatic', 'Continuous'].map(mode => `<option value="${mode}"${state.mode === mode ? ' selected' : ''}>${mode}</option>`).join('')}</select>
    </label>
    <label class="dialog-field" for="practice-speed">Speed
      <select id="practice-speed">${[[.75, '0.75×'], [1, 'Normal'], [1.25, '1.25×']].map(([value, label]) => `<option value="${value}"${state.speed === value ? ' selected' : ''}>${label}</option>`).join('')}</select>
    </label>
    <label class="dialog-field"><span><input type="checkbox" id="show-transcript"${state.showText ? ' checked' : ''}> Show transcript</span></label>
    ${button('pronunciation', 'Pronunciation note', {id:'pronunciation-note'})}
    ${link('reflection/practice', 'Finish this rehearsal', {className:'quiet-link', id:'finish-reference'})}
    <p class="muted dialog-note">Manual stops at the phrase. Automatic leaves time to speak. Continuous joins the available sample clips.</p>
  `);
}

function recording() {
  return `${back(practiceRoute(), 'Back to reference')}
    ${heading('Record a take', 'Say the current phrase at your own pace. This design study supplies an example take.')}
    <blockquote class="record-stage" aria-label="Current phrase">
      <h2>${e(currentPhrase().text)}</h2>
      ${button('take', state.recording ? 'Stop and listen back' : state.take ? 'Record another demo take' : 'Start demo recording', {
        glyph: state.recording ? 'stop' : 'mic', id: 'take-button', className: 'button secondary',
      })}
      <p class="record-status muted" role="status" id="take-status">${state.recording ? 'Demo recording in progress' : state.take ? 'Example take ready' : 'Ready to record'}</p>
    </blockquote>
    <div class="button-row">${state.recording ? '' : button('sample-compare', 'Hear an example comparison', {id:'example-compare', className:'quiet-link'})}</div>`;
}

const WAVE = {
  'reference-after.mp3': [5, 5, 5, 5, 9, 75, 76, 70, 68, 5, 65, 76, 84, 89, 63, 75, 93, 65, 82, 87, 35, 22, 60, 70, 62, 5, 36, 55, 5, 65, 61, 76, 77, 60, 85, 77, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  'reference-before.mp3': [5, 5, 5, 5, 6, 59, 85, 92, 93, 75, 62, 66, 62, 61, 60, 72, 62, 71, 78, 64, 66, 17, 46, 51, 73, 78, 60, 56, 5, 47, 27, 45, 56, 43, 66, 61, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  'reference-ellis.mp3': [5, 5, 5, 75, 83, 20, 93, 87, 48, 35, 62, 85, 33, 26, 6, 5, 63, 19, 69, 67, 47, 81, 52, 5, 62, 18, 65, 31, 67, 59, 13, 82, 74, 57, 14, 5, 67, 67, 7, 9, 5, 5, 5, 5, 5],
  'reference.mp3': [5, 5, 5, 5, 5, 5, 73, 60, 61, 85, 77, 93, 93, 80, 74, 25, 66, 65, 77, 91, 50, 68, 66, 63, 14, 44, 5, 55, 65, 65, 63, 51, 5, 59, 58, 35, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  'sample-take.mp3': [5, 5, 5, 5, 5, 5, 5, 15, 88, 28, 21, 50, 93, 84, 65, 85, 86, 7, 47, 46, 78, 82, 62, 24, 63, 65, 7, 35, 5, 6, 73, 69, 15, 10, 5, 35, 43, 28, 22, 5, 5, 5, 5, 5, 5],
};

function track(key, title, caption) {
  const playing = state.playingTrack === key;
  const values = WAVE[key === 'take' ? 'sample-take.mp3' : 'reference.mp3'];
  return `<section class="track track-${key}">
    ${symbol('play-track', `${playing ? 'Pause' : 'Play'} ${title.toLowerCase()}`, playing ? 'pause' : 'play', `data-track="${key}" id="play-track-${key}"`)}
    <div class="track-copy"><h2>${title}</h2><div class="wave" aria-hidden="true">${values.map(height => `<span style="--height:${height}%"></span>`).join('')}</div>
      <p class="track-caption">${e(caption)}</p></div>
  </section>`;
}

function comparison() {
  const example = PHRASES[1];
  return `${back(`record/${state.lesson}`, 'Back to recording')}
    ${heading('Listen back', currentPhrase() === example ?
      'Listen to the reference and the example take. Is the changed detail equally clear?' :
      'Hear the paired example from Move a deadline. Listen for the new day in each take.')}
    <div class="comparison">
      ${track('reference', 'Reference', example.text)}
      ${track('take', 'Example take', example.text)}
      <p class="muted" id="comparison-status" role="status">${state.playingTrack ? 'Playing ' + state.playingTrack : ''}</p>
    </div>
    <div class="button-row practice-note">
      ${link('reflection/comparison', 'Finish this rehearsal', {className:'button primary', id:'complete-comparison'})}
      ${link(practiceRoute(), 'Back to reference', {className:'quiet-link', returning: true})}
    </div>`;
}

function updatePlayer() {
  const compact = document.getElementById('compact-play');
  if (compact) {
    const active = ['playing', 'waiting', 'loading'].includes(state.play);
    const label = active ? 'Pause reference' : 'Play reference';
    if (compact.getAttribute('aria-label') !== label) {
      compact.setAttribute('aria-label', label);
      compact.innerHTML = icon(active ? 'pause' : 'play');
    }
    document.getElementById('compact-clock').textContent = `${clock(currentPhrase().time + state.elapsed)} in recording`;
  }
  const play = document.getElementById('player-play');
  if (!play) return;
  const phrase = currentPhrase();
  const startWait = state.play === 'waiting';
  const busy = state.play === 'loading';
  const playing = state.play === 'playing';
  const label = startWait || playing ? 'Pause' : state.play === 'complete' ? 'Replay' : busy ? 'Loading…' : 'Play';
  play.innerHTML = `${icon(startWait || playing ? 'pause' : 'play')}<span>${label}</span>`;
  play.disabled = busy || !playingAvailable();
  document.getElementById('player-replay').disabled = !playingAvailable();
  const slider = document.getElementById('phrase-time');
  slider.disabled = !playingAvailable();
  slider.value = state.elapsed.toFixed(2);
  const time = `${state.elapsed.toFixed(1)} s / ${phrase.length.toFixed(1)} s`;
  slider.setAttribute('aria-valuetext', time);
  document.getElementById('phrase-clock').textContent = time;
  document.getElementById('source-clock').textContent = `${clock(phrase.time + state.elapsed)} in recording`;
  const messages = {
    waiting: 'Your turn · speak once before the next phrase.',
    loading: 'Loading reference…',
    complete: 'Phrase complete. Replay or move on when you’re ready.',
    error: 'The reference is unavailable. Read the transcript or try a new conversation.',
  };
  const status = document.getElementById('player-status');
  const text = !playingAvailable() ? messages.error : (messages[state.play] || '');
  if (status.textContent !== text) status.textContent = text;
}

function rememberPosition() {
  state.last[state.lesson] = { phrase: state.phrase, elapsed: state.elapsed };
}

function pauseReference() {
  clearTimeout(state.awaiting);
  state.awaiting = null;
  referenceAudio.pause();
  state.play = 'paused';
  rememberPosition();
  updatePlayer();
}

function playReference(restart = false) {
  if (!playingAvailable()) {
    state.play = 'error';
    updatePlayer();
    return;
  }
  clearTimeout(state.awaiting);
  state.awaiting = null;
  if (restart || state.play === 'complete') state.elapsed = 0;
  const phrase = currentPhrase();
  if (hasAudioSource !== phrase.file) {
    hasAudioSource = phrase.file;
    referenceAudio.src = MEDIA + phrase.file;
  }
  referenceAudio.playbackRate = state.speed;
  referenceAudio.currentTime = Math.min(state.elapsed, phrase.length);
  state.play = 'loading';
  updatePlayer();
  referenceAudio.play().then(() => {
    if (referenceAudio.paused || currentPhrase() !== phrase) return;
    state.play = 'playing';
    updatePlayer();
  }).catch(error => {
    if (error.name === 'AbortError') return;
    state.play = 'error';
    updatePlayer();
  });
}

function selectPhrase(index, {play = false, focusId} = {}) {
  pauseReference();
  state.phrase = Math.max(0, Math.min(cueList().length - 1, index));
  state.elapsed = 0;
  rememberPosition();
  if (currentRoute.startsWith('practice/')) render(focusId);
  else updatePlayer();
  if (play) playReference(true);
}

function nextPhrase() {
  if (playingAvailable()) state.marks.add(`${state.lesson}/${state.phrase}`);
  if (isLast()) {
    go('reflection/practice');
    return;
  }
  selectPhrase(state.phrase + 1, {play: true, focusId: 'player-next'});
}

referenceAudio.addEventListener('timeupdate', () => {
  const phrase = currentPhrase();
  if (phrase.file !== hasAudioSource || state.play !== 'playing') return;
  state.elapsed = Math.min(referenceAudio.currentTime, phrase.length);
  updatePlayer();
});
referenceAudio.addEventListener('ended', () => {
  if (currentPhrase().file !== hasAudioSource || state.play !== 'playing') return;
  state.elapsed = currentPhrase().length;
  rememberPosition();
  if (!isLast() && state.mode === 'Continuous') {
    selectPhrase(state.phrase + 1, {play: true});
    return;
  }
  if (!isLast() && state.mode === 'Automatic') {
    state.play = 'waiting';
    state.awaiting = setTimeout(() => selectPhrase(state.phrase + 1, {play: true}), 3000);
  } else {
    state.play = 'complete';
  }
  updatePlayer();
});

function updateComparison() {
  for (const [key, title] of [['reference', 'reference'], ['take', 'example take']]) {
    const control = document.getElementById(`play-track-${key}`);
    if (!control) continue;
    const playing = state.playingTrack === key;
    control.innerHTML = icon(playing ? 'pause' : 'play');
    control.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${title}`);
  }
  const status = document.getElementById('comparison-status');
  if (status) status.textContent = state.playingTrack ? `Playing ${state.playingTrack === 'take' ? 'example take' : 'reference'}` : '';
}

function playTrack(trackName) {
  if (trackName === state.playingTrack) {
    compareAudio.pause();
    state.playingTrack = '';
    updateComparison();
    return;
  }
  const file = trackName === 'take' ? 'sample-take.mp3' : 'reference.mp3';
  state.playingTrack = trackName;
  compareAudio.src = MEDIA + file;
  updateComparison();
  compareAudio.play().catch(error => {
    if (error.name === 'AbortError') return;
    state.playingTrack = '';
    updateComparison();
    const status = document.getElementById('comparison-status');
    if (status) status.textContent = 'The example track could not load.';
  });
}
compareAudio.addEventListener('ended', () => {
  state.playingTrack = '';
  updateComparison();
});

function recordTake() {
  if (state.recording) {
    clearInterval(state.recordTimer);
    state.recording = false;
    state.take = true;
    const route = `compare/${state.lesson}`;
    openers.set(route, {route: currentRoute, id: 'take-button'});
    go(route);
    return;
  }
  state.recording = true;
  state.recordStart = Date.now();
  render('take-button');
  state.recordTimer = setInterval(() => {
    const status = document.getElementById('take-status');
    if (status) status.textContent = `Demo recording · ${clock((Date.now() - state.recordStart) / 1000)}`;
  }, 1000);
}

function routeContent(route) {
  if (route.startsWith('practice/')) return availableLessons.length ? player() : shell(library('library'), 'library');
  if (route === 'library/add') return shell(addReference(), route, 'flow');
  if (route.startsWith('library')) return shell(library(route), route);
  if (route.startsWith('cue')) return shell(cue(route), route, 'flow');
  if (route === 'activities') return shell(activities(), route, 'flow');
  if (route.startsWith('activity/')) return shell(activity(route), route, 'flow');
  if (route.startsWith('reflection')) return shell(reflection(route), route, 'flow');
  if (route.startsWith('record/')) return shell(recording(), route, 'flow');
  if (route.startsWith('compare/')) return shell(comparison(), route, 'flow');
  if (route === 'journal') return shell(journal(), route, 'flow');
  if (route === 'about') return shell(about(), route, 'flow');
  return shell(home(), 'rehearse');
}

function render(focusId) {
  root.innerHTML = routeContent(currentRoute);
  updatePlayer();
  if (focusId) {
    (document.getElementById(focusId) || document.getElementById('page-title'))?.focus({preventScroll: true});
  }
}

function go(route) {
  if (location.hash !== '#' + route) location.hash = route;
}

function readRoute() { return location.hash.slice(1) || 'rehearse'; }

function rememberRoute() {
  history.replaceState({...history.state, echoRehearsalIndex: trailIndex}, '');
}

function traverseBack(route) {
  const index = routeTrail.lastIndexOf(route, trailIndex - 1);
  if (trailIndex > 0 && index >= 0 && index < trailIndex) {
    history.go(index - trailIndex);
  } else if (readRoute() !== route) {
    replacingRoute = true;
    location.replace('#' + route);
  }
}

function followHistory() {
  const route = readRoute();
  const previousIndex = history.state?.echoRehearsalIndex;
  if (replacingRoute) {
    replacingRoute = false;
    routeTrail[trailIndex] = route;
  } else if (Number.isInteger(previousIndex) && routeTrail[previousIndex] === route) {
    trailIndex = previousIndex;
  } else {
    routeTrail.splice(++trailIndex, routeTrail.length, route);
  }
  rememberRoute();
  navigate();
}

function navigate(initial = false) {
  const route = readRoute();
  const previous = currentRoute;
  const invoker = openers.get(previous);
  const sameReference = route === practiceRoute();
  if (state.referenceOpened && !sameReference && !browsing(route)) pauseReference();
  if (previous.startsWith('compare/')) {
    compareAudio.pause();
    state.playingTrack = '';
  }
  if (state.recording) {
    clearInterval(state.recordTimer);
    state.recording = false;
  }
  if (route.startsWith('practice/') || route.startsWith('record/') || route.startsWith('compare/')) {
    const id = route.split('/')[1];
    if (availableLessons.some(lesson => lesson.id === id) && (initial || state.lesson !== id)) {
      if (state.referenceOpened && state.lesson !== id) pauseReference();
      state.lesson = id;
      state.phrase = state.last[id]?.phrase ?? (id === 'deadline' ? 1 : 0);
      state.elapsed = state.last[id]?.elapsed || 0;
      state.play = 'paused';
    }
    if (previous === 'rehearse' || previous === 'journal' || previous.startsWith('library')) state.referenceOrigin = previous;
  }
  if (route.startsWith('practice/') && availableLessons.length) state.referenceOpened = true;
  if (previous.startsWith('practice/') && route.startsWith('library')) state.queue = false;
  currentRoute = route;
  window.scrollTo(0, 0);
  render(initial ? null : invoker?.route === route ? invoker.id : 'page-title');
}

function updateLibrary() {
  const target = document.getElementById('library-results');
  if (!target) return;
  const collection = currentRoute.endsWith('/work') ? 'Work conversations' : currentRoute.endsWith('/clear') ? 'Speaking clearly' : '';
  target.innerHTML = libraryResults(collection);
  const count = target.querySelectorAll('li').length;
  document.getElementById('filter-status').textContent = `${count} results`;
}

const actions = {
  'filter': target => {
    state.filter = target.dataset.filter;
    for (const filter of root.querySelectorAll('[data-filter]')) filter.setAttribute('aria-pressed', String(filter === target));
    updateLibrary();
  },
  'clear-search': () => {
    state.filter = 'All';
    state.query = '';
    render('library-query');
  },
  'favourite': target => {
    const id = target.dataset.lesson;
    if (state.favourites.has(id)) state.favourites.delete(id);
    else state.favourites.add(id);
    if (state.filter === 'Favourites') {
      updateLibrary();
      (document.querySelector('[data-filter="Favourites"]') || document.getElementById('library-query'))?.focus();
    } else {
      target.setAttribute('aria-pressed', String(state.favourites.has(id)));
    }
    announce(state.favourites.has(id) ? 'Added to favourites' : 'Removed from favourites');
  },
  'play': () => ['playing', 'waiting', 'loading'].includes(state.play) ? pauseReference() : playReference(),
  'replay': () => playReference(true),
  'next': nextPhrase,
  'queue': () => {
    if (matchMedia('(min-width: 1050px)').matches) {
      state.queue = !state.queue;
      render('tool-queue');
    } else {
      pauseReference();
      const queue = dialog('Phrase queue', queueItems());
      const trigger = document.getElementById('tool-queue');
      trigger.setAttribute('aria-expanded', 'true');
      queue.addEventListener('close', () => trigger.setAttribute('aria-expanded', 'false'), {once: true});
    }
  },
  'select-phrase': target => {
    document.querySelector('dialog[open]')?.close();
    selectPhrase(Number(target.dataset.phrase), {focusId: 'tool-queue'});
  },
  'settings': settings,
  'timeline': () => dialog('Recording position', `<p class="muted dialog-note">Jump to a timed phrase in this sample.</p>${queueItems()}`),
  'close-dialog': () => document.querySelector('dialog[open]')?.close(),
  'pronunciation': () => dialog('Pronunciation note', `<p class="dialog-note">Thursday <span lang="en-GB">/ˈθɜːzdeɪ/</span></p><p class="muted">Listen for the stressed first syllable in the reference.</p>`),
  'record': target => {
    const route = `record/${state.lesson}`;
    openers.set(route, { route: currentRoute, id: target.id });
    go(route);
  },
  'take': recordTake,
  'sample-compare': target => {
    state.take = true;
    const route = `compare/${state.lesson}`;
    openers.set(route, { route: currentRoute, id: target.id });
    go(route);
  },
  'play-track': target => playTrack(target.dataset.track),
};

root.addEventListener('click', event => {
  const target = event.target.closest('button[data-action]');
  if (target && !target.disabled) actions[target.dataset.action]?.(target);
  const anchor = event.target.closest('a[href^="#"]');
  if (anchor && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    const route = anchor.hash.slice(1);
    if (anchor.hasAttribute('data-return')) {
      event.preventDefault();
      traverseBack(route);
    } else if (anchor.id) {
      openers.set(route, {route: currentRoute, id: anchor.id});
    }
  }
});
root.addEventListener('input', event => {
  const control = event.target;
  if (control.id === 'library-query') {
    state.query = control.value;
    updateLibrary();
  } else if (control.id === 'phrase-time') {
    state.elapsed = Number(control.value);
    if (currentPhrase().file === hasAudioSource) referenceAudio.currentTime = state.elapsed;
    rememberPosition();
    updatePlayer();
  }
});
root.addEventListener('change', event => {
  const control = event.target;
  if (control.id === 'practice-mode') {
    const mode = control.value;
    pauseReference();
    state.mode = mode;
    render('player-settings');
    settings();
    document.getElementById(control.id)?.focus();
  } else if (control.id === 'practice-speed') {
    state.speed = Number(control.value);
    referenceAudio.playbackRate = state.speed;
  } else if (control.id === 'show-transcript') {
    state.showText = control.checked;
    render('player-settings');
    settings();
    document.getElementById(control.id)?.focus();
  }
});
root.addEventListener('submit', event => {
  if (event.target.id === 'reference-form') {
    event.preventDefault();
    const form = new FormData(event.target);
    const title = form.get('title').trim();
    const text = form.get('transcript').trim();
    if (!title || !text) {
      announce('Add a title and a transcript.');
      return;
    }
    const id = `text-${availableLessons.length}`;
    availableLessons.unshift({id, title, text});
    state.lesson = id;
    state.phrase = 0;
    state.elapsed = 0;
    state.filter = 'All';
    state.query = '';
    announce('Reference added to this tab');
    traverseBack('library');
    return;
  }
  if (event.target.id !== 'reflection-form') return;
  event.preventDefault();
  const form = event.target;
  const note = new FormData(form).get('note').trim();
  state.entries.unshift({label: form.dataset.label, action: form.dataset.noteType, note, route: form.dataset.resume});
  announce('Rehearsal saved to Journal');
  go('journal');
});

let swipeStart = null;
root.addEventListener('touchstart', event => {
  const point = event.touches[0];
  swipeStart = event.target.id === 'phrase-gesture' && event.touches.length === 1 ? [point.clientX, point.clientY] : null;
}, {passive: true});
root.addEventListener('touchcancel', () => { swipeStart = null; }, {passive: true});
root.addEventListener('touchend', event => {
  const start = swipeStart;
  swipeStart = null;
  if (!start || !currentRoute.startsWith('practice/') || getSelection().toString()) return;
  const point = event.changedTouches[0];
  const dx = point.clientX - start[0];
  const dy = point.clientY - start[1];
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (dx < 0) nextPhrase();
  else if (state.phrase > 0) selectPhrase(state.phrase - 1, {play: true});
}, {passive: true});

document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  document.getElementById('main')?.focus();
});
rememberRoute();
window.addEventListener('hashchange', followHistory);
navigate(true);
