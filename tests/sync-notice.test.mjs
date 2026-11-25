import test from 'node:test';
import assert from 'node:assert/strict';
import {syncIssueKey,syncNoticeHTML} from '../src/sync-notice.mjs';

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
 for(const mode of ['conflict','storage-error'])assert.match(syncNoticeHTML({mode},{dismissed}),/Dismiss sync message/);
 for(const mode of ['checking','cloud'])assert.equal(syncNoticeHTML({mode}),'');
});

test('retry state stays dismissible and storage failures offer details rather than copy selection',()=>{
 const retry=syncNoticeHTML({mode:'offline'},{retrying:true});
 assert.match(retry,/retry-sync" disabled/);assert.match(retry,/Dismiss sync message/);
 const storage=syncNoticeHTML({mode:'storage-error'});
 assert.match(storage,/>Details</);assert.doesNotMatch(storage,/conflict-cloud|conflict-local/);
});
