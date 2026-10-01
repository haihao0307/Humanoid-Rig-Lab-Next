import * as THREE from 'three';
/** Evaluate reversible lifting-Haar material bases; reconstructed textures exist only in memory. */
export function decodeMaterialField(field){
 const n=field.size,k=field.channels,a=Int32Array.from(field.c),tmp=new Int32Array(n*n*k);
 for(let size=2;size<=n;size*=2){const half=size/2;
  for(let y=0;y<half;y++)for(let x=0;x<size;x++)for(let ch=0;ch<k;ch++){const low=a[(y*n+x)*k+ch],d=a[((y+half)*n+x)*k+ch],first=low-Math.floor(d/2);tmp[((2*y)*n+x)*k+ch]=first;tmp[((2*y+1)*n+x)*k+ch]=first+d;}
  for(let y=0;y<size;y++)for(let x=0;x<half;x++)for(let ch=0;ch<k;ch++){const low=tmp[(y*n+x)*k+ch],d=tmp[(y*n+x+half)*k+ch],first=low-Math.floor(d/2);a[(y*n+2*x)*k+ch]=first;a[(y*n+2*x+1)*k+ch]=first+d;}
 }
 const rgba=new Uint8Array(n*n*4);for(let i=0;i<n*n;i++){for(let ch=0;ch<3;ch++)rgba[i*4+ch]=Math.min(255,Math.max(0,a[i*k+ch]));rgba[i*4+3]=255;}return rgba;
}
export function materialTextures(material){
 const result={};for(const key of ['basecolor','normal','roughness','metallic']){const f=material[key],texture=new THREE.DataTexture(decodeMaterialField(f),f.size,f.size,THREE.RGBAFormat);texture.colorSpace=key==='basecolor'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.flipY=true;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;result[key]=texture;}return result;
}
