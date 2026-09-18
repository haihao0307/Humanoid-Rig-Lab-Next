import {writeFileSync} from 'node:fs';
import {assemble} from './build-pure.mjs';
const {body}=assemble();
writeFileSync(new URL('../shorts.html',import.meta.url),body.replace('<title>重建人物 R2 · 人体与训练场</title>','<title>布片短裤 · 人物试穿</title>').replace(/\r\n/g,'\n'));
console.log('Built shorts.html from the shared human runtime.');
