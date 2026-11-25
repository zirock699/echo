import test from 'node:test';
import assert from 'node:assert/strict';
import {syncIssueKey,syncNoticeHTML,syncProblem,syncSaveMessage} from '../src/sync-notice.mjs';

test('dismissing a conflict hides only that revision and leaves both copies intact',()=>{
 const store={mode:'conflict',revision:3,pending:true,data:{lessons:['local']},conflict:{revision:4,data:{lessons:['cloud']}}};
 const before=JSON.stringify(store),dismissed=syncIssueKey(store);
 assert.match(syncNoticeHTML(store),/data-action="sync-details"/);
 assert.equal(syncNoticeHTML(store,{dismissed}),'');
 assert.equal(JSON.stringify(store),before);
 store.conflict.revision=5;assert.notEqual(syncNoticeHTML(store,{dismissed}),'');
});

test('a dismissed connection notice never hides a later conflict or storage error',()=>{
 const dismissed=syncIssueKey({mode:'offline'});
 assert.equal(syncNoticeHTML({mode:'local'},{dismissed}),'');
 for(const store of [{mode:'conflict'},{mode:'cloud',cacheStatus:'unavailable'}])assert.match(syncNoticeHTML(store,{dismissed}),/Dismiss sync message/);
 for(const mode of ['checking','cloud'])assert.equal(syncNoticeHTML({mode}),'');
});

test('retry state stays dismissible and storage failures offer details rather than copy selection',()=>{
 const retry=syncNoticeHTML({mode:'offline'},{retrying:true});
 assert.match(retry,/retry-sync" disabled/);assert.match(retry,/Dismiss sync message/);
 const storage=syncNoticeHTML({mode:'cloud',cacheStatus:'unavailable'});
 assert.match(storage,/>Details</);assert.doesNotMatch(storage,/conflict-cloud|conflict-local/);
});

test('account success and unavailable device storage remain independently visible',()=>{
 const store={mode:'cloud',cacheStatus:'unavailable',pending:false};
 assert.match(syncNoticeHTML(store),/Device storage is unavailable.*Saved to your account/s);
 assert.equal(syncSaveMessage(store),'Library saved to your account.');
 const dismissed=syncIssueKey(store);
 store.pending=true;
 assert.match(syncNoticeHTML(store,{dismissed}),/only in this tab/);
 assert.match(syncSaveMessage(store),/^Saving to your account/);
});

test('permanent size rejection and a volatile snapshot give specific recovery',()=>{
 const store={mode:'rejected',cacheStatus:'unavailable',pending:true,saveError:{code:'storage-too-large'}};
 assert.match(syncNoticeHTML(store),/storage limits.*only in this tab/s);
 assert.match(syncSaveMessage(store),/Export a backup/);
 assert.match(syncProblem(store).help,/shorten large transcripts/);
 assert.doesNotMatch(syncNoticeHTML(store),/data-action="retry-sync"|Saved to your account/);
 store.mode='offline';store.saveError=null;
 assert.match(syncNoticeHTML(store),/Sync and device storage are unavailable/);
 assert.match(syncSaveMessage(store),/Export a backup before closing this tab/);
});
