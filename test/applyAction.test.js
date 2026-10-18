'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { applyAction, UnknownFileError } = require('../src/applyAction');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snapview-'));
}

test('accept on an added file copies pending content into the committed dir', () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(pendingDir, 'new.snap'), 'fresh content');

    applyAction('accept', committedDir, pendingDir, 'new.snap');

    assert.equal(fs.readFileSync(path.join(committedDir, 'new.snap'), 'utf8'), 'fresh content');
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('accept on a removed file deletes the committed file', () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(committedDir, 'old.snap'), 'stale content');

    applyAction('accept', committedDir, pendingDir, 'old.snap');

    assert.equal(fs.existsSync(path.join(committedDir, 'old.snap')), false);
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('accept on a changed file overwrites the committed file with pending content, creating nested dirs', () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(committedDir, 'nested'));
    fs.writeFileSync(path.join(committedDir, 'nested', 'both.snap'), 'old value');
    fs.mkdirSync(path.join(pendingDir, 'nested'));
    fs.writeFileSync(path.join(pendingDir, 'nested', 'both.snap'), 'new value');

    applyAction('accept', committedDir, pendingDir, 'nested/both.snap');

    assert.equal(
      fs.readFileSync(path.join(committedDir, 'nested', 'both.snap'), 'utf8'),
      'new value'
    );
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('reject on a changed file overwrites the pending file with committed content', () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(committedDir, 'both.snap'), 'old value');
    fs.writeFileSync(path.join(pendingDir, 'both.snap'), 'new value');

    applyAction('reject', committedDir, pendingDir, 'both.snap');

    assert.equal(fs.readFileSync(path.join(pendingDir, 'both.snap'), 'utf8'), 'old value');
    assert.equal(fs.readFileSync(path.join(committedDir, 'both.snap'), 'utf8'), 'old value');
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('reject on an added file deletes the pending file', () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(pendingDir, 'new.snap'), 'fresh content');

    applyAction('reject', committedDir, pendingDir, 'new.snap');

    assert.equal(fs.existsSync(path.join(pendingDir, 'new.snap')), false);
    assert.equal(fs.existsSync(path.join(committedDir, 'new.snap')), false);
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('reject on a removed file restores it in the pending dir to match committed', () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(committedDir, 'old.snap'), 'stale content');

    applyAction('reject', committedDir, pendingDir, 'old.snap');

    assert.equal(fs.readFileSync(path.join(committedDir, 'old.snap'), 'utf8'), 'stale content');
    assert.equal(fs.readFileSync(path.join(pendingDir, 'old.snap'), 'utf8'), 'stale content');
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('applyAction throws UnknownFileError for a file present in neither directory', () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    assert.throws(
      () => applyAction('accept', committedDir, pendingDir, '../../etc/passwd'),
      UnknownFileError
    );
    assert.throws(
      () => applyAction('accept', committedDir, pendingDir, 'does-not-exist.snap'),
      UnknownFileError
    );
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});
