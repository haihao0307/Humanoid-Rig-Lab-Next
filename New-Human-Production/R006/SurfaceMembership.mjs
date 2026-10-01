// Source material parts are observed surface domains, never inferred from a
// vertex's height. Coordinates are reflected once into R2's left-negative rig.
export const PART_MEMBERSHIP=Object.freeze({
  0:{mask:4,label:'torso'},3:{mask:1,label:'head'},21:{mask:2|4,label:'neck'},
  1:{mask:8|128,label:'right-shorts'},2:{mask:8|64,label:'left-shorts'},9:{mask:8,label:'waistband'},
  12:{mask:2|4|16,label:'left-shoulder'},14:{mask:2|4|32,label:'right-shoulder'},
  11:{mask:16,label:'left-upper-arm'},10:{mask:32,label:'right-upper-arm'},
  8:{mask:16,label:'left-forearm'},6:{mask:32,label:'right-forearm'},
  16:{mask:64,label:'left-thigh'},13:{mask:128,label:'right-thigh'},
  19:{mask:64,label:'left-shin'},4:{mask:128,label:'right-shin'},
  23:{mask:64,label:'left-knee'},22:{mask:128,label:'right-knee'},
  5:{mask:64|1024,label:'left-foot'},7:{mask:128|2048,label:'right-foot'},
  20:{mask:16|256,label:'left-hand'},17:{mask:16|256,label:'left-hand'},25:{mask:16|256,label:'left-hand'},
  26:{mask:16|256,label:'left-hand'},27:{mask:16|256,label:'left-hand'},30:{mask:16|256,label:'left-hand'},
  15:{mask:32|512,label:'right-hand'},18:{mask:32|512,label:'right-hand'},24:{mask:32|512,label:'right-hand'},
  28:{mask:32|512,label:'right-hand'},29:{mask:32|512,label:'right-hand'}
});
export function partMembership(name){const m=name.match(/(?:Mesh_|part_)(\d+)/);const row=m&&PART_MEMBERSHIP[Number(m[1])];if(!row)throw Error('Unreviewed source part: '+name);return row;}
export function regionColor(mask){
  if(mask&1)return [.75,.45,.85];if(mask&256)return [.15,.85,.65];if(mask&512)return [.1,.6,.85];
  if(mask&(1024|2048))return [.95,.7,.2];if(mask&16)return [.25,.7,.95];if(mask&32)return [.2,.4,.9];
  if(mask&64)return [.95,.5,.18];if(mask&128)return [.8,.3,.16];if(mask&8)return [.7,.65,.22];
  if(mask&2)return [.7,.4,.5];return [.4,.7,.4];
}
