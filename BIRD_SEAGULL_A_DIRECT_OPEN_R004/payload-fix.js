(()=>{
  'use strict';
  if (typeof window.__BIRD_FORM !== 'string' || window.__BIRD_FORM.length === 0) {
    throw new Error('形态载荷没有加载，无法执行 Base64 修复');
  }
  const raw = window.__BIRD_FORM;
  const clean = raw.replace(/\s+/g, '');
  const addedPadding = (4 - (clean.length % 4)) % 4;
  const padded = clean + '='.repeat(addedPadding);
  window.__BIRD_FORM = padded;
  window.__BIRD_PAYLOAD_REPAIR = {
    rawLength: raw.length,
    cleanLength: clean.length,
    paddedLength: padded.length,
    addedPadding,
    validBase64Length: padded.length % 4 === 0
  };
})();
