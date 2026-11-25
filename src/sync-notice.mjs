import {uiIcon} from './ui-icons.mjs';

// Dismissal belongs to a particular issue, never to the saved library or its resolution.
export function syncIssueKey(store){
 if(store.mode==='conflict')return `conflict:${store.conflict?.revision??store.revision}`;
 if(store.mode==='offline'||store.mode==='local')return 'unavailable';
 return store.mode==='storage-error'?'storage-error':null;
}

export function syncNoticeHTML(store,{dismissed=null,retrying=false}={}){
 const issue=syncIssueKey(store);
 if(!issue||issue===dismissed)return '';
 const conflict=store.mode==='conflict',storage=store.mode==='storage-error';
 const message=conflict?'A newer library copy is available.':storage?'Device storage is unavailable. Your changes may not be saved.':'Changes are saved on this device. Sync is unavailable.';
 const action=conflict||storage?'sync-details':'retry-sync';
 const label=conflict?'Review':storage?'Details':retrying?'Retrying…':'Retry';
 return `<aside class="sync-notice" aria-label="Synchronisation status"><p role="status">${message}</p><button id="sync-notice-action" class="text-link" data-action="${action}" ${retrying&&action==='retry-sync'?'disabled':''}>${label}</button><button class="icon-btn" data-action="dismiss-sync" aria-label="Dismiss sync message">${uiIcon('close')}</button></aside>`;
}
