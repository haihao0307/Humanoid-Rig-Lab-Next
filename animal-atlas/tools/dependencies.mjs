import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export function esbuild(){try{return require('esbuild');}catch{return require('../../Crab-Static-R05/node_modules/esbuild');}}
export function playwright(){try{return require('playwright');}catch{return require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}}
