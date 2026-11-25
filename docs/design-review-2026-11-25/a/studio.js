const assets = '../assets/';
const deadlinePhrases = [
  {start: 37, length: 2.664, text: 'I need a little more time with the figures.', audio: 'reference-before.mp3'},
  {start: 42, length: 2.556, text: 'Could we move the review to Thursday?', audio: 'reference.mp3'},
  {start: 47, length: 3.096, text: 'I’ll send the revised draft before lunch.', audio: 'reference-after.mp3'},
];

const references = [
  {id: 'deadline', title: 'Move a deadline', speaker: 'Nina Patel', duration: 138, group: 'Work conversations', phrases: deadlinePhrases, cover: 'studio.png'},
  {id: 'disagree', title: 'Disagree without shutting down the idea', speaker: 'Ellis Morgan', duration: 186, group: 'Work conversations', tone: '#6e8f7c', phrases: [{start: 54, length: 4.14, text: 'I see the appeal. Could we test it on one project first?', audio: 'reference-ellis.mp3'}]},
  {id: 'update', title: 'Give a clearer update', speaker: 'Maya Reid', duration: 114, group: 'Work conversations', tone: '#789aa7', phrases: [{start: 27, length: 3, text: 'The first draft is ready for comments.'}]},
  {id: 'request', title: 'Make the request land', speaker: 'Nina Patel', duration: 161, group: 'Delivery practice', tone: '#a39176', phrases: [{start: 51, length: 4, text: 'Would you take a look before we send it?'}]},
  {id: 'keep', title: 'Keep the conversation moving', speaker: 'Ellis Morgan', duration: 156, group: 'Delivery practice', tone: '#8d9ca0', phrases: [{start: 33, length: 3, text: 'What would that look like on a busy day?'}]},
];

const activities = {
  original: {name: 'Say it in a new situation', detail: 'Spontaneous speaking', icon: 'chat', situation: 'A colleague expects the draft on Tuesday. You can send it on Thursday. Ask for feedback by Friday.', task: 'Say the update in your own words.'},
  pronunciation: {name: 'Choose the emphasis', detail: 'Pronunciation and rhythm', icon: 'sound', situation: 'A colleague thought the review was on Friday. Correct the date in one sentence.', task: 'Make the changed date the easiest part to hear.'},
  voice: {name: 'Make space for a pause', detail: 'Comfort and delivery', icon: 'pause', situation: 'You have one change to announce before a team call. Begin with the main detail, then leave a short pause.', task: 'Use your ordinary speaking voice. Silent preparation is an option.'},
  vocabulary: {name: 'Use an expression', detail: 'Active vocabulary', icon: 'book', situation: 'You want to suggest a later time for a delivery. Use a phrase such as “Could we move it to…” in a sentence of your own.', task: 'Say it once. Try it again with a different time.'},
};

const transferActivity = {situation: 'You planned to meet online. You have a room at the studio instead. Ask your colleague to bring the latest draft.', task: 'Tell them where to meet and what to bring in your own words.'};
const collections = {work: 'Work conversations', delivery: 'Delivery practice'};

const icons = {
  sound: '<path d="M3 12h2m3-6v12m4-15v18m4-14v10m3-5h2"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14h-6a2 2 0 0 0-2 1zm8 2a2 2 0 0 1 2-2h6v17a2 2 0 0 0-2-1h-6z"/>',
  history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  play: '<path fill="currentColor" d="m8 5 12 7-12 7z"/>',
  pause: '<path d="M9 5v14m6-14v14" stroke-width="3"/>',
  replay: '<path d="M5.5 9A7.5 7.5 0 1 1 6 17M3 4v6h6"/><path d="m10 10 4 2.5-4 2.5z" fill="currentColor"/>',
  next: '<path d="m6 6 9 6-9 6zM18 5v14"/>',
  chat: '<path d="M4 5h16v11H9l-5 4zM8 9h8m-8 4h5"/>',
  heart: '<path d="M12 20 4.8 13.1a4.5 4.5 0 0 1 6.4-6.2l.8.8.8-.8a4.5 4.5 0 0 1 6.4 6.2z"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 10v2a6.5 6.5 0 0 0 13 0v-2M12 18.5V22"/>',
  tune: '<path d="M4 6h16M4 12h16M4 18h16M8 3v6m7 0v6m-4 0v6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

const query = new URLSearchParams(location.search);
const library = query.has('empty') || query.get('state') === 'empty' ? [] : references;
const unavailable = query.has('unavailable') || query.get('state') === 'unavailable';
const root = document.querySelector('#root');
const live = document.querySelector('#announcement');
const progress = new Map(library.map(item => [item.id, {cue: item.id === 'deadline' ? 1 : 0, offset: 0}]));
const favorites = new Set(library.length ? ['update'] : []);
const journal = library.length ? [
  {id: 'yesterday', title: 'Move a deadline', stamp: 'Yesterday', detail: 'Replayed two phrases · stopped at 0:42', lesson: 'deadline', cue: 1, offset: 0},
  {id: 'earlier', title: 'Disagree without shutting down the idea', stamp: 'Earlier', detail: 'Played a reference phrase · stopped at 0:54', lesson: 'disagree', cue: 0, offset: 0},
] : [];

let screen = {view: 'studio', section: 'studio'};
let filter = 'all';
let recentLesson = library[0]?.id;
let playedReference = false;
let search = '';
let savedTake = false;
let capture = null;
let playing = null;
let latestLog = '';
const sessions = new Map();
const browseViews = ['studio', 'library', 'history'];

function exercise(id = lesson()?.id) {
  if (!sessions.has(id)) sessions.set(id, {heard: new Set(), replayed: 0, marked: new Set(), compared: false});
  return sessions.get(id);
}

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
}

function time(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function lesson() {
  return library.find(item => item.id === screen.lesson) || library[0];
}

function spot() {
  return screen.review || progress.get(lesson()?.id);
}

function phrase() {
  return lesson()?.phrases[spot()?.cue];
}

function audioAvailable() {
  return !unavailable && Boolean(phrase()?.audio);
}

function say(text) {
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = text; });
}

function button(label, action, style = 'quiet', symbol = '', extra = '') {
  return `<button class="${style}" type="button" data-action="${action}" ${extra}>${symbol ? icon(symbol) : ''}<span>${label}</span></button>`;
}

function brand() {
  return `<button class="brand" type="button" data-go="studio" aria-label="Echo Studio home"><i class="brandmark">${icon('sound')}</i><span>Echo Studio</span></button>`;
}

function navigation(classes) {
  const destinations = [['studio', 'Studio', 'home'], ['library', 'Library', 'book'], ['history', 'History', 'history']];
  return `<nav aria-label="Studio navigation" class="${classes}">${destinations.map(([id, title, symbol]) =>
    `<button class="nav-button" type="button" data-go="${id}" data-focus="nav-${id}" ${screen.section === id ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${title}</span></button>`).join('')}</nav>`;
}

function cover(item) {
  return item.cover
    ? `<img src="${assets}${item.cover}" alt="">`
    : `<div class="cover-drawing" style="--cover:${item.tone}" aria-hidden="true"></div>`;
}

function row(item) {
  const starred = favorites.has(item.id);
  return `<li class="shelf-row">
    <button class="item-open" type="button" data-open="${item.id}" data-focus="lesson-${item.id}" aria-label="Open ${escape(item.title)}">
      <span class="thumb">${cover(item)}</span>
      <span><strong class="item-name">${escape(item.title)}</strong><small class="item-details">${escape(item.speaker)} · ${time(item.duration)}</small></span>
      <span aria-hidden="true">${icon('chevron')}</span>
    </button>
    <button type="button" class="icon-button favourite" data-favourite="${item.id}" data-focus="favourite-${item.id}" aria-label="Favourite ${escape(item.title)}" aria-pressed="${starred}">${icon('heart')}</button>
  </li>`;
}

function heading(title, detail = '') {
  return `<header class="page-head"><div><h1 data-heading tabindex="-1">${title}</h1>${detail ? `<p class="subtle">${detail}</p>` : ''}</div></header>`;
}

function home() {
  if (!library.length) return `${heading('Studio')}
    <div class="home-layout"><div class="first-start">
      <h2>Say one short update</h2><p class="body-copy">Try a fictional situation and speak in your own words.</p>
      ${button('Open speaking prompt', 'original', 'on-room', 'chat', 'data-focus="start-prompt"')}
    </div><aside class="home-side">
      ${choice('Add a reference', 'Bring a recording or a timed transcript.', 'add', 'plus')}
    </aside></div>`;
  const item = library.find(item => item.id === recentLesson) || library[0];
  const mark = progress.get(item.id);
  const selected = item.phrases[mark.cue];
  return `${heading('Studio')}
    <div class="home-layout">
      <section aria-label="Continue practising" class="feature">
        <div class="feature-image">${cover(item)}</div>
        <div class="feature-details">
          <p class="eyeline">Continue practising</p>
          <h2>${escape(item.title)}</h2>
          <p class="label">${escape(item.speaker)} · ${time(item.duration)}</p>
          <div class="jump-label"><span>Saved at ${time(selected.start + mark.offset)}</span><span class="position-line" aria-hidden="true"></span></div>
          <button class="primary" type="button" data-open="${item.id}" data-focus="resume">${icon('chevron')}<span>Resume reference</span></button>
        </div>
      </section>
      <aside class="home-side">
        <button class="quick-start" type="button" data-action="original" data-focus="start-prompt">
          ${icon('chat')}<span><strong>Start with a speaking prompt</strong><small>Give one short update in your own words.</small></span>${icon('chevron')}
        </button>
      </aside>
    </div>
    <section class="recent" aria-labelledby="recent-title"><header><h2 id="recent-title">Recently practised</h2>${button('Open library', 'library', 'text-button')}</header>
      <ul class="shelf-rows">${library.filter(current => current.id !== item.id).slice(0, 2).map(row).join('')}</ul>
    </section>`;
}

function libraryItems() {
  const matching = library.filter(item => {
    const matchesSearch = `${item.title} ${item.speaker} ${item.group}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (filter === 'all' || (filter === 'favorites' ? favorites.has(item.id) : item.group === collections[filter]));
  });
  return matching.length ? matching.map(row).join('') : '<li class="no-results">No matching references.</li>';
}

function libraryScreen() {
  const filters = [['all', 'All references'], ['favorites', 'Favourites'], ['collections', 'Collections']];
  const collectionList = Object.entries(collections).map(([id, label]) => {
    const count = library.filter(item => item.group === label).length;
    return count ? choice(label, `${count} references`, `collection-${id}`, 'book') : '';
  }).join('');
  return `${heading('Library')}
    <div class="library-layout">
      <section>
        <div class="search">${icon('search')}<label class="visually-hidden" for="find-reference">Search references</label>
          <input id="find-reference" type="search" value="${escape(search)}" placeholder="Search references" data-focus="library-search">
        </div>
        <div class="filters" role="group" aria-label="Filter references">${filters.map(([id, label]) =>
          `<button class="tab" type="button" data-filter="${id}" data-focus="filter-${id}" aria-pressed="${(collections[filter] ? 'collections' : filter) === id}">${label}</button>`).join('')}</div>
        ${collections[filter] ? `<div class="collection-heading"><h2>${collections[filter]}</h2>${button('All collections', 'collections', 'text-button', 'back')}</div>` : ''}
        ${filter === 'collections' && library.length ? `<div class="collection-list">${collectionList}</div>` : `<ul class="shelf-rows" aria-label="References" id="results">${library.length ? libraryItems() : '<li class="no-results">Your references will appear here.</li>'}</ul>`}
        ${!library.length ? button('Add a reference', 'add', 'primary', 'plus') : ''}
      </section>
      <aside class="library-context"><h2>Bring your own audio</h2><p class="subtle">Keep a clip you want to hear again with its transcript.</p>
        ${button('Add reference', 'add', 'text-button', 'plus', 'data-focus="library-add"')}
      </aside>
    </div>`;
}

function back(label = 'Back') {
  return `<header class="top-back"><button class="back-control" type="button" data-action="back">${icon('back')}<span>${label}</span></button>
    <span class="prototype-note">Design prototype</span></header>`;
}

function choice(title, detail, action, symbol, disabled = false) {
  return `<button class="choice" type="button" data-action="${action}" data-focus="${action}" ${disabled ? 'aria-disabled="true"' : ''}>
    ${icon(symbol)}<span>${title}${detail ? `<small>${detail}</small>` : ''}</span>${icon('chevron')}
  </button>`;
}

function compactPlayer() {
  const item = library.find(reference => reference.id === recentLesson);
  if (!item || !playedReference) return '';
  const mark = progress.get(item.id);
  const cue = item.phrases[mark.cue];
  const canPlay = !unavailable && Boolean(cue.audio);
  const label = playing?.kind === 'phrase' && playing.lessonId === item.id ? 'Pause' : 'Play';
  return `<aside class="compact-player" aria-label="Current reference">
    <button type="button" class="compact-info" data-open="${item.id}" data-focus="compact-open" aria-label="Open current reference, ${escape(item.title)}">
      <strong>${escape(item.title)}</strong><small>Current reference · <span class="number" id="compact-time">${time(cue.start + mark.offset)}</span></small>
    </button>
    ${button(label, 'compact-play', 'quiet', label.toLowerCase(), `aria-label="${label} current reference" ${canPlay ? '' : 'disabled'}`)}
  </aside>`;
}

function playerScreen() {
  const item = lesson();
  const mark = spot();
  const line = phrase();
  if (!item || !line) return home();
  const canPlay = audioAvailable();
  const canCompare = canPlay && item.id === 'deadline' && mark.cue === 1;
  const transportStatus = screen.review ? 'History position' : 'Paused';
  const backLabel = screen.section === 'history' ? 'History' : screen.section === 'library' ? 'Library' : 'Studio';
  const passageRows = item.phrases.map((cue, i) => `<button class="passage" type="button" data-cue="${i}" data-focus="cue-${i}"
    ${i === mark.cue ? 'aria-current="true"' : ''}><span class="number">${time(cue.start)}</span><span>${escape(cue.text)}</span></button>`).join('');
  return `${back(backLabel)}
    <header class="reference-head"><h1 data-heading tabindex="-1">${escape(item.title)}</h1><p class="label">${escape(item.speaker)} · ${item.group} · ${time(item.duration)}</p></header>
    <div class="player-grid">
      <div>
        <section class="room" aria-label="Reference player">
          <div class="phrase-top"><span>Phrase ${mark.cue + 1} of ${item.phrases.length}</span><span id="transport-state">${canPlay ? transportStatus : 'Unavailable'}</span></div>
          <blockquote class="phrase">${escape(line.text)}</blockquote>
          <div class="timeline">
            <label for="cursor" class="visually-hidden">Position in this phrase</label>
            <input type="range" id="cursor" min="0" max="${line.length}" step=".05" value="${mark.offset}" aria-valuetext="${time(line.start + mark.offset)}" ${canPlay ? '' : 'disabled'}>
            <div class="time-labels"><span class="number" id="clock">${time(line.start + mark.offset)}</span><span class="number">${time(line.start + line.length)}</span></div>
          </div>
          <div class="transport">
            ${button('Replay', 'replay', 'quiet', 'replay', `aria-label="Replay phrase" ${canPlay ? '' : 'disabled'}`)}
            ${button('Play', 'play', 'on-room', 'play', `data-focus="play" ${canPlay ? '' : 'disabled'}`)}
            ${button('Next', 'next', 'quiet', 'next', `aria-label="Next phrase" data-focus="next-phrase" ${mark.cue === item.phrases.length - 1 ? 'disabled' : ''}`)}
          </div>
          ${canPlay ? '' : '<p class="unavailable" role="status">The reference audio is unavailable. Read the phrase or try it in a new situation.</p>'}
        </section>
        <div class="lesson-actions">
          ${choice('Try a new conversation', 'Use this phrase in a different situation.', 'transfer', 'chat')}
          ${choice('Record and compare', canCompare ? 'Make a take and hear it beside the reference.' : canPlay ? 'Try the sample take with the 0:42 phrase in Move a deadline.' : 'Available when this reference can play.', 'take', 'mic', !canCompare)}
          ${choice('Choose an activity', '', 'activities', 'tune')}
        </div>
        <div class="practice-footer">${button('Browse library', 'library', 'text-button', 'book', 'data-focus="browse-library"')}${button('Finish practice', 'finish', 'text-button', 'check')}</div>
      </div>
      <details class="passage-panel" ${matchMedia('(min-width: 680px)').matches ? 'open' : ''}>
        <summary>Passages</summary>${passageRows}
      </details>
    </div>`;
}

function wave(fromTake = false) {
  // Both samples use the same 31 time bins over the reference's 2.556 seconds.
  const figures = fromTake
    ? [0, 0, 0, 0, 1, 13, 4, 13, 19, 15, 14, 4, 8, 18, 10, 12, 8, 5, 1, 10, 6, 2, 2, 8, 4, 0, 0, 0, 0, 0, 0]
    : [0, 0, 0, 0, 17, 14, 26, 25, 31, 23, 10, 18, 19, 23, 17, 20, 9, 9, 3, 15, 17, 15, 2, 14, 10, 0, 0, 0, 0, 0, 0];
  return `<div class="wave" aria-hidden="true">${figures.map(height => `<i style="--bar:${Math.max(height, 1)}px"></i>`).join('')}</div>`;
}

function takeScreen() {
  const stage = screen.stage || 'prepare';
  const item = lesson();
  const line = phrase();
  const prepare = `<blockquote class="lead-quote">${escape(line?.text || '')}</blockquote>
      <p class="sample-help">This prototype uses a simulated take. Your microphone stays off.</p>
      ${capture ? `<div class="recording-meter"><strong>Simulating a take</strong><p class="number" id="take-clock">0:00</p>${wave(true)}</div>
        <div class="flow-actions">${button('Stop and compare', 'stop-take', 'primary', 'pause', 'data-focus="stop-take"')}${button('Cancel', 'cancel-take', 'quiet')}</div>`
      : `<div class="flow-actions">${button('Start sample take', 'start-take', 'primary', 'mic', 'data-focus="start-take"')}${button('Play reference', 'sample-ref', 'quiet', 'play', 'data-sample="reference"')}</div>`}`;
  const compare = `<div class="take-panel" aria-label="Compare two takes">
      <div class="take-row"><div><strong>Reference</strong><p class="subtle">${escape(item?.speaker || 'Sample recording')}</p></div>${button('Play reference', 'sample-ref', 'quiet', 'play', 'data-sample="reference"')}${wave()}</div>
      <div class="take-row"><div><strong>Sample take</strong><p class="sample-help">${savedTake ? 'Kept in this prototype session' : 'Simulated recording'}</p></div>${button('Play sample take', 'sample-take', 'quiet', 'play', 'data-sample="take"')}${wave(true)}</div>
      <p class="wave-scale number"><span>0:00</span><span>2.56 s</span></p>
    </div>
    <div class="flow-actions">${button('Try another take', 'to-record', 'quiet', 'replay')}${button(savedTake ? 'Take kept' : 'Keep sample take', 'keep-take', 'quiet', 'check', savedTake ? 'disabled' : '')}${button('Finish practice', 'finish', 'primary', 'check')}</div>`;
  const title = stage === 'compare' ? 'Compare the delivery' : capture ? 'Making a take' : 'Make a take';
  return `${back('Back to player')}<article class="flow">
      <header class="flow-head"><h1 data-heading tabindex="-1">${title}</h1><p class="label">${escape(item?.title || '')} · ${line ? time(line.start) : ''}</p></header>
      <div class="flow-main">${stage === 'compare' ? compare : prepare}</div>
    </article>`;
}

function activityScreen() {
  return `${back('Back to player')}
    <article class="flow">
      <header class="flow-head"><h1 data-heading tabindex="-1">Choose an activity</h1><p class="label">${escape(lesson()?.title || '')}</p></header>
      <ul class="activity-list">${Object.entries(activities).map(([id, item]) =>
        `<li>${choice(item.name, item.detail, `activity-${id}`, item.icon)}</li>`).join('')}</ul>
    </article>`;
}

function speakingScreen() {
  const item = screen.lesson && screen.activity === 'original' ? transferActivity : activities[screen.activity] || activities.original;
  const title = screen.lesson && screen.activity === 'original' ? 'Try a new conversation' : screen.activity === 'original' ? 'Speaking prompt' : item.name;
  return `${back(screen.exit === 'activities' ? 'Activities' : screen.lesson ? 'Player' : 'Studio')}
    <article class="flow">
      <header class="flow-head"><h1 data-heading tabindex="-1">${title}</h1></header>
      <div class="flow-main">
        <div class="prompt-stage"><p>${item.situation}</p><p><strong>${item.task}</strong></p></div>
        <div class="flow-actions">${button(screen.exit === 'activities' ? 'Back to activities' : screen.lesson ? 'Back to reference' : 'Done for now', screen.lesson ? 'back' : 'finish-prompt', 'primary', 'check')}</div>
      </div>
    </article>`;
}

function historyScreen() {
  return `${heading('History')}
    <div class="history-layout">
      <section aria-label="Recent practice">${journal.length ? `<ul class="history-list">${journal.map(entry =>
        `<li><button class="history-item" type="button" data-log="${entry.id}" data-focus="log-${entry.id}">
          <span class="stamp">${escape(entry.stamp)}</span><span><strong>${escape(entry.title)}</strong><small class="subtle">${escape(entry.detail)}</small></span>${icon('chevron')}
        </button></li>`).join('')}</ul>` : '<p class="no-results">Completed activity will appear here.</p>'}</section>
      <aside class="library-context"><h2>Pick up a phrase</h2><p class="subtle">Open a session to return to its saved reference or prompt.</p></aside>
    </div>`;
}

function completeScreen() {
  const last = journal.find(entry => entry.id === latestLog);
  return `${back('Back')}
    <article class="flow"><header class="flow-head"><h1 data-heading tabindex="-1">Done for now</h1></header>
      <div class="flow-main"><p>${last ? escape(last.detail) : 'You can return to this reference whenever you like.'}</p>
        <div class="flow-actions">${button('View history', 'history', 'primary', 'history')}${button('Back to Studio', 'studio', 'quiet')}</div>
      </div>
    </article>`;
}

function addScreen() {
  return `${back('Back')}<article class="flow">
    <header class="flow-head"><h1 data-heading tabindex="-1">Add a reference</h1></header>
    <div class="import-summary"><p>Bring a recording with timed text or add a prepared lesson archive.</p>
      <p class="subtle">Adding files is outside this prototype. The sample library shows how a prepared reference appears.</p>
      ${button('Back', 'back', 'quiet')}
    </div>
  </article>`;
}

const views = {studio: home, library: libraryScreen, player: playerScreen, take: takeScreen, activities: activityScreen, speaking: speakingScreen, history: historyScreen, complete: completeScreen, add: addScreen};

function render(focus = '', restoreScroll = 0) {
  const focusView = !browseViews.includes(screen.view);
  const compact = focusView ? '' : compactPlayer();
  root.innerHTML = `<div class="shell ${focusView ? 'view-focus' : ''} ${compact ? 'has-compact' : ''}">
    <aside class="rail">${brand()}${navigation('rail-nav')}${button('Add reference', 'add', 'text-button add-reference', 'plus', 'data-focus="add-from-rail"')}
      <p class="prototype-note">Design prototype · sample material</p>
    </aside>
    <header class="masthead">${brand()}${button('Add', 'add', 'text-button', 'plus', 'data-focus="add-from-header"')}</header>
    <main id="content" class="main" tabindex="-1">${views[screen.view]()}</main>
    ${compact}
    ${navigation('mobile-nav')}
  </div>`;
  updateTransport();
  if (focus) {
    const targets = Array.from(root.querySelectorAll('[data-focus]'));
    const target = targets.find(element => element.dataset.focus === focus && !element.disabled && element.getClientRects().length);
    (target || root.querySelector('[data-heading]'))?.focus({preventScroll: true});
  }
  window.scrollTo(0, restoreScroll);
}

function routeHash(route) {
  const suffix = route.view === 'take' ? `-${route.stage}` : '';
  return `#${route.view}${suffix}`;
}

function enter(next) {
  const carriesPlayback = playing?.kind === 'phrase' &&
    (browseViews.includes(next.view) || (next.view === 'player' && next.lesson === playing.lessonId && !next.review));
  if (!carriesPlayback) stopAudio();
  stopCapture();
  screen = next;
}

function go(view, changes = {}) {
  history.replaceState({...screen, focus: document.activeElement?.dataset.focus || '', scroll: window.scrollY}, '', routeHash(screen));
  enter({view, section: screen.section, ...changes});
  if (['studio', 'library', 'history'].includes(view)) screen.section = view;
  history.pushState(screen, '', routeHash(screen));
  render('heading');
}

function setStep(stage) {
  stopAudio();
  stopCapture();
  screen = {...screen, stage};
  history.replaceState(screen, '', routeHash(screen));
  render('heading');
}

function stopCapture() {
  if (!capture) return;
  clearInterval(capture.timer);
  capture = null;
}

function playbackButton(control, active, target = '') {
  if (!control) return;
  const verb = active ? 'Pause' : 'Play';
  const label = target ? `${verb} ${target}` : verb;
  if (control.textContent !== label) control.innerHTML = `${icon(verb.toLowerCase())}<span>${label}</span>`;
}

function updateTransport() {
  const status = root.querySelector('#transport-state');
  const slider = root.querySelector('#cursor');
  const current = phrase();
  if (status && slider && current) {
    const active = playing?.kind === 'phrase' && playing.lessonId === lesson()?.id;
    playbackButton(root.querySelector('[data-action="play"]'), active);
    status.textContent = !audioAvailable() ? 'Unavailable' : active ? 'Playing' : screen.review ? 'History position' : 'Paused';
    const position = spot().offset;
    slider.value = position;
    slider.setAttribute('aria-valuetext', time(current.start + position));
    root.querySelector('#clock').textContent = time(current.start + position);
  }
  root.querySelectorAll('[data-sample]').forEach(control => {
    const tag = control.dataset.sample;
    playbackButton(control, playing?.kind === tag, tag === 'take' ? 'sample take' : 'reference');
  });
  const compact = root.querySelector('[data-action="compact-play"]');
  const compactTime = root.querySelector('#compact-time');
  if (compact && compactTime) {
    const active = playing?.kind === 'phrase' && playing.lessonId === recentLesson;
    const item = library.find(reference => reference.id === recentLesson);
    const mark = progress.get(recentLesson);
    const label = active ? 'Pause' : 'Play';
    if (compact.textContent !== label) compact.innerHTML = `${icon(label.toLowerCase())}<span>${label}</span>`;
    compact.setAttribute('aria-label', `${label} current reference`);
    compactTime.textContent = time(item.phrases[mark.cue].start + mark.offset);
  }
}

function stopAudio() {
  if (!playing) return;
  if (playing.kind === 'phrase' && playing.audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    playing.mark.offset = Math.min(playing.line.length, playing.audio.currentTime);
  }
  playing.audio.pause();
  playing = null;
  updateTransport();
}

function soundFor(item, mark, kind, restart = false) {
  const line = item?.phrases[mark?.cue];
  const track = kind === 'take' ? 'sample-take.mp3' : line?.audio;
  if (!track || unavailable) return;
  if (playing?.kind === kind && playing.lessonId === item.id && !restart) {
    stopAudio();
    return;
  }
  stopAudio();
  const isPhrase = kind === 'phrase';
  if (isPhrase && (restart || mark.offset >= line.length - .05)) mark.offset = 0;
  const begin = isPhrase ? mark.offset : 0;
  const audio = new Audio(assets + track);
  const context = {kind, audio, lessonId: item.id, mark, line};
  playing = context;
  if (begin) audio.addEventListener('loadedmetadata', () => {
    if (playing === context) audio.currentTime = Math.min(begin, audio.duration);
  }, {once: true});
  audio.addEventListener('playing', () => {
    if (playing !== context) return;
    const result = exercise(item.id);
    if (kind === 'take') result.compared = true;
    else result.heard.add(mark.cue);
    if (restart) result.replayed += 1;
  }, {once: true});
  audio.addEventListener('timeupdate', () => {
    if (playing !== context || !isPhrase) return;
    mark.offset = Math.min(line.length, audio.currentTime);
    updateTransport();
  });
  audio.addEventListener('ended', () => {
    if (playing === context) stopAudio();
  });
  audio.play().catch(() => {
    if (playing !== context) return;
    stopAudio();
    say('This sample could not play.');
  });
  updateTransport();
}

function playSound(kind, restart = false) {
  if (!audioAvailable() && kind !== 'take') return;
  const item = lesson();
  if (kind === 'phrase' && screen.review) {
    progress.set(item.id, {...screen.review});
    const {review, ...current} = screen;
    screen = current;
    history.replaceState(screen, '', routeHash(screen));
    recentLesson = item.id;
    playedReference = true;
  }
  soundFor(item, spot(), kind, restart);
}

function selectCue(index, focus = 'play') {
  if (!lesson()?.phrases[index]) return;
  stopAudio();
  spot().cue = index;
  spot().offset = 0;
  render(focus, window.scrollY);
}

function finish(withPrompt = false) {
  const item = lesson();
  const mark = spot();
  const result = exercise();
  latestLog = '';
  if (result.heard.size || result.marked.size || result.compared || withPrompt) {
    const actionLog = [];
    if (withPrompt) {
      actionLog.push('Opened an original speaking prompt');
    } else {
      if (result.heard.size) actionLog.push(`Played ${result.heard.size} ${result.heard.size === 1 ? 'phrase' : 'phrases'}`);
      if (result.replayed) actionLog.push(`Replayed ${result.replayed} ${result.replayed === 1 ? 'time' : 'times'}`);
      if (result.marked.size) actionLog.push(`${result.marked.size} marked practised`);
      if (result.compared) actionLog.push('Played a simulated take');
      actionLog.push(`Stopped at ${time(phrase().start + mark.offset)}`);
      sessions.delete(item.id);
    }
    latestLog = `session-${journal.length}`;
    journal.unshift({
      id: latestLog, title: withPrompt ? 'Speaking prompt' : item.title, stamp: 'This session',
      detail: actionLog.join(' · '), lesson: withPrompt ? null : item.id, cue: mark?.cue, offset: mark?.offset,
    });
  }
  go('complete');
}

root.addEventListener('click', event => {
  const control = event.target.closest('button');
  if (!control || control.getAttribute('aria-disabled') === 'true') return;
  const {action, go: destination, open, favourite, log, cue} = control.dataset;
  if (destination) {
    if (screen.view !== destination) go(destination);
    return;
  }
  if (open) {
    recentLesson = open;
    playedReference = true;
    go('player', {lesson: open});
    return;
  }
  if (favourite) {
    if (favorites.has(favourite)) favorites.delete(favourite);
    else favorites.add(favourite);
    const enabled = favorites.has(favourite);
    if (filter === 'favorites' && screen.view === 'library') {
      document.querySelector('#results').innerHTML = libraryItems();
      root.querySelector('#find-reference')?.focus();
    } else {
      control.setAttribute('aria-pressed', enabled);
    }
    say(enabled ? 'Added to favourites.' : 'Removed from favourites.');
    return;
  }
  if (control.dataset.filter) {
    filter = control.dataset.filter;
    render(`filter-${filter}`, window.scrollY);
    return;
  }
  if (action?.startsWith('collection-')) {
    filter = action.slice(11);
    render('heading', window.scrollY);
    return;
  }

  if (log) {
    const entry = journal.find(item => item.id === log);
    if (entry.lesson) {
      go('player', {lesson: entry.lesson, review: {cue: entry.cue, offset: entry.offset}});
    } else {
      go('speaking', {activity: 'original'});
    }
    return;
  }
  if (cue !== undefined) {
    selectCue(Number(cue), `cue-${cue}`);
    return;
  }
  if (action?.startsWith('activity-')) {
    go('speaking', {activity: action.slice(9), lesson: screen.lesson, exit: 'activities'});
    return;
  }

  switch (action) {
    case 'back': history.back(); break;
    case 'studio':
    case 'library':
    case 'history':
    case 'add': go(action); break;
    case 'collections':
      filter = 'collections';
      render('filter-collections', window.scrollY);
      break;
    case 'original': go('speaking', {activity: 'original'}); break;
    case 'transfer': go('speaking', {activity: 'original', lesson: lesson().id}); break;
    case 'activities': go('activities', {lesson: lesson().id}); break;
    case 'take':
      savedTake = false;
      go('take', {lesson: lesson().id, stage: 'prepare', review: screen.review});
      break;
    case 'to-record': setStep('prepare'); break;
    case 'compact-play':
      soundFor(library.find(item => item.id === recentLesson), progress.get(recentLesson), 'phrase');
      break;
    case 'sample-ref': playSound('reference'); break;
    case 'sample-take': playSound('take'); break;
    case 'play': playSound('phrase'); break;
    case 'replay': playSound('phrase', true); break;
    case 'next':
      if (audioAvailable() && exercise().heard.has(spot().cue)) exercise().marked.add(spot().cue);
      selectCue(spot().cue + 1, 'next-phrase');
      if (audioAvailable()) playSound('phrase');
      break;
    case 'start-take': {
      stopAudio();
      const started = Date.now();
      capture = {timer: setInterval(() => { root.querySelector('#take-clock').textContent = time((Date.now() - started) / 1000); }, 200)};
      render('stop-take');
      break;
    }
    case 'cancel-take': setStep('prepare'); break;
    case 'stop-take':
      savedTake = false;
      setStep('compare');
      break;
    case 'keep-take':
      savedTake = true;
      render('heading');
      say('Sample take kept in the prototype session.');
      break;
    case 'finish': finish(); break;
    case 'finish-prompt': finish(true); break;
    default: break;
  }
});

root.addEventListener('input', event => {
  if (event.target.id === 'find-reference') {
    search = event.target.value;
    if (filter === 'collections' || collections[filter]) {
      filter = 'all';
      render('library-search', window.scrollY);
    } else document.querySelector('#results').innerHTML = libraryItems();
  }
  if (event.target.id === 'cursor') {
    const position = Number(event.target.value);
    stopAudio();
    spot().offset = position;
    updateTransport();
  }
});

window.addEventListener('popstate', event => {
  enter(event.state?.view && Object.hasOwn(views, event.state.view) ? event.state : {view: 'studio', section: 'studio'});
  render(screen.focus || 'heading', screen.scroll || 0);
});

document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  document.querySelector('#content')?.focus();
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !['studio', 'library', 'history'].includes(screen.view)) {
    event.preventDefault();
    history.back();
  }
});

history.replaceState(screen, '', '#studio');
render();
