require('./build-r22.cjs');
require('./build-source-r22.cjs');
const fs=require('fs'),selected=JSON.parse(fs.readFileSync('BUILD-SOURCE-R22.json'));
selected.companionBuild='BUILD-R22.json';selected.companionWorkbench='BUILD-R22.json';selected.selection='source-partition and original-active-skin comparison candidate; reconstruction and source acceptance incomplete';fs.writeFileSync('BUILD.json',JSON.stringify(selected,null,2));
