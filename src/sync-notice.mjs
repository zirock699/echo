import {uiIcon} from './ui-icons.mjs';

const saveProblems={
 'state-too-large':{message:'This library is too large to send.',help:'Export a backup, reduce the library, then retry sync.'},
 'storage-too-large':{message:'This library exceeds account storage limits.',help:'Export a backup, remove some lessons or shorten large transcripts, then retry sync.'},
 'state-count-limit':{message:'This library exceeds the supported item limit.',help:'Export a backup, reduce the number of lessons, collections or sessions, then retry sync.'},
 'media-retired':{message:'A file in this library was removed from storage.',help:'Reattach the file or restore a current backup, then retry sync.'},
 'invalid-state':{message:'The account could not accept this library.',help:'Export a backup, check recent edits or restore a valid Echo Studio backup, then retry sync.'},
};

function pendingLocation(store){
 if(!store.pending)return '';
 if(store.cacheStatus==='saved')return 'Pending changes are saved on this device.';
 if(store.cacheStatus==='unavailable')return 'Your changes are only in this tab.';
 return 'Device save is in progress.';
}

export function syncProblem(store){
 if(store.deviceReviewRequired)return {
  key:'device-drafts',message:'This browser has more than one pending library copy.',
  title:'Review device copies',help:'Compare the copies, export a backup, or choose which copy to continue using.',
  action:'device-drafts',label:'Review',
 };
 if(store.mode==='conflict')return {
  key:`conflict:${store.conflict?.revision??store.revision}`, message:'A newer library copy is available.',
  title:'Choose a library copy', help:`A newer copy was saved on another device. ${pendingLocation(store)} Choose which copy to keep.`,
  action:'sync-details', label:'Review',
 };
 if(store.mode==='rejected'||store.saveError){
  const key=store.saveError?.code||'media-retired';
  const {message,help}=saveProblems[key]||saveProblems['invalid-state'];
  return {key,message,title:'Library could not sync',help:`${message} ${pendingLocation(store)} ${help}`.trim(),action:'sync-details',label:'Details'};
 }
 if(store.deviceDrafts?.some(copy=>copy.revision!==store.revision))return {
  key:'device-copy-earlier',message:'An earlier device copy is available.',
  title:'Review device copies',help:'Compare the device copy with the working library or export a backup.',
  action:'device-drafts',label:'Review',
 };
 if(store.mode==='offline'||store.mode==='local'){
  if(store.cacheStatus!=='unavailable')return {key:'unavailable',message:'Sync is unavailable.',action:'retry-sync',label:'Retry'};
  return {key:'sync-and-storage',message:'Sync and device storage are unavailable.',title:'Sync and device storage unavailable',
   help:`${pendingLocation(store)} Reconnect to save to your account, or check this browser’s storage settings.`.trim(),action:'sync-details',label:'Details'};
 }
 if(store.cacheStatus==='unavailable')return {
  key:store.pending?'storage-pending':'storage-saved',message:'Device storage is unavailable.',title:'Device storage unavailable',
  help:`${pendingLocation(store)||'Your library is saved to your account.'} Check this browser’s storage settings for offline saving.`,
  action:'sync-details',label:'Details',
 };
 return null;
}

// Dismissal belongs to a particular issue, never to the saved library or its resolution.
function dismissalKey(issue,store){
 return issue?.action==='device-drafts'?`${issue.key}:${store.deviceDraftOccurrence??0}`:issue?.key??null;
}
export function syncIssueKey(store){return dismissalKey(syncProblem(store),store);}

export function syncSaveMessage(store){
 if(store.deviceReviewRequired)return [syncProblem(store).message,pendingLocation(store)].filter(Boolean).join(' ');
 if(store.mode==='cloud'&&!store.pending)return 'Library saved to your account.';
 const problem=syncProblem(store),location=pendingLocation(store);
 if(store.mode==='cloud'&&!store.saveError)return `Saving to your account… ${location}`.trim();
 if(store.mode==='rejected')return problem.help;
 const backup=store.pending&&store.cacheStatus==='unavailable'?'Export a backup before closing this tab.':'';
 return [problem?.message??'Sync is unavailable.',location,backup].filter(Boolean).join(' ');
}

export function syncNoticeHTML(store,{dismissed=null,retrying=false}={}){
 const issue=syncProblem(store);
 if(!issue||dismissalKey(issue,store)===dismissed)return '';
 const retry=issue.action==='retry-sync'&&retrying;
 const location=store.mode==='cloud'&&!store.pending&&!store.deviceReviewRequired?'Saved to your account.':pendingLocation(store);
 const button=`<button id="sync-notice-action" class="text-link" data-action="${issue.action}" ${retry?'disabled':''}>${retry?'Retrying…':issue.label}</button>`;
 return `<aside class="sync-notice" aria-label="Synchronisation status"><p role="status">${issue.message} ${location}</p>${button}<button class="icon-btn" data-action="dismiss-sync" aria-label="Dismiss sync message">${uiIcon('close')}</button></aside>`;
}
