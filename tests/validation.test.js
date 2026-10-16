import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClue, validatePack, forbiddenText } from '../core/validation.js';
import { Room } from '../core/engine.js';
import { WORDS } from '../server/content.js';
const word = WORDS[0];
function room() { const r = new Room({ id: 'TEST', words: WORDS, pick: () => 0, validate: validateClue }); for (let i = 0; i < 4; i++) r.add(String(i), 'Player', 0); r.start('0', 0); return r; }
test('V01 exact answer and all prepared forbidden words rejected', () => {
  for (const w of WORDS) for (const value of [w.answer, ...w.forbidden]) assert.equal(validateClue(` ${value.toUpperCase()} `, w).ok, false);
});
test('V02 normalization and explicit syntax boundaries', () => {
  for (const v of ['', 'a', 'a'.repeat(21), 'two words', 'hello-world', "can't", 'air\u200bport', 'queue!', '123', null]) assert.equal(validateClue(v, word).ok, false);
  assert.deepEqual(validateClue(' QUEUE ', word), { ok: true, value: 'queue' });
  assert.deepEqual(validateClue('ｑｕｅｕｅ', word), { ok: true, value: 'queue' });
  assert.equal(validateClue('a'.repeat(20), word).ok, true);
});
test('V03 allowed clues and moderation regression fixtures', () => {
  for (const v of ['queue', 'luggage', 'passport', 'class', 'grass', 'grape', 'scrape']) assert.equal(validateClue(v, word).ok, true);
  for (const v of ['shit', 'fuck', 'porn']) assert.equal(validateClue(v, word).ok, false);
});
test('V04 personal repeat blocked but cross player duplicate accepted', () => {
  const r = room(); assert.equal(r.submit('0', 'queue', 1, 'clue1', 0).ok,true);assert.equal(r.submit('1', 'queue', 1, 'clue1', 0).ok,true);r.tick(68000);
  assert.equal(r.submit('2', 'queue', 1, 'clue2', 68000).ok, true);r.tick(88000);
  assert.equal(r.submit('0', 'queue', 1, 'clue2', 88000).code, 'clue');
});
test('V05 executable markup cannot enter accepted clues', () => { for (const v of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>']) assert.equal(validateClue(v, word).ok, false); });
test('V06 fake clock rate boundary and bounded budget', () => {
  const r = room(); r.submit('0', 'airport', 1, 'clue1', 0);
  assert.equal(r.submit('0', 'queue', 1, 'clue1', 749).code, 'rate'); assert.equal(r.submit('0', 'queue', 1, 'clue1', 750).ok, true);
  const capped=room();for (let n = 0; n < 6; n++) capped.submit('0', 'airport', 1, 'clue1', n * 750);
  assert.equal(capped.submit('0', 'queue', 1, 'clue1', 5000).code, 'budget');
});
test('V07 locked submission cannot be overwritten', () => { const r = room(); r.submit('0', 'queue', 1, 'clue1', 0); assert.equal(r.submit('0', 'airport', 1, 'clue1', 750).ok,false); assert.equal(r.view('0', 750).me.clue, 'queue'); });
test('V08 pack structure, identifiers and references', () => { assert.equal(validatePack(WORDS), true); assert.throws(() => validatePack([...WORDS, WORDS[0]])); assert.throws(() => validatePack([{ ...word, forbidden: [null] }, WORDS[1]])); });
test('V09 emoji sequences and dash variants with near matches', () => {
  for (const v of ['hi😀', 'flag🇮🇳', 'key1️⃣', 'skin👍🏽', 'family👩‍👧', 'a-b', 'a--b', 'a–b', 'a—b', 'a−b']) { assert.equal(forbiddenText(v), true); assert.equal(validateClue(v, word).ok, false); }
  assert.equal(forbiddenText('Room 123'), false); assert.equal(forbiddenText('Good clue'), false);
});
test('V10 exact word, obvious clue and moderation rejection have same public result', () => {
  const outputs = ['airport', 'plane', 'shit'].map(value => room().submit('0', value, 1, 'clue1', 0));
  assert.deepEqual(outputs[0], outputs[1]); assert.deepEqual(outputs[0], outputs[2]);
  assert.deepEqual(outputs[0], { ok: false, code: 'clue', message: 'Choose another clue' });
});
test('V11 concurrent attempts and reconnect cannot reset budget, new round can', () => {
  const r = room(); for (let n = 0; n < 6; n++) r.submit('0', 'airport', 1, 'clue1', n * 750);
  r.setConnected('0', false, 5000); r.setConnected('0', true, 5001);
  assert.equal(r.submit('0', 'queue', 1, 'clue1', 5002).code, 'budget');
  r.tick(148000); assert.equal(r.submit('0', 'queue', 1, 'clue2', 148000).ok, true);
  assert.equal(r.submit('0', 'bags', 1, 'clue2', 148000).ok, false);
});
test('V12 categories require multiple canonical answers and duplicate aliases rejected', () => {
  assert.throws(() => validatePack([word, { ...WORDS[1], category: 'Unique' }]));
  assert.throws(() => validatePack([word, { ...word, id: 'other' }]));
});
