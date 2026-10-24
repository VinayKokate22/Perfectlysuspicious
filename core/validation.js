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

const chatWordFilters=new WeakMap();
const foldChat=value=>value.toLowerCase().replace(/[0134578]/g,c=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b'}[c]));
function oneTypo(a,b){
  if(a===b)return true;
  if(Math.abs(a.length-b.length)>1||a[0]!==b[0])return false;
  let i=0;while(i<Math.min(a.length,b.length)&&a[i]===b[i])i++;
  if(a.length===b.length)return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
  return a.length>b.length?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1);
}
// Replace matching spans before active-case chat is stored or sent in snapshots.
// Similarity uses the word pack's aliases/giveaways, inflections and conservative typos.
export function maskChatWords(value,word){
  if(!word)return value;
  let filter=chatWordFilters.get(word);
  if(!filter){
    const terms=[...new Set([word.answer,...(word.aliases??[]),...(word.forbidden??[])].map(normalize).map(term=>term.replace(/[^a-z]/g,'')).filter(Boolean))];
    const variants=new Set();
    for(const term of terms){
      for(const ending of ['', 's','es','ed','ing'])variants.add(term+ending);
      if(term.endsWith('y')){variants.add(term.slice(0,-1)+'ies');variants.add(term.slice(0,-1)+'ied');}
      if(term.endsWith('e')){variants.add(term+'d');variants.add(term.slice(0,-1)+'ing');}
    }
    // Match ordinary words as well as disguises such as c.o.f.f.e.e or c o f f e e.
    filter={variants,typos:terms.filter(term=>term.length>=5),patterns:[...variants].map(term=>new RegExp(`(?<![a-z0-9])${[...term].join("[ .,!?'()]*")}(?![a-z0-9])`,'g'))};
    chatWordFilters.set(word,filter);
  }
  const folded=foldChat(value),spans=[];
  for(const pattern of filter.patterns)for(const match of folded.matchAll(pattern))spans.push([match.index,match.index+match[0].length]);
  for(const match of folded.matchAll(/[a-z0-9]+(?:'[a-z]+)?/g)){
    const token=match[0].replace(/'s$/,'');
    if(filter.variants.has(token)||token.length>=4&&filter.typos.some(term=>oneTypo(token,term)))spans.push([match.index,match.index+match[0].length]);
  }
  const merged=[];
  for(const span of spans.sort((a,b)=>a[0]-b[0]||b[1]-a[1])){
    const last=merged.at(-1);
    if(last&&span[0]<last[1])last[1]=Math.max(last[1],span[1]);else merged.push([...span]);
  }
  let masked='',cursor=0;
  for(const [start,end] of merged){masked+=value.slice(cursor,start)+'****';cursor=end;}
  return masked+value.slice(cursor);
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
