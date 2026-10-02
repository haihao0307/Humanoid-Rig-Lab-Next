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
    revision: 'R008-lowrise-elastic-style-preserved-v2-20261002',
    sourceEntry: 'shorts-app.mjs', targetSubject: 'new-human-r008',
    waistDropM: .055, waistbandWidthM: .038,
    preserveOriginalSubjectClothing: true, authorBarePelvis: false,
    acceptedShape: false, motionValidated: false, immutable: false,
    note: '降低腰线、加入松紧腰头；保留人物现有衣物做适配检查。',
  }),
]);
