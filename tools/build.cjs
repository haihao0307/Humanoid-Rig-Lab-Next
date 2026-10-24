'use strict';
require('./build-r23.cjs');
require('./pack-source-r23.cjs');
require('./build-source-r23.cjs');
const fs=require('fs'),selected=JSON.parse(fs.readFileSync('BUILD-SOURCE-R23.json'));
selected.selectedVersion='R23';selected.companionBuild='BUILD-R23.json';selected.companionWorkbench='BUILD-R23.json';selected.selection='source-partition comparison with original body surface controls; continuous implicit workbench and complete source fidelity remain unaccepted';fs.writeFileSync('BUILD.json.building',JSON.stringify(selected,null,2));fs.renameSync('BUILD.json.building','BUILD.json');
