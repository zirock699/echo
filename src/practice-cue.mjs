const homeCue = {
  kind: 'home-prompt',
  title: 'Speaking prompt',
  situation: 'Your colleague expects the figures on Tuesday. They’ll be ready on Thursday. Ask your colleague to check them on Friday.',
  task: 'Say the update in your own words.',
  note: 'One short reply is enough. You can plan silently.',
  exit: 'Back to Home',
};
const transferCue = {
  kind: 'transfer-prompt',
  title: 'Take a phrase into a new conversation',
  situation: 'A teammate expects tomorrow’s meeting to be online. It will be in the studio instead. Ask them to bring the draft.',
  task: 'Give the update in your own words.',
  note: 'If it helps, borrow an expression or a way of emphasising a detail from your selected phrase.',
  exit: 'Back to Practice options',
};
const playerCue = {...transferCue, exit: 'Back to player'};

export function practiceCue(modal) {
  if (modal?.type === homeCue.kind) return homeCue;
  if (modal?.type === transferCue.kind) return modal.from === 'player' ? playerCue : transferCue;
  return null;
}

/** Keep the active, text-only exercise mounted through background shell updates. */
export class PracticeCueRegion {
  constructor(root, closeIcon) {
    this.root = root;
    this.closeIcon = closeIcon;
    this.element = null;
    this.cue = null;
  }

  render(shell, cue) {
    if (cue && cue === this.cue && this.element?.parentNode === this.root) {
      const stage = this.root.ownerDocument.createRange();
      stage.setStart(this.root, 0);
      stage.setEndBefore(this.element);
      const content = stage.createContextualFragment(shell);
      stage.deleteContents();
      this.root.insertBefore(content, this.element);
      return;
    }
    this.cue = cue;
    this.root.innerHTML = shell + (cue ? this.sheet(cue) : '');
    this.element = cue ? this.root.lastElementChild : null;
  }

  sheet(cue) {
    const transfer = cue.kind === 'transfer-prompt';
    return `<div class="modal-shade prompt-shade${transfer ? ' transfer-prompt-shade' : ''}" data-action="shade">
      <section class="modal speaking-prompt" role="dialog" aria-modal="true" aria-labelledby="speaking-prompt-title" data-focus-dialog="app:${cue.kind}">
        <div class="modal-head">
          <h2 id="speaking-prompt-title" tabindex="-1" data-focus-initial>${cue.title}</h2>
          <button id="speaking-prompt-close" class="icon-btn" type="button" data-action="modal-close" aria-label="Close prompt">${this.closeIcon}</button>
        </div>
        <p class="prompt-situation">${cue.situation}</p>
        <p class="prompt-task">${cue.task}</p>
        <p class="prompt-note">${cue.note}</p>
        <div class="modal-footer"><button id="speaking-prompt-exit" class="btn" type="button" data-action="modal-close">${cue.exit}</button></div>
      </section>
    </div>`;
  }
}
