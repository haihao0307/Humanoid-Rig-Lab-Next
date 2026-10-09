/**
* MIT License
*
* Copyright (c) 2024 Mika Suominen
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/


// GENERATED. Renderer/audio/GLB/DOM deliberately excluded. See extract-upstream.cjs.
export const TALKINGHEAD_SOURCE={"repository":"met4citizen/TalkingHead","commit":"b3e277b3b46f88e557bf28a2c5612a5b04e075c3","version":"1.7.0","sourceSHA256":"2580bfb965f432e3c6eed0115417d5a2814f4ad0689e031a0977122b42817f6b","license":"MIT"};
export class TalkingHeadBehaviorKernel {
constructor(options={}) {
this.opt={avatarIdleEyeContact:.82,avatarIdleHeadMove:.35,avatarSpeakingEyeContact:.85,avatarSpeakingHeadMove:.3,...options};
this.avatar={body:'M',baseline:{}};this.stateName='idle';this.moodName='neutral';this.poseName='straight';this.viewName='head';this.animClock=0;this.isSpeaking=false;this.animQueue=[];this.mtAvatar={};this.morphs=[];
this.animTemplateEyes = { name: 'eyes',
      idle: { alt: [
        {
          p: () => ( this.avatar?.hasOwnProperty('avatarIdleEyeContact') ? this.avatar.avatarIdleEyeContact : this.opt.avatarIdleEyeContact ),
          delay: [200,5000], dt: [ 200,[2000,5000],[3000,10000,1,2] ],
          vs: {
            headMove: [ this.avatar?.hasOwnProperty('avatarIdleHeadMove') ? this.avatar.avatarIdleHeadMove : this.opt.avatarIdleHeadMove ],
            eyesRotateY: [[-0.6,0.6]], eyesRotateX: [[-0.2,0.6]],
            eyeContact: [null,1]
          }
        },
        {
          delay: [200,5000], dt: [ 200,[2000,5000,1,2] ], vs: {
            headMove: [ this.avatar?.hasOwnProperty('avatarIdleHeadMove') ? this.avatar.avatarIdleHeadMove : this.opt.avatarIdleHeadMove ],
            eyesRotateY: [[-0.6,0.6]], eyesRotateX: [[-0.2,0.6]]
          }
        }
      ]},
      speaking: { alt: [
        {
          p: () => ( this.avatar?.hasOwnProperty('avatarSpeakingEyeContact') ? this.avatar.avatarSpeakingEyeContact : this.opt.avatarSpeakingEyeContact ),
          delay: [200,5000], dt: [ 0, [3000,10000,1,2], [2000,5000] ],
          vs: { eyeContact: [1,null],
            headMove: [null,( this.avatar?.hasOwnProperty('avatarSpeakingHeadMove') ? this.avatar.avatarSpeakingHeadMove : this.opt.avatarSpeakingHeadMove ),null],
            eyesRotateY: [null,[-0.6,0.6]], eyesRotateX: [null,[-0.2,0.6]]
          }
        },
        {
          delay: [200,5000], dt: [ 200,[2000,5000,1,2] ], vs: {
            headMove: [( this.avatar?.hasOwnProperty('avatarSpeakingHeadMove') ? this.avatar.avatarSpeakingHeadMove : this.opt.avatarSpeakingHeadMove ),null],
            eyesRotateY: [[-0.6,0.6]], eyesRotateX: [[-0.2,0.6]]
          }
        }
      ]}
    };
this.animTemplateBlink = { name: 'blink', alt: [
      { p: 0.85, delay: [1000,8000,1,2], dt: [50,[100,300],100], vs: { eyeBlinkLeft: [1,1,0], eyeBlinkRight: [1,1,0] } },
      { delay: [1000,4000,1,2], dt: [50,[100,200],100,[10,400,0],50,[100,200],100], vs: { eyeBlinkLeft: [1,1,0,0,1,1,0], eyeBlinkRight: [1,1,0,0,1,1,0] } }
    ]};
this.animMoods = {
      'neutral' : {
        baseline: { eyesLookDown: 0.1 },
        speech: { deltaRate: 0, deltaPitch: 0, deltaVolume: 0 },
        anims: [
          { name: 'breathing', delay: 1500, dt: [ 1200,500,1000 ], vs: { chestInhale: [0.5,0.5,0] } },
          { name: 'pose', alt: [
            { p: 0.5, delay: [5000,30000], vs: { pose: ['side'] } },
            { p: 0.3, delay: [5000,30000], vs: { pose: ['hip'] },
              'M': { delay: [5000,30000], vs: { pose: ['wide'] } }
            },
            { delay: [5000,30000], vs: { pose: ['straight'] } }
          ]},
          { name: 'head',
            idle: { delay: [0,1000], dt: [ [200,5000] ], vs: { bodyRotateX: [[-0.04,0.10]], bodyRotateY: [[-0.3,0.3]], bodyRotateZ: [[-0.08,0.08]] } },
            speaking: { dt: [ [0,1000,0] ], vs: { bodyRotateX: [[-0.05,0.15,1,2]], bodyRotateY: [[-0.1,0.1]], bodyRotateZ: [[-0.1,0.1]] } }
          },
          this.animTemplateEyes,
          this.animTemplateBlink,
          { name: 'mouth', delay: [1000,5000], dt: [ [100,500],[100,5000,2] ], vs : { mouthRollLower: [[0,0.3,2]], mouthRollUpper: [[0,0.3,2]], mouthStretchLeft: [[0,0.3]], mouthStretchRight: [[0,0.3]], mouthPucker: [[0,0.3]] } },
          { name: 'misc', delay: [100,5000], dt: [ [100,500],[1000,5000,2] ], vs : { eyeSquintLeft: [[0,0.3,2]], eyeSquintRight: [[0,0.3,2]], browInnerUp: [[0,0.3,2]], browOuterUpLeft: [[0,0.3,2]], browOuterUpRight: [[0,0.3,2]] } }
        ]
      },
      'happy' : {
        baseline: { mouthSmile: 0.2, eyesLookDown: 0.1 },
        speech: { deltaRate: 0, deltaPitch: 0.1, deltaVolume: 0 },
        anims: [
          { name: 'breathing', delay: 1500, dt: [ 1200,500,1000 ], vs: { chestInhale: [0.5,0.5,0] } },
          { name: 'pose',
            idle: {
              alt: [
                { p: 0.6, delay: [5000,30000], vs: { pose: ['side'] } },
                { p: 0.2, delay: [5000,30000], vs: { pose: ['hip'] },
                  'M': { delay: [5000,30000], vs: { pose: ['side'] } }
                },
                { p: 0.1, delay: [5000,30000], vs: { pose: ['straight'] } },
                { delay: [5000,10000], vs: { pose: ['wide'] } },
                { delay: [1000,3000], vs: { pose: ['turn'] } },
              ]
            },
            speaking: {
              alt: [
                { p: 0.4, delay: [5000,30000], vs: { pose: ['side'] } },
                { p: 0.4, delay: [5000,30000], vs: { pose: ['straight'] } },
                { delay: [5000,20000], vs: { pose: ['hip'] },
                  'M': { delay: [5000,30000], vs: { pose: ['wide'] } }
                },
              ]
            }
          },
          { name: 'head',
            idle: { dt: [ [1000,5000] ], vs: { bodyRotateX: [[-0.04,0.10]], bodyRotateY: [[-0.3,0.3]], bodyRotateZ: [[-0.08,0.08]] } },
            speaking: { dt: [ [0,1000,0] ], vs: { bodyRotateX: [[-0.05,0.15,1,2]], bodyRotateY: [[-0.1,0.1]], bodyRotateZ: [[-0.1,0.1]] } }
          },
          this.animTemplateEyes,
          this.animTemplateBlink,
          { name: 'mouth', delay: [1000,5000], dt: [ [100,500],[100,5000,2] ], vs : { mouthLeft: [[0,0.3,2]], mouthSmile: [[0,0.2,3]], mouthRollLower: [[0,0.3,2]], mouthRollUpper: [[0,0.3,2]], mouthStretchLeft: [[0,0.3]], mouthStretchRight: [[0,0.3]], mouthPucker: [[0,0.3]] } },
          { name: 'misc', delay: [100,5000], dt: [ [100,500],[1000,5000,2] ], vs : { eyeSquintLeft: [[0,0.3,2]], eyeSquintRight: [[0,0.3,2]], browInnerUp: [[0,0.3,2]], browOuterUpLeft: [[0,0.3,2]], browOuterUpRight: [[0,0.3,2]] } }
        ]
      },
      'angry' : {
        baseline: { eyesLookDown: 0.1, browDownLeft: 0.6, browDownRight: 0.6, jawForward: 0.3, mouthFrownLeft: 0.7, mouthFrownRight: 0.7, mouthRollLower: 0.2, mouthShrugLower: 0.3, handFistLeft: 1, handFistRight: 1 },
        speech: { deltaRate: -0.2, deltaPitch: 0.2, deltaVolume: 0 },
        anims: [
          { name: 'breathing', delay: 500, dt: [ 1000,500,1000 ], vs: { chestInhale: [0.7,0.7,0] } },
          { name: 'pose', alt: [
            { p: 0.4, delay: [5000,30000], vs: { pose: ['side'] } },
            { p: 0.4, delay: [5000,30000], vs: { pose: ['straight'] } },
            { p: 0.2, delay: [5000,30000], vs: { pose: ['hip'] },
              'M': { delay: [5000,30000], vs: { pose: ['wide'] } }
            },
          ]},
          { name: 'head',
            idle: { delay: [100,500], dt: [ [200,5000] ], vs: { bodyRotateX: [[-0.04,0.10]], bodyRotateY: [[-0.2,0.2]], bodyRotateZ: [[-0.08,0.08]] } },
            speaking: { dt: [ [0,1000,0] ], vs: { bodyRotateX: [[-0.05,0.15,1,2]], bodyRotateY: [[-0.1,0.1]], bodyRotateZ: [[-0.1,0.1]] } }
          },
          this.animTemplateEyes,
          this.animTemplateBlink,
          { name: 'mouth', delay: [1000,5000], dt: [ [100,500],[100,5000,2] ], vs : { mouthRollLower: [[0,0.3,2]], mouthRollUpper: [[0,0.3,2]], mouthStretchLeft: [[0,0.3]], mouthStretchRight: [[0,0.3]], mouthPucker: [[0,0.3]] } },
          { name: 'misc', delay: [100,5000], dt: [ [100,500],[1000,5000,2] ], vs : { eyeSquintLeft: [[0,0.3,2]], eyeSquintRight: [[0,0.3,2]], browInnerUp: [[0,0.3,2]], browOuterUpLeft: [[0,0.3,2]], browOuterUpRight: [[0,0.3,2]] } }
        ]
      },
      'sad' : {
        baseline: { eyesLookDown: 0.2, browDownRight: 0.1, browInnerUp: 0.6, browOuterUpRight: 0.2, eyeSquintLeft: 0.7, eyeSquintRight: 0.7, mouthFrownLeft: 0.8, mouthFrownRight: 0.8, mouthLeft: 0.2, mouthPucker: 0.5, mouthRollLower: 0.2, mouthRollUpper: 0.2, mouthShrugLower: 0.2, mouthShrugUpper: 0.2, mouthStretchLeft: 0.4 },
        speech: { deltaRate: -0.2, deltaPitch: -0.2, deltaVolume: 0 },
        anims: [
          { name: 'breathing', delay: 1500, dt: [ 1000,500,1000 ], vs: { chestInhale: [0.3,0.3,0] } },
          { name: 'pose', alt: [
            { p: 0.4, delay: [5000,30000], vs: { pose: ['side'] } },
            { p: 0.4, delay: [5000,30000], vs: { pose: ['straight'] } },
            { delay: [5000,20000], vs: { pose: ['side'] },
              full: { delay: [5000,20000], vs: { pose: ['oneknee'] } }
            },
          ]},
          { name: 'head',
            idle: { delay: [100,500], dt: [ [200,5000] ], vs: { bodyRotateX: [[-0.04,0.10]], bodyRotateY: [[-0.2,0.2]], bodyRotateZ: [[-0.08,0.08]] } },
            speaking: { dt: [ [0,1000,0] ], vs: { bodyRotateX: [[-0.05,0.15,1,2]], bodyRotateY: [[-0.1,0.1]], bodyRotateZ: [[-0.1,0.1]] } }
          },
          this.animTemplateEyes,
          this.animTemplateBlink,
          { name: 'mouth', delay: [1000,5000], dt: [ [100,500],[100,5000,2] ], vs : { mouthRollLower: [[0,0.3,2]], mouthRollUpper: [[0,0.3,2]], mouthStretchLeft: [[0,0.3]], mouthStretchRight: [[0,0.3]], mouthPucker: [[0,0.3]] } },
          { name: 'misc', delay: [100,5000], dt: [ [100,500],[1000,5000,2] ], vs : { eyeSquintLeft: [[0,0.3,2]], eyeSquintRight: [[0,0.3,2]], browInnerUp: [[0,0.3,2]], browOuterUpLeft: [[0,0.3,2]], browOuterUpRight: [[0,0.3,2]] } }
        ]
      },
      'fear' : {
        baseline: { browInnerUp: 0.7, eyeSquintLeft: 0.5, eyeSquintRight: 0.5, eyeWideLeft: 0.6, eyeWideRight: 0.6, mouthClose: 0.1, mouthFunnel: 0.3, mouthShrugLower: 0.5, mouthShrugUpper: 0.5 },
        speech: { deltaRate: -0.2, deltaPitch: 0, deltaVolume: 0 },
        anims: [
          { name: 'breathing', delay: 500, dt: [ 1000,500,1000 ], vs: { chestInhale: [0.7,0.7,0] } },
          { name: 'pose', alt: [
            { p: 0.8, delay: [5000,30000], vs: { pose: ['side'] } },
            { delay: [5000,30000], vs: { pose: ['straight'] } },
            { delay: [5000,20000], vs: { pose: ['wide'] } },
            { delay: [5000,20000], vs: { pose: ['side'] },
              full: { delay: [5000,20000], vs: { pose: ['oneknee'] } }
            },
          ]},
          { name: 'head',
            idle: { delay: [100,500], dt: [ [200,3000] ], vs: { bodyRotateX: [[-0.06,0.12]], bodyRotateY: [[-0.7,0.7]], bodyRotateZ: [[-0.1,0.1]] } },
            speaking: { dt: [ [0,1000,0] ], vs: { bodyRotateX: [[-0.05,0.15,1,2]], bodyRotateY: [[-0.1,0.1]], bodyRotateZ: [[-0.1,0.1]] } }
          },
          this.animTemplateEyes,
          this.animTemplateBlink,
          { name: 'mouth', delay: [1000,5000], dt: [ [100,500],[100,5000,2] ], vs : { mouthRollLower: [[0,0.3,2]], mouthRollUpper: [[0,0.3,2]], mouthStretchLeft: [[0,0.3]], mouthStretchRight: [[0,0.3]], mouthPucker: [[0,0.3]] } },
          { name: 'misc', delay: [100,5000], dt: [ [100,500],[1000,5000,2] ], vs : { eyeSquintLeft: [[0,0.3,2]], eyeSquintRight: [[0,0.3,2]], browInnerUp: [[0,0.3,2]], browOuterUpLeft: [[0,0.3,2]], browOuterUpRight: [[0,0.3,2]] } }
        ]
      },
      'disgust' : {
        baseline: { browDownLeft: 0.7, browDownRight: 0.1, browInnerUp: 0.3, eyeSquintLeft: 1, eyeSquintRight: 1, eyeWideLeft: 0.5, eyeWideRight: 0.5, eyesRotateX: 0.05, mouthLeft: 0.4, mouthPressLeft: 0.3, mouthRollLower: 0.3, mouthShrugLower: 0.3, mouthShrugUpper: 0.8, mouthUpperUpLeft: 0.3, noseSneerLeft: 1, noseSneerRight: 0.7 },
        speech: { deltaRate: -0.2, deltaPitch: 0, deltaVolume: 0 },
        anims: [
          { name: 'breathing', delay: 1500, dt: [ 1000,500,1000 ], vs: { chestInhale: [0.5,0.5,0] } },
          { name: 'pose', alt: [
            { delay: [5000,20000], vs: { pose: ['side'] } },
          ]},
          { name: 'head',
            idle: { delay: [100,500], dt: [ [200,5000] ], vs: { bodyRotateX: [[-0.04,0.10]], bodyRotateY: [[-0.2,0.2]], bodyRotateZ: [[-0.08,0.08]] } },
            speaking: { dt: [ [0,1000,0] ], vs: { bodyRotateX: [[-0.05,0.15,1,2]], bodyRotateY: [[-0.1,0.1]], bodyRotateZ: [[-0.1,0.1]] } }
          },
          this.animTemplateEyes,
          this.animTemplateBlink,
          { name: 'mouth', delay: [1000,5000], dt: [ [100,500],[100,5000,2] ], vs : { mouthRollLower: [[0,0.3,2]], mouthRollUpper: [[0,0.3,2]], mouthStretchLeft: [[0,0.3]], mouthStretchRight: [[0,0.3]], mouthPucker: [[0,0.3]] } },
          { name: 'misc', delay: [100,5000], dt: [ [100,500],[1000,5000,2] ], vs : { eyeSquintLeft: [[0,0.3,2]], eyeSquintRight: [[0,0.3,2]], browInnerUp: [[0,0.3,2]], browOuterUpLeft: [[0,0.3,2]], browOuterUpRight: [[0,0.3,2]] } }
        ]
      },
      'love' : {
        baseline: { browInnerUp: 0.4, browOuterUpLeft: 0.2, browOuterUpRight: 0.2, mouthSmile: 0.2, eyeBlinkLeft: 0.6, eyeBlinkRight: 0.6, eyeWideLeft: 0.7, eyeWideRight: 0.7, bodyRotateX: 0.1, mouthDimpleLeft: 0.1, mouthDimpleRight: 0.1, mouthPressLeft: 0.2, mouthShrugUpper: 0.2, mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.1 },
        speech: { deltaRate: -0.1, deltaPitch: -0.7, deltaVolume: 0 },
        anims: [
          { name: 'breathing', delay: 1500, dt: [ 1500,500,1500 ], vs: { chestInhale: [0.8,0.8,0] } },
          { name: 'pose', alt: [
            { p: 0.4, delay: [5000,30000], vs: { pose: ['side'] } },
            { p: 0.2, delay: [5000,30000], vs: { pose: ['straight'] } },
            { p: 0.2, delay: [5000,30000], vs: { pose: ['hip'] },
              'M': { delay: [5000,30000], vs: { pose: ['side'] } }
            },
            { delay: [5000,10000], vs: { pose: ['side'] },
              full: { delay: [5000,10000], vs: { pose: ['kneel'] } }
            },
            { delay: [1000,3000], vs: { pose: ['turn'] },
              'M': { delay: [1000,3000], vs: { pose: ['wide'] } }
            },
            { delay: [1000,3000], vs: { pose: ['back'] },
              'M': { delay: [1000,3000], vs: { pose: ['wide'] } }
            },
            { delay: [5000,20000], vs: { pose: ['side'] },
              'M': { delay: [5000,20000], vs: { pose: ['side'] } },
              full: { delay: [5000,20000], vs: { pose: ['bend'] } }
            },
            { delay: [1000,3000], vs: { pose: ['side'] },
              full: { delay: [5000,10000], vs: { pose: ['oneknee'] } }
            },
          ]},
          { name: 'head',
            idle: { dt: [ [1000,5000] ], vs: { bodyRotateX: [[-0.04,0.10]], bodyRotateY: [[-0.3,0.3]], bodyRotateZ: [[-0.08,0.08]] } },
            speaking: { dt: [ [0,1000,0] ], vs: { bodyRotateX: [[-0.05,0.15,1,2]], bodyRotateY: [[-0.1,0.1]], bodyRotateZ: [[-0.1,0.1]] } }
          },
          this.animTemplateEyes,
          this.deepCopy(this.animTemplateBlink,(o) => { o.alt[0].delay[0] = o.alt[1].delay[0] = 2000; }),
          { name: 'mouth', delay: [1000,5000], dt: [ [100,500],[100,5000,2] ], vs : { mouthLeft: [[0,0.3,2]], mouthRollLower: [[0,0.3,2]], mouthRollUpper: [[0,0.3,2]], mouthStretchLeft: [[0,0.3]], mouthStretchRight: [[0,0.3]], mouthPucker: [[0,0.3]] } },
          { name: 'misc', delay: [100,5000], dt: [ [500,1000],[1000,5000,2] ], vs : { eyeSquintLeft: [[0,0.3,2]], eyeSquintRight: [[0,0.3,2]], browInnerUp: [[0.3,0.6,2]], browOuterUpLeft: [[0.1,0.3,2]], browOuterUpRight: [[0.1,0.3,2]] } }
        ]
      },
      'sleep' : {
        baseline: { eyeBlinkLeft: 1, eyeBlinkRight: 1, eyesClosed: 0.6 },
        speech: { deltaRate: 0, deltaPitch: -0.2, deltaVolume: 0 },
        anims: [
          { name: 'breathing', delay: 1500, dt: [ 1000,500,1000 ], vs: { chestInhale: [0.6,0.6,0] } },
          { name: 'pose', alt: [
            { delay: [5000,20000], vs: { pose: ['side'] } }
          ]},
          { name: 'head', delay: [1000,5000], dt: [ [2000,10000] ], vs: { bodyRotateX: [[0,0.4]], bodyRotateY: [[-0.1,0.1]], bodyRotateZ: [[-0.04,0.04]] } },
          { name: 'eyes', delay: 10010, dt: [], vs: {} },
          { name: 'blink', delay: 10020, dt: [], vs: {} },
          { name: 'mouth', delay: 10030, dt: [], vs: {} },
          { name: 'misc', delay: 10040, dt: [], vs: {} }
        ]
      }
    };
this.mtEasingDefault = this.sigmoidFactory(5);
this.mtAccDefault = 0.01;
this.mtAccExceptions = {
      eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, eyeLookOutLeft: 0.1,
      eyeLookInLeft: 0.1, eyeLookOutRight: 0.1, eyeLookInRight: 0.1
    };
this.mtMaxVDefault = 5;
this.mtMaxVExceptions = {
      bodyRotateX: 1, bodyRotateY: 1, bodyRotateZ: 1,
      // headRotateX: 1, headRotateY: 1, headRotateZ: 1
    };
this.mtBaselineDefault = 0;
this.mtBaselineExceptions = {
      bodyRotateX: null, bodyRotateY: null, bodyRotateZ: null,
      eyeLookOutLeft: null, eyeLookInLeft: null, eyeLookOutRight: null,
      eyeLookInRight: null, eyesLookDown: null, eyesLookUp: null
    };
this.mtMinDefault = 0;
this.mtMinExceptions = {
      bodyRotateX: -1, bodyRotateY: -1, bodyRotateZ: -1,
      headRotateX: -1, headRotateY: -1, headRotateZ: -1
    };
this.mtMaxDefault = 1;
this.mtMaxExceptions = {};
this.mtLimits = {
      eyeBlinkLeft: (v) => ( Math.max(v, (this.avatar?.baseline?.hasOwnProperty("eyeBlinkLeft") ? this.avatar.baseline.eyeBlinkLeft : 1) * ( this.mtAvatar['eyesLookDown'].value + this.mtAvatar['browDownLeft'].value ) / 2) - this.mtAvatar['eyesClosed'].applied ),
      eyeBlinkRight: (v) => ( Math.max(v, (this.avatar?.baseline?.hasOwnProperty("eyeBlinkRight") ? this.avatar.baseline.eyeBlinkRight : 1) * ( this.mtAvatar['eyesLookDown'].value + this.mtAvatar['browDownRight'].value ) / 2 ) - this.mtAvatar['eyesClosed'].applied )
    };
this.mtOnchange = {
      eyesLookDown: () => {
        this.mtAvatar['eyeBlinkLeft'].needsUpdate = true;
        this.mtAvatar['eyeBlinkRight'].needsUpdate = true;
      },
      browDownLeft: () => { this.mtAvatar['eyeBlinkLeft'].needsUpdate = true; },
      browDownRight: () => { this.mtAvatar['eyeBlinkRight'].needsUpdate = true; }
    };
this.gestureTemplates={'yes': { dt: [[200,500],[200,500],[200,500],[200,500]], vs:{ headMove: [0], headRotateX: [[0.1,0.2],0.1,[0.1,0.2],0], headRotateZ: [[-0.2,0.2]] } },
'no': { dt: [[200,500],[200,500],[200,500],[200,500],[200,500]], vs:{ headMove: [0], headRotateY: [[-0.1,-0.05],[0.05,0.1],[-0.1,-0.05],[0.05,0.1],0], headRotateZ: [[-0.2,0.2]] } }};
// Allowlist prevents full-body pose, speech, and arbitrary task execution.
for(const mood of Object.values(this.animMoods))mood.anims=mood.anims.filter(a=>['eyes','blink','head','misc'].includes(a.name));
this.poseDelta={props:{}};for(const key of ['Head','Spine1','Spine','Hips','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg'])this.poseDelta.props[key+'.quaternion']={x:0,y:0,z:0};
const keys=new Set(["bodyRotateX","bodyRotateY","bodyRotateZ","headRotateX","headRotateY","headRotateZ","eyeBlinkLeft","eyeBlinkRight","eyesClosed","eyesLookDown","eyesLookUp","eyeLookOutLeft","eyeLookInLeft","eyeLookOutRight","eyeLookInRight","eyeSquintLeft","eyeSquintRight","eyeWideLeft","eyeWideRight","browDownLeft","browDownRight","browInnerUp","browOuterUpLeft","browOuterUpRight"]);
    const mtTemp = {};
    keys.forEach( x => {

      // Morph target data structure
      mtTemp[x] = {
        fixed: null, realtime: null, system: null, systemd: null, newvalue: null, ref: null,
        min: (this.mtMinExceptions.hasOwnProperty(x) ? this.mtMinExceptions[x] : this.mtMinDefault),
        max: (this.mtMaxExceptions.hasOwnProperty(x) ? this.mtMaxExceptions[x] : this.mtMaxDefault),
        easing: this.mtEasingDefault, base: null, v: 0, needsUpdate: true,
        acc: (this.mtAccExceptions.hasOwnProperty(x) ? this.mtAccExceptions[x] : this.mtAccDefault) / 1000,
        maxv: (this.mtMaxVExceptions.hasOwnProperty(x) ? this.mtMaxVExceptions[x] : this.mtMaxVDefault) / 1000,
        limit: this.mtLimits.hasOwnProperty(x) ? this.mtLimits[x] : null,
        onchange: this.mtOnchange.hasOwnProperty(x) ? this.mtOnchange[x] : null,
        baseline: (this.avatar.baseline?.hasOwnProperty(x) && !x.startsWith("head") && !x.startsWith("body") && !x.startsWith("eyeBlink")) ? this.avatar.baseline[x] : (this.mtBaselineExceptions.hasOwnProperty(x) ? this.mtBaselineExceptions[x] : this.mtBaselineDefault ),
        ms: [], is: []
      };
      mtTemp[x].value = mtTemp[x].baseline;
      mtTemp[x].applied = mtTemp[x].baseline;

      // Copy previous values
      const y = this.mtAvatar[x];
      if ( y ) {
        [ 'fixed','system','systemd','realtime','base','v','value','applied' ].forEach( z => {
          mtTemp[x][z] = y[z];
        });
      }

      // Find relevant meshes
      this.morphs.forEach( y => {
        const ndx = y.morphTargetDictionary[x];
        if ( ndx !== undefined ) {
          mtTemp[x].ms.push(y.morphTargetInfluences);
          mtTemp[x].is.push(ndx);
          y.morphTargetInfluences[ndx] = mtTemp[x].applied;
        }
      });

    });
    this.mtAvatar = mtTemp;
for(const o of Object.values(this.mtAvatar)){o.value=o.value??0;o.applied=o.applied??0;}
this.setMood('neutral');this.steps=0;this.lastSignals={};}
deepCopy(x, editFn=null) {
    const o = JSON.parse(JSON.stringify(x));
    if ( editFn && typeof editFn === "function" ) editFn(o);
    return o;
  }
valueFn(x) {
    return (typeof x === 'function' ? x() : x);
  }
getValue(mt) {
    return this.mtAvatar[mt]?.value;
  }
setValue(mt,val,ms=null) {
    if ( this.mtAvatar.hasOwnProperty(mt) ) {
      Object.assign(this.mtAvatar[mt],{ system: val, systemd: ms, needsUpdate: true });
    }
  }
getBaselineValue( mt ) {
    if ( mt === 'eyesRotateY' ) {
      const ll = this.getBaselineValue('eyeLookOutLeft');
      if ( ll === undefined ) return undefined;
      const lr = this.getBaselineValue('eyeLookInLeft');
      if ( lr === undefined ) return undefined;
      const rl = this.getBaselineValue('eyeLookOutRight');
      if ( rl === undefined ) return undefined;
      const rr = this.getBaselineValue('eyeLookInRight');
      if ( rr === undefined ) return undefined;
      return ll - lr;
    } else if ( mt === 'eyesRotateX' ) {
      const d = this.getBaselineValue('eyesLookDown');
      if ( d === undefined ) return undefined;
      const u = this.getBaselineValue('eyesLookUp');
      if ( u === undefined ) return undefined;
      return d - u;
    } else {
      return this.mtAvatar[mt]?.baseline;
    }
  }
setBaselineValue( mt, val ) {
    if ( mt === 'eyesRotateY' ) {
      this.setBaselineValue('eyeLookOutLeft', (val === null) ? null : (val>0 ? val : 0) );
      this.setBaselineValue('eyeLookInLeft', (val === null) ? null : (val>0 ? 0 : -val) );
      this.setBaselineValue('eyeLookOutRight', (val === null) ? null : (val>0 ? 0 : -val) );
      this.setBaselineValue('eyeLookInRight', (val === null) ? null : (val>0 ? val : 0) );
    } else if ( mt === 'eyesRotateX' ) {
      this.setBaselineValue('eyesLookDown', (val === null) ? null : (val>0 ? val : 0) );
      this.setBaselineValue('eyesLookUp', (val === null) ? null : (val>0 ? 0 : -val) );
    } else {
      if ( this.mtAvatar.hasOwnProperty(mt) ) {
        Object.assign(this.mtAvatar[mt],{ base: null, baseline: val, needsUpdate: true });
      }
    }
  }
getFixedValue( mt ) {
    if ( mt === 'eyesRotateY' ) {
      const ll = this.getFixedValue('eyeLookOutLeft');
      if ( ll === null ) return null;
      const lr = this.getFixedValue('eyeLookInLeft');
      if ( lr === null ) return null;
      const rl = this.getFixedValue('eyeLookOutRight');
      if ( rl === null ) return null;
      const rr = this.getFixedValue('eyeLookInRight');
      if ( rr === null ) return null;
      return ll - lr;
    } else if ( mt === 'eyesRotateX' ) {
      const d = this.getFixedValue('eyesLookDown');
      if ( d === null ) return null;
      const u = this.getFixedValue('eyesLookUp');
      if ( u === null ) return null;
      return d - u;
    } else {
      return this.mtAvatar[mt]?.fixed;
    }
  }
setFixedValue( mt, val, ms=null ) {
    if ( mt === 'eyesRotateY' ) {
      this.setFixedValue('eyeLookOutLeft', (val === null) ? null : (val>0 ? val : 0 ), ms );
      this.setFixedValue('eyeLookInLeft', (val === null) ? null : (val>0 ? 0 : -val ), ms );
      this.setFixedValue('eyeLookOutRight', (val === null) ? null : (val>0 ? 0 : -val ), ms );
      this.setFixedValue('eyeLookInRight', (val === null) ? null : (val>0 ? val : 0 ), ms );
    } else if ( mt === 'eyesRotateX' ) {
      this.setFixedValue('eyesLookDown', (val === null) ? null : (val>0 ? val : 0 ), ms );
      this.setFixedValue('eyesLookUp', (val === null) ? null : (val>0 ? 0 : -val ), ms );
    } else {
      if ( this.mtAvatar.hasOwnProperty(mt) ) {
        Object.assign(this.mtAvatar[mt],{ fixed: val, needsUpdate: true });
      }
    }
  }
setMood(s) {
    s = (s || '').trim().toLowerCase();
    if ( !this.animMoods.hasOwnProperty(s) ) throw new Error("Unknown mood.");
    this.moodName = s;
    this.mood = this.animMoods[this.moodName];

    // Reset morph target baseline
    for( let mt of Object.keys(this.mtAvatar) ) {
      let val = this.mtBaselineExceptions.hasOwnProperty(mt) ? this.mtBaselineExceptions[mt] : this.mtBaselineDefault;
      if ( this.mood.baseline.hasOwnProperty(mt) ) {
        val = this.mood.baseline[mt];
      } else if ( this.avatar.baseline?.hasOwnProperty(mt) ) {
        val = this.avatar.baseline[mt];
      }
      this.setBaselineValue( mt, val );
    }

    // Set/replace animations
    this.mood.anims.forEach( x => {
      let i = this.animQueue.findIndex( y => y.template.name === x.name );
      if ( i !== -1 ) {
        this.animQueue.splice(i, 1);
      }
      this.animQueue.push( this.animFactory( x, -1 ) );
    });

  }
animFactory( t, loop = false, scaleTime = 1, scaleValue = 1, noClockOffset = false ) {
    const o = { template: t, ts: [0], vs: {} };

    // Follow the hierarchy of objects
    let a = t;
    while(1) {
      if ( a.hasOwnProperty(this.stateName) ) {
        a = a[this.stateName];
      } else if ( a.hasOwnProperty(this.moodName) ) {
        a = a[this.moodName];
      } else if ( a.hasOwnProperty(this.poseName) ) {
        a = a[this.poseName];
      } else if ( a.hasOwnProperty(this.viewName) ) {
        a = a[this.viewName];
      } else if ( this.avatar.body && a.hasOwnProperty(this.avatar.body) ) {
        a = a[this.avatar.body];
      } else if ( a.hasOwnProperty('alt') ) {

        // Go through alternatives with probabilities
        let b = a.alt[0];
        if ( a.alt.length > 1 ) {
         // Flip a coin
         const coin = Math.random();
         let p = 0;
         for( let i=0; i<a.alt.length; i++ ) {
           let val = this.valueFn(a.alt[i].p);
           p += (val === undefined ? (1-p)/(a.alt.length-1-i) : val);
           if (coin<p) {
             b = a.alt[i];
             break;
           }
         }
        }
        a = b;

      } else {
        break;
      }
    }

    // Time series
    let delay = this.valueFn(a.delay) || 0;
    if ( Array.isArray(delay) ) {
      delay = this.gaussianRandom(...delay);
    }
    if ( a.hasOwnProperty('dt') ) {
      a.dt.forEach( (x,i) => {
        let val = this.valueFn(x);
        if ( Array.isArray(val) ) {
          val = this.gaussianRandom(...val);
        }
        o.ts[i+1] = o.ts[i] + val;
      });
    } else {
      let l = Object.values(a.vs).reduce( (acc,val) => (val.length > acc) ? val.length : acc, 0);
      o.ts = Array(l+1).fill(0);
    }
    if ( noClockOffset ) {
      o.ts = o.ts.map( x => delay + x * scaleTime );
    } else {
      o.ts = o.ts.map( x => this.animClock + delay + x * scaleTime );
    }

    // Values
    for( let [mt,vs] of Object.entries(a.vs) ) {
      const base = this.getBaselineValue(mt);
      const vals = vs.map( x => {
        x = this.valueFn(x);
        if ( x === null ) {
          return null;
        } else if ( typeof x === 'function' ) {
          return x;
        } else if ( typeof x === 'string' || x instanceof String ) {
          return x.slice();
        } else if ( Array.isArray(x) ) {
          if ( mt === 'gesture' ) {
            return x.slice();
          } else {
            return (base === undefined ? 0 : base) + scaleValue * this.gaussianRandom(...x);
          }
        } else if (typeof x == "boolean") {
          return x;
        } else if ( x instanceof Object && x.constructor === Object ) {
          return Object.assign( {}, x );
        } else {
          return (base === undefined ? 0 : base) + scaleValue * x;
        }
      });

      if ( mt === 'eyesRotateY' ) {
        o.vs['eyeLookOutLeft'] = [null, ...vals.map( x => (x>0) ? x : 0 ) ];
        o.vs['eyeLookInLeft'] = [null, ...vals.map( x => (x>0) ? 0 : -x ) ];
        o.vs['eyeLookOutRight'] = [null, ...vals.map( x => (x>0) ? 0 : -x ) ];
        o.vs['eyeLookInRight'] = [null, ...vals.map( x => (x>0) ? x : 0 ) ];
      } else if ( mt === 'eyesRotateX' ) {
        o.vs['eyesLookDown'] = [null, ...vals.map( x => (x>0) ? x : 0 ) ];
        o.vs['eyesLookUp'] = [null, ...vals.map( x => (x>0) ? 0 : -x ) ];
      } else {
        o.vs[mt] = [null, ...vals];
      }
    }
    for( let mt of Object.keys(o.vs) ) {
      while( o.vs[mt].length <= o.ts.length ) o.vs[mt].push( o.vs[mt][ o.vs[mt].length - 1 ]);
    }

    // Mood
    if ( t.hasOwnProperty("mood") ) o.mood = this.valueFn(t.mood).slice();

    // Loop
    if ( loop ) o.loop = loop;

    return o;
  }
valueAnimationSeq(vstart,vend,tstart,tend,t,fun=null) {
    vstart = this.valueFn(vstart);
    vend = this.valueFn(vend);
    if ( t < tstart ) t = tstart;
    if ( t > tend ) t = tend;
    let k = (vend - vstart) / (tend - tstart);
    if ( fun ) {
      k *= fun( ( t - tstart ) / (tend - tstart) );
    }
    return k * t + (vstart - k * tstart);
  }
gaussianRandom(start,end,skew=1,samples=5) {
    let r = 0;
    for( let i=0; i<samples; i++) r += Math.random();
    return start + Math.pow(r/samples,skew) * (end - start);
  }
sigmoidFactory(k) {
    function base(t) { return (1 / (1 + Math.exp(-k * t))) - 0.5; }
    var corr = 0.5 / base(1);
    return function (t) { return corr * base(2 * Math.max(Math.min(t, 1), 0) - 1) + 0.5; };
  }
makeEyeContact(t) {
    this.animQueue.push( this.animFactory( {
      name: 'eyecontact', dt: [0,t], vs: { eyeContact: [1] }
    }));
  }
updateMorphTargets(dt) {

    for( let [mt,o] of Object.entries(this.mtAvatar) ) {

      if ( !o.needsUpdate ) continue;

      // Alternative target (priority order):
      // - fixed: Fixed value, typically user controlled
      // - realtime: Realtime value, overriding everything except fixed
      // - system: System value, which overrides animations
      // - newvalue: Animation value
      // - baseline: Baseline value when none of the above applies
      let target = null;
      let newvalue = null;
      if ( o.fixed !== null ) {
        target = o.fixed;
        o.system = null;
        o.systemd = null;
        o.newvalue = null;
        if ( o.ref && o.ref.hasOwnProperty(mt) ) delete o.ref[mt];
        o.ref = null;
        o.base = null;
        if ( o.value === target ) {
          o.needsUpdate = false;
          continue;
        }
      } else if ( o.realtime !== null ) {
        o.ref = null;
        o.base = null;
        newvalue = o.realtime;
      } else if ( o.system !== null ) {
        target = o.system;
        o.newvalue = null;
        if ( o.ref && o.ref.hasOwnProperty(mt) ) delete o.ref[mt];
        o.ref = null;
        o.base = null;
        if ( o.systemd !== null ) {
          if ( o.systemd === 0 ) {
            target = null;
            o.system = null;
            o.systemd = null;
          } else {
            o.systemd -= dt;
            if ( o.systemd < 0 ) o.systemd= 0;
            if ( o.value === target ) {
              target = null;
            }
          }
        } else if ( o.value === target ) {
          target = null;
          o.system = null;
        }
      } else if ( o.newvalue !== null ) {
        o.ref = null;
        o.base = null;
        newvalue = o.newvalue;
        o.newvalue = null;
      } else if ( o.base !== null ) {
        target = o.base;
        o.ref = null;
        if ( o.value === target ) {
          target = null;
          o.base = null;
          o.needsUpdate = false;
        }
      } else {
        o.ref = null;
        if ( o.baseline !== null && o.value !== o.baseline ) {
          target = o.baseline;
          o.base = o.baseline;
        } else {
          o.needsUpdate = false;
        }
      }

      // Calculate new value using exponential smoothing
      if ( target !== null ) {
        let diff = target - o.value;
        if ( diff >= 0 ) {
          if ( diff < 0.005 ) {
            newvalue = target;
            o.v = 0;
          } else {
            if ( o.v < o.maxv ) o.v += o.acc * dt;
            if ( o.v >= 0 ) {
              newvalue = o.value + diff * ( 1 - Math.exp(- o.v * dt) );
            } else {
              newvalue = o.value + o.v * dt * ( 1 - Math.exp(o.v * dt) );
            }
          }
        } else {
          if ( diff > -0.005 ) {
            newvalue = target;
            o.v = 0;
          } else {
            if ( o.v > -o.maxv ) o.v -= o.acc * dt;
            if ( o.v >= 0 ) {
              newvalue = o.value + o.v * dt * ( 1 - Math.exp(- o.v * dt) );
            } else {
              newvalue = o.value + diff * ( 1 - Math.exp( o.v * dt) );
            }
          }
        }
      }

      // Check limits and whether we need to actually update the morph target
      if ( o.limit !== null ) {
        if ( newvalue !== null && newvalue !== o.value ) {
          o.value = newvalue;
          if ( o.onchange !== null ) o.onchange(newvalue);
        }
        newvalue = o.limit(o.value);
        if ( newvalue === o.applied ) continue;
      } else {
        if ( newvalue === null || newvalue === o.value ) continue;
        o.value = newvalue;
        if ( o.onchange !== null ) o.onchange(newvalue);
      }

      o.applied = newvalue;
      if ( o.applied < o.min ) o.applied = o.min;
      if ( o.applied > o.max ) o.applied = o.max;

      // Apply value
      switch(mt) {

      case 'headRotateX':
        this.poseDelta.props['Head.quaternion'].x = o.applied + this.mtAvatar['bodyRotateX'].applied + (this.avatar?.baseline?.headRotateX || 0);
        break;

      case 'headRotateY':
        this.poseDelta.props['Head.quaternion'].y = o.applied + this.mtAvatar['bodyRotateY'].applied;
        break;

      case 'headRotateZ':
        this.poseDelta.props['Head.quaternion'].z = o.applied + this.mtAvatar['bodyRotateZ'].applied;
        break;

      case 'bodyRotateX':
        this.poseDelta.props['Head.quaternion'].x = o.applied + this.mtAvatar['headRotateX'].applied + (this.avatar?.baseline?.headRotateX || 0);
        this.poseDelta.props['Spine1.quaternion'].x = o.applied/2;
        this.poseDelta.props['Spine.quaternion'].x = o.applied/8;
        this.poseDelta.props['Hips.quaternion'].x = o.applied/24;
        break;

      case 'bodyRotateY':
        this.poseDelta.props['Head.quaternion'].y = o.applied + this.mtAvatar['headRotateY'].applied;
        this.poseDelta.props['Spine1.quaternion'].y = o.applied/2;
        this.poseDelta.props['Spine.quaternion'].y = o.applied/2;
        this.poseDelta.props['Hips.quaternion'].y = o.applied/4;
        this.poseDelta.props['LeftUpLeg.quaternion'].y = o.applied/2;
        this.poseDelta.props['RightUpLeg.quaternion'].y = o.applied/2;
        this.poseDelta.props['LeftLeg.quaternion'].y = o.applied/4;
        this.poseDelta.props['RightLeg.quaternion'].y = o.applied/4;
        break;

      case 'bodyRotateZ':
        this.poseDelta.props['Head.quaternion'].z = o.applied + this.mtAvatar['headRotateZ'].applied;
        this.poseDelta.props['Spine1.quaternion'].z = o.applied/12;
        this.poseDelta.props['Spine.quaternion'].z = o.applied/12;
        this.poseDelta.props['Hips.quaternion'].z = o.applied/24;
        break;

      case 'handFistLeft':
      case 'handFistRight':
        const side = mt.substring(8);
        ['HandThumb', 'HandIndex','HandMiddle',
        'HandRing', 'HandPinky'].forEach( (x,i) => {
          if ( i === 0 ) {
            this.poseDelta.props[side+x+'1.quaternion'].x = 0;
            this.poseDelta.props[side+x+'2.quaternion'].z = (side === 'Left' ? -1 : 1) * o.applied;
            this.poseDelta.props[side+x+'3.quaternion'].z = (side === 'Left' ? -1 : 1) * o.applied;
          } else {
            this.poseDelta.props[side+x+'1.quaternion'].x = o.applied;
            this.poseDelta.props[side+x+'2.quaternion'].x = 1.5 * o.applied;
            this.poseDelta.props[side+x+'3.quaternion'].x = 1.5 * o.applied;
          }
        });
        break;

      case 'chestInhale':
        const scale = o.applied/20;
        const d = { x: scale, y: (scale/2), z: (3 * scale) };
        const dneg = { x: (1/(1+scale) - 1), y: (1/(1 + scale/2) - 1), z: (1/(1 + 3 * scale) - 1) };
        this.poseDelta.props['Spine1.scale'] = d;
        this.poseDelta.props['Neck.scale'] = dneg;
        this.poseDelta.props['LeftArm.scale'] = dneg;
        this.poseDelta.props['RightArm.scale'] = dneg;
        break;

      default:
        for( let i=0,l=o.ms.length; i<l; i++ ) {
          o.ms[i][o.is[i]] = o.applied;
        }

      }
    }
  }
step(deltaMS){if(!Number.isFinite(deltaMS)||deltaMS<0||deltaMS>100)throw Error('Kernel delta must be 0..100 milliseconds');this.animClock+=deltaMS;let i,j,l,k,vol=0;
    // Animation loop
    let isEyeContact = null;
    let isHeadMove = null;
    const tasks = [];
    for( i=0, l=this.animQueue.length; i<l; i++ ) {
      const x = this.animQueue[i];
      if ( this.animClock < x.ts[0] ) continue;

      for( j = x.ndx || 0, k = x.ts.length; j<k; j++ ) {
        if ( this.animClock < x.ts[j] ) break;

        for( let [mt,vs] of Object.entries(x.vs) ) {

          if ( this.mtAvatar.hasOwnProperty(mt) ) {
            if ( vs[j+1] === null ) continue; // Last or unknown target, skip

            // Start value and target
            const m = this.mtAvatar[mt];
            if ( vs[j] === null ) vs[j] = m.value; // Fill-in start value
            if ( j === k - 1 ) {
              m.newvalue = vs[j];
            } else {
              m.newvalue = vs[j+1];
              const tdiff = x.ts[j+1] - x.ts[j];
              let alpha = 1;
              if ( tdiff > 0.0001 ) alpha = (this.animClock - x.ts[j]) / tdiff;
              if ( alpha < 1 ) {
                if ( m.easing ) alpha = m.easing(alpha);
                m.newvalue = ( 1 - alpha ) * vs[j] + alpha * m.newvalue;
              }
              if ( m.ref && m.ref !== x.vs && m.ref.hasOwnProperty(mt) ) delete m.ref[mt];
              m.ref = x.vs;
            }

            // Volume effect
            if ( vol ) {
              switch(mt){
                case 'viseme_aa':
                case 'viseme_E':
                case 'viseme_I':
                case 'viseme_O':
                case 'viseme_U':
                  m.newvalue *= 1 + vol / 255 - 0.5;
              }
            }

            // Update
            m.needsUpdate = true;

          } else if ( mt === 'eyeContact' && vs[j] !== null && isEyeContact !== false ) {
            isEyeContact = Boolean(vs[j]);
          } else if ( mt === 'headMove' && vs[j] !== null && isHeadMove !== false ) {
            if ( vs[j] === 0 ) {
              isHeadMove = false;
            } else {
              if ( Math.random() < vs[j] ) isHeadMove = true;
              vs[j] = null;
            }
          } else if ( vs[j] !== null ) {
            tasks.push({ mt: mt, val: vs[j] });
            vs[j] = null;
          }

        }

      }

      // If end timeslot, loop or remove the animation, otherwise keep at it
      if ( j === k ) {
        if ( x.hasOwnProperty('mood') ) this.setMood(x.mood);
        if ( x.loop ) {
          k = ( this.isSpeaking && (x.template.name === 'head' || x.template.name === 'eyes') ) ? 4 : 1; // Restrain
          this.animQueue[i] = this.animFactory( x.template, (x.loop > 0 ? x.loop - 1 : x.loop), 1, 1/k );
        } else {
          this.animQueue.splice(i--, 1);
          l--;
        }
      } else {
        x.ndx = j - 1;
      }

    }


// Host consumes semantic signals; no renderer, audio, full-body tasks or RAF.
this.updateMorphTargets(deltaMS);this.steps++;this.lastSignals={eyeContact:isEyeContact,headMove:isHeadMove};return this.lastSignals;}
}
