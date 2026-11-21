const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// Only diagnostic files inside an already verified synthetic runtime.
module.exports=function removeTimingFixtures(runtime){
  const directory=path.join(runtime,'timings');if(!fs.existsSync(directory))return;
  assert.equal(fs.lstatSync(directory).isSymbolicLink(),false);
  assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(runtime));
  for(const name of fs.readdirSync(directory)){
    assert.match(name,/^timing-[a-f0-9-]{36}\.json$/);
    const file=path.join(directory,name),stat=fs.lstatSync(file);assert.equal(stat.isSymbolicLink(),false);assert.equal(stat.nlink,1);
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).schemaVersion,1);fs.unlinkSync(file);
  }
  fs.rmdirSync(directory);
};
