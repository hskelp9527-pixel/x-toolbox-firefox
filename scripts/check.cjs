const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ext=path.join(root,'extension');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
for(const file of walk(ext).filter(p=>p.endsWith('.js')))cp.execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
for(const name of ['manifest.json','manifest.chromium.json']){const m=JSON.parse(fs.readFileSync(path.join(ext,name)));assert.equal(m.version,require('../package.json').version);assert.equal(m.manifest_version,3);for(const c of m.content_scripts)for(const f of c.js)assert(fs.existsSync(path.join(ext,f)),f);for(const f of m.background.scripts??[])assert(fs.existsSync(path.join(ext,f)),f);assert(!m.permissions.includes('cookies'));assert(!m.permissions.includes('webRequest'));if(name==='manifest.json'){assert(!m.background.service_worker);assert(m.browser_specific_settings.gecko_android);assert.deepEqual(m.browser_specific_settings.gecko.data_collection_permissions.required,['none'])}}
assert(!fs.readFileSync(path.join(ext,'panel.js'),'utf8').includes('innerHTML'));
console.log('All runtime syntax and manifest contracts passed');
