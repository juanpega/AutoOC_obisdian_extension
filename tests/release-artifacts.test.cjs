const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const tools = import(pathToFileURL(path.join(root, 'scripts/release-artifacts.mjs')).href);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const removeFixture = dir => {
  assert.equal(path.dirname(fs.realpathSync(dir)), fs.realpathSync(os.tmpdir()));
  assert.match(path.basename(dir), /^autooc-release-(git|crlf)-/);
  fs.rmSync(dir, {recursive:true, force:true});
};

test('release descriptor matches the actual Git blobs with Windows normalization enabled', async t => {
  const {releaseArtifacts, writeReleaseIntegrity, validateReleaseArtifacts} = await tools;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-release-git-'));
  t.after(() => removeFixture(dir));
  for (const file of releaseArtifacts) {
    fs.mkdirSync(path.dirname(path.join(dir,file)), {recursive:true});
    fs.writeFileSync(path.join(dir,file), file === 'manifest.json' ? '{"version":"1.7.13"}\n' : '// fixture\n');
  }
  fs.copyFileSync(path.join(root,'.gitattributes'), path.join(dir,'.gitattributes'));
  writeReleaseIntegrity(dir);
  validateReleaseArtifacts(dir);
  const git = args => execFileSync('git', args, {cwd:dir, windowsHide:true, stdio:['ignore','pipe','pipe']});
  git(['init','--quiet']);
  git(['config','core.autocrlf','true']);
  git(['add','--','.gitattributes',...releaseArtifacts]);
  const descriptor = JSON.parse(git(['show',':release-integrity.json']));
  for (const [file, expected] of Object.entries(descriptor.sha256)) {
    assert.equal(sha(git(['show',`:${file}`])), expected, file);
  }
  assert.deepEqual(git(['show',':release-integrity.json']), fs.readFileSync(path.join(dir,'release-integrity.json')));
});

test('CRLF artifacts cannot create a misleading Git release descriptor', async t => {
  const {releaseArtifacts, writeReleaseIntegrity, validateReleaseArtifacts} = await tools;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autooc-release-crlf-'));
  t.after(() => removeFixture(dir));
  for (const file of releaseArtifacts) {
    fs.mkdirSync(path.dirname(path.join(dir,file)), {recursive:true});
    fs.writeFileSync(path.join(dir,file), file === 'manifest.json' ? '{"version":"1.7.13"}\n' : '// fixture\n');
  }
  writeReleaseIntegrity(dir);
  const oldDescriptor = fs.readFileSync(path.join(dir,'release-integrity.json'));
  const manifest = Buffer.from('{"version":"1.7.13"}\r\n');
  fs.writeFileSync(path.join(dir,'manifest.json'), manifest);
  assert.throws(() => writeReleaseIntegrity(dir), /LF line endings.*manifest.json/);
  assert.deepEqual(fs.readFileSync(path.join(dir,'release-integrity.json')), oldDescriptor);
  assert.throws(() => validateReleaseArtifacts(dir), /Stale release artifact: manifest.json/);
});
