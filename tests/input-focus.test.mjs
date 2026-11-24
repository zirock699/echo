import test from 'node:test';
import assert from 'node:assert/strict';
import {textSelection} from '../src/input-focus.mjs';

test('search selection survives a render, including mid-word edits and backward selection',()=>{
 const input={tagName:'INPUT',type:'search',selectionStart:3,selectionEnd:7,selectionDirection:'backward'};
 assert.deepEqual(textSelection(input),[3,7,'backward']);
 assert.deepEqual(textSelection({...input,selectionStart:9,selectionEnd:9,selectionDirection:'none'}),[9,9,'none']);
 assert.equal(textSelection({...input,type:'range'}),null);
 assert.equal(textSelection(null),null);
});
