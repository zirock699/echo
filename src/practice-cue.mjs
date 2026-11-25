const homeCue = {
  kind: 'home-prompt',
  title: 'Speaking prompt',
  situation: 'Your colleague expects the figures on Tuesday. They’ll be ready on Thursday. Ask your colleague to check them on Friday.',
  task: 'Say the update in your own words.',
  note: 'One short reply is enough. You can plan silently.',
  exit: 'Back to Rehearse',
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

const drillCue = {kind: 'drill-prompt', exit: 'Back to drills'};
export const practiceDrills = {
  clarity: {...drillCue, id: 'clarity', title: 'Make the key detail clear', icon: 'volume',
    description: 'Help the listener pick out a changed time.',
    situation: 'Apprentices have been told the workshop starts at nine. The room now opens at half past nine. Ask them to bring their notes.',
    task: 'Give the update with the new time easy to hear.', note: 'Try once more with a short pause before the new time.'},
  rhythm: {...drillCue, id: 'rhythm', title: 'Give the message room', icon: 'wave',
    description: 'Use a pause to separate a decision from a request.',
    situation: 'A colleague needs to know that the interview can go ahead. Ask them to send the address before the end of the day.',
    task: 'Say the decision, pause briefly, then make the request.', note: 'Take another pass if the two parts run together.'},
  wording: {...drillCue, id: 'wording', title: 'Find a useful expression', icon: 'edit',
    description: 'Use a phrase in an unfamiliar situation.',
    situation: 'The final artwork won’t arrive until lunch. Ask the team to check the captions while they wait.',
    task: 'Give the update in your own words. Try “in the meantime” if it fits.', note: 'Try saying it again with a different expression.'},
  delivery: {...drillCue, id: 'delivery', title: 'Change the delivery', icon: 'spark',
    description: 'Try the same request with a different tone.',
    situation: 'Your teammate has been busy. Ask them to take a quick look at the estimate before the call.',
    task: 'Say it once as a friendly invitation and once as a direct request.', note: 'Choose the version that feels right for the relationship.'},
};

export function practiceCue(modal) {
  if (modal?.type === homeCue.kind) return homeCue;
  if (modal?.type === transferCue.kind) return modal.from === 'player' ? playerCue : transferCue;
  if (modal?.type === drillCue.kind && Object.hasOwn(practiceDrills, modal.from)) return practiceDrills[modal.from];
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
