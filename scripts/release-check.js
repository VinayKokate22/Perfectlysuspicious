import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
function run(args,env=process.env) {
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env});
  if(result.status!==0) process.exit(result.status??1);
}
run(['--test',...(await readdir('tests')).filter(f=>f.endsWith('.test.js')).map(f=>`tests/${f}`)]);
run(['scripts/check.js']);
run(['scripts/build.js']);
run(['node_modules/@playwright/test/cli.js','test'],{...process.env,TEST_CLIENT_ROOT:'dist/0.1.0/client'});
console.log('Local candidate verified. External platform and device gates remain open.');
