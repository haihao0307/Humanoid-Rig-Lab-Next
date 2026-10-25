'use strict';
require('./build-r24.cjs');
require('./build-source-r24.cjs');
const fs=require('fs'),selected=JSON.parse(fs.readFileSync('BUILD-SOURCE-R24.json'));
selected.selectedVersion='R24';selected.companionBuild='BUILD-R24.json';selected.companionWorkbench='BUILD-R24.json';selected.selection='original source-state comparison with separate calibration and exact procedural skin; continuous workbench retains every control and remains unaccepted';fs.writeFileSync('BUILD.json.building',JSON.stringify(selected,null,2));fs.renameSync('BUILD.json.building','BUILD.json');
