(()=>{
  'use strict';

  const expectedLength = 8000;
  const missingIndex = 4649;
  const missingCharacter = 'k';
  const source = window.__BIRD_FORM;

  if (typeof source !== 'string') {
    throw new Error('form-00 来源载荷没有加载');
  }

  let repaired = source;
  let applied = false;

  if (source.length === expectedLength - 1) {
    repaired = source.slice(0, missingIndex) + missingCharacter + source.slice(missingIndex);
    applied = true;
  } else if (source.length !== expectedLength) {
    throw new Error(`form-00 来源载荷长度异常：${source.length}，预期 ${expectedLength - 1} 或 ${expectedLength}`);
  }

  if (repaired.length !== expectedLength) {
    throw new Error(`form-00 精确修复失败：修复后长度 ${repaired.length}`);
  }

  window.__BIRD_FORM = repaired;
  window.__BIRD_FORM00_REPAIR = {
    sourceLength: source.length,
    repairedLength: repaired.length,
    applied,
    insertionIndex: applied ? missingIndex : null,
    insertedCharacter: applied ? missingCharacter : null,
    authority: 'manifest-sha256-exact-single-character-recovery',
    expectedSourceFileSha256: '043fd8fdd7e058527d70ece00996e62ee9adafcdb91b9a6c6837f207bbfa1053'
  };
})();
