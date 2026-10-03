// Original accepted shape remains immutable. The revised garment has its own
// source recipe and acceptance state; neither version can overwrite the other.
export const SHORTS_VERSIONS = Object.freeze([
  Object.freeze({
    id: 'original', label: '原版',
    revision: 'R24-19-seams-static-test-20261001',
    htmlSHA256: '2b9158f76cd75aef5605be86bd7092c406d333467ce116eca130f166580635da',
    publicURL: 'https://haihao0307.github.io/guilin-dem-pipeline/shorts-r24-static-20261001/',
    acceptedShape: true, motionValidated: false, immutable: true,
    note: '保留已认可的版型与材质；原版布料运动尚未验收。',
  }),
  Object.freeze({
    id: 'lowrise', label: '新版 · 低腰松紧',
    revision: 'R008-lowrise-continuous-surface-v8-20261003',
    sourceEntry: 'shorts-app.mjs', targetSubject: 'new-human-r008',
    waistFit: 'original-forearm-midpoint-waist@1', waistDropM: null, automaticWaistFit: true, waistbandWidthM: .038,
    preserveOriginalSubjectClothing: true, authorBarePelvis: true, retiredClothingRenderParts: [9,10,19],
    acceptedShape: false, motionValidated: false, immutable: false,
    note: '按原版小臂中段的下降比例自动降低腰口，裤脚不变；松紧腰头与布料动作仍待验收。',
  }),
]);
