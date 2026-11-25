'use strict';

const screens = {
  home: {name: 'Start', baseline: '01-home', note: 'A prepared library and saved position.'},
  library: {name: 'Library', baseline: '02-library', note: 'Find a reference you want to hear again.'},
  player: {name: 'Player', baseline: '03-player', note: 'A selected phrase, paused, with its surrounding context.'},
  comparison: {name: 'Record and compare', baseline: '04-comparison', note: 'Reference and example take ready to compare.'},
  activities: {name: 'Activities', baseline: '05-practice-selection', note: 'Choose what to practise.'},
  history: {name: 'Return', baseline: '07-history', note: 'See previous activity and what it lets you do next.'},
};

const directions = [
  {name: 'Current app', detail: 'Echo Studio · 1497245', path: (screen, size) => `baseline/${screens[screen].baseline}-${size}-${size === '430x932' ? 'light' : 'dark'}.webp`},
  {name: 'A · The Listening Room', detail: 'Start from material you chose.', path: (screen, size) => `screens/a-${screen}-${size}.webp`},
  {name: 'B · Rehearsal Desk', detail: 'Start with an update to deliver.', path: (screen, size) => `screens/b-${screen}-${size}.webp`},
];

const frames = document.querySelector('#frames');
const viewport = document.querySelector('#viewport');
const status = document.querySelector('#comparison-status');
const screenButtons = [...document.querySelectorAll('[data-screen]')];
const selection = new URLSearchParams(location.hash.slice(1));
let current = Object.hasOwn(screens, selection.get('screen')) ? selection.get('screen') : 'home';
viewport.value = [...viewport.options].some(option => option.value === selection.get('size')) ? selection.get('size') : '390x844';

function text(tag, label) {
  const node = document.createElement(tag);
  node.textContent = label;
  return node;
}

function frame(direction, screen, size) {
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.append(text('h3', direction.name), text('p', direction.detail));
  const link = document.createElement('a');
  link.href = direction.path(screen, size);
  link.setAttribute('aria-label', `Open full-size ${direction.name}, ${screens[screen].name}`);
  const image = new Image();
  const [width, height] = size.split('x').map(Number);
  image.width = width;
  image.height = height;
  image.alt = `${direction.name}, ${screens[screen].name}. ${screens[screen].note.trim()}`;
  image.src = link.href;
  image.decoding = 'async';
  link.append(image);
  figure.append(caption, link);
  return figure;
}

function display({updateLocation = false} = {}) {
  const size = viewport.value;
  frames.dataset.view = size;
  frames.replaceChildren(...directions.map(direction => frame(direction, current, size)));
  for (const button of screenButtons) button.setAttribute('aria-pressed', String(button.dataset.screen === current));
  status.textContent = `Showing ${screens[current].name} at ${size.replace('x', ' by ')} pixels.`;
  if (updateLocation) {
    const data = new URLSearchParams({screen: current, size});
    history.replaceState(null, '', `#${data}`);
  }
}

for (const button of screenButtons) {
  button.addEventListener('click', () => {
    current = button.dataset.screen;
    display({updateLocation: true});
  });
}
viewport.addEventListener('change', () => display({updateLocation: true}));
display();
