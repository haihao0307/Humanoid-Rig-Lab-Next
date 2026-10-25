'use strict';
require('./build-r24.cjs');
require('./build-source-r24.cjs');
require('./pack-exact-r25.cjs');
require('./compile-boundary-r25.cjs');
require('./build-source-r25.cjs');
require('./build-workbench-r25.cjs');
const fs=require('fs'),selected=JSON.parse(fs.readFileSync('BUILD-SOURCE-R25.json'));
selected.selectedVersion='R25';selected.companionBuild='BUILD-R25.json';selected.companionWorkbench='BUILD-R25.json';selected.selection='exact original fixed-state function intersections after interaction; original detail integrated into complete parameter workbench; arbitrary continuous surface and full source fidelity remain unaccepted';fs.writeFileSync('BUILD.json.building',JSON.stringify(selected,null,2));fs.renameSync('BUILD.json.building','BUILD.json');
