# Chicken V4.6 R9.8.3 — Clean Face and Embedded Bill Candidate

## Active executable

`CHICKEN_V46_R9_8_3_CLEAN_FACE.html`

## What changed

The remaining angular patch behind the new eye was traced to legacy `PART_CATALOG` ear-lobe objects 3 and 4. R9.8.3 excludes those objects only in the candidate path, while retaining the existing rollback. The short bill root is moved deeper into the face to close the side seam.

## QA and truth boundary

Browser QA passed: `true`. Manual visual acceptance, whole-surface freeze, Rig and Motion remain closed.
