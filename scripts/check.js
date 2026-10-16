import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import { forbiddenText, validatePack } from '../core/validation.js';
import { WORDS } from '../server/content.js';
import assert from 'node:assert/strict';

const catalogue = [];
function copy(file, value) {
  const text = value.replace(/&(?:amp|lt|gt|quot|#39);/g,' ').trim();
  if (!text) return;
  assert.equal(forbiddenText(text), false, `Prohibited authored text in ${file}: ${text}`);
  catalogue.push({ file, text });
}
for (const dir of ['core','server','public','scripts']) for (const file of await readdir(dir)) {
  if (!file.endsWith('.js')) continue;
  const location = `${dir}/${file}`, source = await readFile(location,'utf8');
  if (dir === 'public' && ['three.module.js','three.core.js'].includes(file)) {
    assert.equal(source,await readFile(`node_modules/three/build/${file}`,'utf8'),'Vendored renderer must match the pinned dependency');
    continue;
  }
  execFileSync(process.execPath,['--check',location],{stdio:'pipe'});
  if (dir === 'scripts') continue;
  simple(parse(source,{ecmaVersion:'latest',sourceType:'module'}), {
    Literal(node) {
      // Authored prose literals. Lowercase selectors and protocol identifiers are code.
      if (typeof node.value === 'string' && /^[A-Z][A-Za-z ,.!?0-9]/.test(node.value) && !node.value.includes('<') && !node.value.includes('application/')) copy(location,node.value);
    },
    TemplateLiteral(node) {
      const template = node.quasis.map(n=>n.value.cooked).join('VALUE');
      if (!/<[a-z][\s>]/i.test(template)) return;
      copy(location,template.replace(/<[^>]*>/g,' '));
      for (const match of template.matchAll(/(?:aria-label|placeholder)="([^"]*)"/g)) copy(location,match[1]);
    }
  });
}
const html=await readFile('public/index.html','utf8');
copy('public/index.html',html.replace(/<[^>]*>/g,' '));
copy('release/SUBMISSION_COPY.md',(await readFile('release/SUBMISSION_COPY.md','utf8')).replace(/^#+ /gm,''));
for(const w of WORDS) { copy('server/content.js',w.answer); copy('server/content.js',w.category); }
validatePack(WORDS);
await mkdir('test-results',{recursive:true});
await writeFile('test-results/copy-catalogue.json',JSON.stringify(catalogue,null,2));
console.log(`Syntax and authored copy checks passed. ${catalogue.length} catalogue entries. Word pack valid.`);
