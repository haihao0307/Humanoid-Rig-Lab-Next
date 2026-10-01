import {readFileSync,writeFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {decodeParameters} from '../../R007/parameter-codec.mjs';import {generateSurface} from '../../R007/surface-generator.mjs';
const data=decodeParameters(gunzipSync(readFileSync(new URL('../../R007/parameters.phf.gz',import.meta.url))).buffer);
const s=generateSurface(data,{edgeMetres:.02});
writeFileSync(new URL('../qa/rig-samples.json',import.meta.url),JSON.stringify({positions:Array.from(s.positions),ids:Array.from(s.skinIndex),weights:Array.from(s.skinWeight)}));
delete data.charts;writeFileSync(new URL('../qa/rig-source.json',import.meta.url),JSON.stringify(data));
console.log(JSON.stringify(s.report));
