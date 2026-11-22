import test from 'node:test';import assert from 'node:assert/strict';import {lookupIPA,phraseIPA} from '../src/ipa.mjs';
test('British dictionary, punctuation, override and unknown',()=>{assert.equal(lookupIPA('Today,'),'təˈdeɪ');assert.equal(lookupIPA('unknownxyz'),null);assert.equal(lookupIPA('Word!',{word:'wɜːd'}),'wɜːd');assert.ok(phraseIPA('Hello unknownxyz').includes('·'));});
