'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { readSnapshotDir } = require('../src/readSnapshotDir');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snapview-'));
}

test('readSnapshotDir reads nested files with POSIX-style relative paths', () => {
  const dir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(dir, 'a.snap'), 'hello');
    fs.mkdirSync(path.join(dir, 'nested'));
    fs.writeFileSync(path.join(dir, 'nested', 'b.snap'), 'world');

    const result = readSnapshotDir(dir);

    assert.equal(result['a.snap'], 'hello');
    assert.equal(result['nested/b.snap'], 'world');
    assert.equal(Object.keys(result).length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readSnapshotDir treats a missing directory as empty', () => {
  const result = readSnapshotDir('/tmp/snapview-does-not-exist-xyz');
  assert.deepEqual(result, {});
});
