import emojiRegex from 'emoji-regex';
export const forbiddenText = value => /[\p{Pd}\u2212\uFE0E\uFE0F\u200D]/u.test(value) || emojiRegex().test(value);
export const normalize = value => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
const moderation = ['fuck', 'shit', 'bitch', 'asshole', 'porn', 'nazi', 'rape'];
export function validateChat(raw) {
  if(typeof raw!=='string'||raw.length>80||forbiddenText(raw))return {ok:false};
  const value=raw.trim().replace(/ +/g,' ');
  if(!/^[A-Za-z0-9 .,!?'()]{2,80}$/.test(value)||!/[A-Za-z]/.test(value))return {ok:false};
  const folded=value.toLowerCase().replace(/[013457]/g,c=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t'}[c]));
  if(moderation.some(word=>new RegExp(`\\b${[...word].join('[^a-z0-9]*')}\\b`,'i').test(folded)))return {ok:false};
  return {ok:true,value};
}
export function validateClue(raw, word, previous) {
  if (typeof raw !== 'string' || raw.length > 80 || forbiddenText(raw) || /[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/u.test(raw)) return { ok: false };
  const value = normalize(raw);
  if (!/^[a-z]{2,20}$/.test(value)) return { ok: false };
  const blocked = [word.answer, ...(word.aliases ?? []), ...(word.forbidden ?? []), ...(Array.isArray(previous)?previous:[previous])].filter(Boolean).map(normalize);
  if (blocked.includes(value) || moderation.includes(value)) return { ok: false };
  return { ok: true, value };
}
export function validatePack(words) {
  if (!Array.isArray(words) || words.length < 2) throw new Error('Word pack is empty');
  const ids = new Set(), categories = new Map(), answers = new Set();
  for (const w of words) {
    if (!/^[a-z]+$/.test(w.id) || ids.has(w.id) || !/^[A-Za-z ]+$/.test(w.category) || !/^[A-Za-z]+$/.test(w.answer) || !Array.isArray(w.forbidden)) throw new Error('Invalid word record');
    const answer = normalize(w.answer); if (answers.has(answer)) throw new Error('Duplicate canonical answer');
    answers.add(answer); ids.add(w.id);
    categories.set(w.category, (categories.get(w.category) ?? 0) + 1);
    if (w.forbidden.some(x => typeof x !== 'string' || !/^[a-z]+$/.test(x))) throw new Error('Invalid forbidden word');
  }
  if ([...categories.values()].some(n => n < 2)) throw new Error('Category needs multiple answers');
  return true;
}
