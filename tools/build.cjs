require('./build-r21.cjs');
require('./build-source-atlas-r21.cjs');
const fs=require('fs');const selected=JSON.parse(fs.readFileSync('BUILD-SOURCE-R21.json'));selected.companionWorkbench='BUILD-R21.json';selected.selection='source-partition comparison candidate; not completed mother conversion';fs.writeFileSync('BUILD.json',JSON.stringify(selected,null,2));
