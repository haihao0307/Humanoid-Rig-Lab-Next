/* Pixel-footprint integration, not temporal blur. No history, jitter or random visibility.
   Curves retain physical width; pixel widening is compensated by integrated opacity. */
(function(root){'use strict';
const smooth=(a,b,x)=>{let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function farWeight(pixelsPerYarn,bodyPixels,force=false){return force?0:(1-smooth(140,240,bodyPixels))*(1-smooth(.62,1.02,pixelsPerYarn));}
function gaussianCoverage(radius,pixelWidth){const sigma=.55*radius,filtered=Math.hypot(sigma,.43*pixelWidth);return {halfWidth:3*filtered,opacity:sigma/filtered};}
function destroy(gl,t){if(!t)return;for(const f of [t.draw,t.read])if(f)gl.deleteFramebuffer(f);for(const b of [t.colorBuffer,t.depth])if(b)gl.deleteRenderbuffer(b);if(t.color)gl.deleteTexture(t.color);}
function target(gl,w,h,hdr,old,requested=4){if(old&&old.w===w&&old.h===h&&old.hdr===hdr)return old;destroy(gl,old);
 const format=hdr?gl.RGBA16F:gl.RGBA8,depthFormat=gl.DEPTH_COMPONENT24;
 const cs=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,format,gl.SAMPLES)||[]),ds=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,depthFormat,gl.SAMPLES)||[]);
 // Bound multisample storage on very large displays. Report the actual selection.
 const cap=Math.min(requested,w*h>5000000?1:w*h>2500000?2:4),samples=Math.max(0,...cs.filter(n=>n<=cap&&ds.includes(n)));
 const t={w,h,hdr,samples,draw:gl.createFramebuffer(),read:gl.createFramebuffer(),color:gl.createTexture(),depth:gl.createRenderbuffer()};
 gl.bindTexture(gl.TEXTURE_2D,t.color);gl.texImage2D(gl.TEXTURE_2D,0,format,w,h,0,gl.RGBA,hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.bindFramebuffer(gl.FRAMEBUFFER,t.read);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.color,0);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Resolve framebuffer incomplete');
 gl.bindFramebuffer(gl.FRAMEBUFFER,t.draw);gl.bindRenderbuffer(gl.RENDERBUFFER,t.depth);
 if(samples>0){gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,depthFormat,w,h);t.colorBuffer=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,t.colorBuffer);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,format,w,h);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,t.colorBuffer);}
 else{gl.renderbufferStorage(gl.RENDERBUFFER,depthFormat,w,h);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.color,0);}
 gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,t.depth);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Multisample framebuffer incomplete');
 t.attachmentBytes=w*h*((samples||1)*((hdr?8:4)+4)+(samples?(hdr?8:4):0));return t;
}
function resolve(gl,t){if(!t.samples)return;gl.bindFramebuffer(gl.READ_FRAMEBUFFER,t.draw);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,t.read);gl.blitFramebuffer(0,0,t.w,t.h,0,0,t.w,t.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);}
const finalShader=`#version 300 es
precision highp float;uniform sampler2D im,farIm;uniform vec2 outputSize;uniform float exposure,farBlend;uniform int audit;in vec2 uv;out vec4 O;
vec3 integrated(vec2 p){vec3 c=texture(im,p).rgb;if(farBlend>0.)c=mix(c,texture(farIm,p).rgb,farBlend);return c;}
void main(){vec3 c=vec3(0);if(audit==1)c=texture(im,uv).rgb;else{
 // Integrate one output pixel in linear radiance, including fractional SS ratios.
 for(int y=0;y<4;y++)for(int x=0;x<4;x++)c+=integrated(uv+(vec2(x,y)+.5-2.)/(4.*outputSize));c/=16.;
 c*=exposure;c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);c=pow(clamp(c,0.,1.),vec3(1./2.2));}O=vec4(c,1);}`;
root.KAOPUDenimSampling={smooth,farWeight,gaussianCoverage,target,resolve,destroy,finalShader};if(typeof module!=='undefined')module.exports=root.KAOPUDenimSampling;
})(globalThis);
