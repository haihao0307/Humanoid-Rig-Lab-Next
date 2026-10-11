import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const dir=new URL('.',import.meta.url);for(const file of process.argv.includes('--public')?['browser.mjs']:['kernel.mjs','browser.mjs'])execFileSync(process.execPath,[fileURLToPath(new URL(file,dir)),...process.argv.slice(2)],{stdio:'inherit'});
