/** Lossless, dependency-free coefficient decoder. The payload contains no mesh. */
export async function decodeCompactHuman(compressed){
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const raw=await new Response(stream).arrayBuffer(),bytes=new Uint8Array(raw),view=new DataView(raw);
  const magic=new TextDecoder().decode(bytes.subarray(0,8));if(!['CHFN0001','CHFN0002'].includes(magic))throw Error('Invalid curve parameter container');
  const headerSize=view.getUint32(8,true),count=view.getUint32(12,true);
  const header=JSON.parse(new TextDecoder().decode(bytes.subarray(16,16+headerSize)));
  if(header.schema!=='compact-human-functions/v1'||count!==header.arrays.length)throw Error('Wrong coefficient schema');
  let offset=16+headerSize;
  const arrays=header.arrays.map(({count:n,order,encoding='byte-planes',byteLength=4*n})=>{
    if(!Number.isSafeInteger(n)||n<0||![0,1,2].includes(order)||!Number.isSafeInteger(byteLength)||byteLength<0||offset+byteLength>bytes.length||!['byte-planes','zigzag-varint'].includes(encoding))throw Error('Invalid packed coefficient extent');
    if(encoding==='byte-planes'&&byteLength!==4*n)throw Error('Wrong byte-plane extent');
    const a=new Int32Array(n);let s=0,t=0;
    let cursor=offset;
    for(let i=0;i<n;i++){
      let x;
      if(encoding==='byte-planes')x=bytes[offset+i]|bytes[offset+n+i]<<8|bytes[offset+2*n+i]<<16|bytes[offset+3*n+i]<<24;
      else{let value=0,shift=0,b;
        do{if(cursor>=offset+byteLength||shift>28)throw Error('Invalid coefficient varint');b=bytes[cursor++];if(shift===28&&(b&240))throw Error('Coefficient varint overflow');value|=(b&127)<<shift;shift+=7;}while(b&128);
        x=(value>>>1)^-(value&1);
      }
      if(order){s+=x;x=s;}if(order===2){t+=x;x=t;}
      if(!Number.isSafeInteger(x)||x<-2147483648||x>2147483647)throw Error('Coefficient predictor overflow');
      a[i]=x;
    }
    if(encoding==='zigzag-varint'&&cursor!==offset+byteLength)throw Error('Trailing coefficient varints');offset+=byteLength;return a;
  });
  if(offset!==bytes.length)throw Error('Trailing or missing coefficient bytes');
  function restore(x){if(!x||typeof x!=='object')return x;
    if(Object.hasOwn(x,'$array')){if(!arrays[x.$array])throw Error('Missing coefficient array');return arrays[x.$array];}
    if(Array.isArray(x))return x.map(restore);for(const k of Object.keys(x))x[k]=restore(x[k]);return x;}
  return {name:header.name,data:restore(header.data),statistics:{compressedBytes:compressed.byteLength,
    decodedBytes:raw.byteLength,coefficientArrayBytes:arrays.reduce((n,a)=>n+a.byteLength,0),arrayCount:arrays.length}};
}
