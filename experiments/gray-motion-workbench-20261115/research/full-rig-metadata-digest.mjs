// Canonical metadata identity shared by the research manifest and reader.
export const canonicalMetadata=x=>Array.isArray(x)?x.map(canonicalMetadata):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonicalMetadata(x[k])])):x;
export async function metadataSHA256(value){const input=new TextEncoder().encode(JSON.stringify(canonicalMetadata(value)));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',input)),x=>x.toString(16).padStart(2,'0')).join('');}
