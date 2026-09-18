import {writeFileSync} from 'node:fs';
import {assemble} from './build-pure.mjs';
const {body}=assemble();
writeFileSync(new URL('../linen.html',import.meta.url),body.replace('<title>重建人物 R2 · 人体与训练场</title>','<title>人物亚麻裙 · 实时三维</title>'));
console.log('Built linen.html from the same human runtime. Open linen.html?linen=1 through the local server.');
