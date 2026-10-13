import {pathToFileURL} from 'node:url';
export async function resolve(specifier,context,nextResolve){if(specifier==='three'){if(!process.env.THREE_PATH)throw Error('THREE_PATH is required');return {url:pathToFileURL(process.env.THREE_PATH).href,shortCircuit:true};}return nextResolve(specifier,context);}
