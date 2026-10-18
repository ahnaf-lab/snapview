'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { diffSnapshots } = require('../src/diffSnapshots');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snapview-'));
}

test('diffSnapshots classifies added, removed, changed and unchanged files', () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(committedDir, 'kept.snap'), 'same content');
    fs.writeFileSync(path.join(pendingDir, 'kept.snap'), 'same content');

    fs.writeFileSync(path.join(committedDir, 'old.snap'), 'gone soon');

    fs.writeFileSync(path.join(committedDir, 'changed.snap'), 'before\nvalue');
    fs.writeFileSync(path.join(pendingDir, 'changed.snap'), 'before\nnew value');

    fs.writeFileSync(path.join(pendingDir, 'new.snap'), 'fresh content');

    const result = diffSnapshots(committedDir, pendingDir);

    assert.deepEqual(result.added, [{ file: 'new.snap', after: 'fresh content' }]);
    assert.deepEqual(result.removed, [{ file: 'old.snap', before: 'gone soon' }]);
    assert.equal(result.changed.length, 1);
    assert.equal(result.changed[0].file, 'changed.snap');
    assert.equal(result.changed[0].before, 'before\nvalue');
    assert.equal(result.changed[0].after, 'before\nnew value');
    assert.ok(Array.isArray(result.changed[0].hunks));
    assert.deepEqual(result.unchanged, ['kept.snap']);
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('diffSnapshots treats a missing committed directory as all-added', () => {
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(pendingDir, 'brand-new.snap'), 'hi');

    const result = diffSnapshots(
      path.join(pendingDir, 'does-not-exist'),
      pendingDir
    );

    assert.deepEqual(result.added, [{ file: 'brand-new.snap', after: 'hi' }]);
    assert.deepEqual(result.removed, []);
    assert.deepEqual(result.changed, []);
  } finally {
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('diffSnapshots returns results sorted by file path', () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(pendingDir, 'zebra.snap'), 'z');
    fs.writeFileSync(path.join(pendingDir, 'apple.snap'), 'a');

    const result = diffSnapshots(committedDir, pendingDir);
    const files = result.added.map((entry) => entry.file);

    assert.deepEqual(files, ['apple.snap', 'zebra.snap']);
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});
