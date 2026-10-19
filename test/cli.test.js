'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { parseArgs, main, CliError, DEFAULT_PORT } = require('../src/cli');

function makeTmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapview-cli-'));
  const committedDir = path.join(root, 'committed');
  const pendingDir = path.join(root, 'pending');
  fs.mkdirSync(committedDir);
  fs.mkdirSync(pendingDir);
  return { root, committedDir, pendingDir };
}

test('parseArgs reads the directory and default port', () => {
  const result = parseArgs(['./snapshots']);
  assert.equal(result.dir, './snapshots');
  assert.equal(result.port, DEFAULT_PORT);
  assert.equal(result.help, false);
});

test('parseArgs accepts --port and -p', () => {
  assert.equal(parseArgs(['./snapshots', '--port', '1234']).port, 1234);
  assert.equal(parseArgs(['./snapshots', '-p', '1234']).port, 1234);
  assert.equal(parseArgs(['./snapshots', '--port=1234']).port, 1234);
});

test('parseArgs rejects a missing directory argument', () => {
  assert.throws(() => parseArgs([]), CliError);
  assert.throws(() => parseArgs(['--port', '1234']), CliError);
});

test('parseArgs rejects a non-numeric or out-of-range port', () => {
  assert.throws(() => parseArgs(['./snapshots', '--port', 'abc']), CliError);
  assert.throws(() => parseArgs(['./snapshots', '--port', '99999']), CliError);
});

test('parseArgs recognizes --help without requiring a directory', () => {
  const result = parseArgs(['--help']);
  assert.equal(result.help, true);
});

test('main rejects a directory that does not exist', async () => {
  const missing = path.join(os.tmpdir(), 'snapview-does-not-exist-xyz');
  await assert.rejects(() => main([missing], { log: () => {}, exit: () => {} }), CliError);
});

test('main exits immediately when there is nothing to review', async () => {
  const { root } = makeTmpRoot();
  try {
    let exitCode;
    const logs = [];
    const server = await main([root, '--port', '0'], {
      log: (msg) => logs.push(msg),
      exit: (code) => {
        exitCode = code;
      },
    });

    assert.equal(server, undefined);
    assert.equal(exitCode, 0);
    assert.ok(logs.some((msg) => msg.includes('nothing to review')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('main serves the diff and shuts down once every file is resolved', async () => {
  const { root, committedDir, pendingDir } = makeTmpRoot();
  try {
    fs.writeFileSync(path.join(pendingDir, 'new.snap'), 'fresh content');

    const logs = [];
    let exitCode;
    let resolveExit;
    const exited = new Promise((resolve) => {
      resolveExit = resolve;
    });
    const server = await main([root, '--port', '0'], {
      log: (msg) => logs.push(msg),
      exit: (code) => {
        exitCode = code;
        resolveExit();
      },
    });

    assert.ok(server);
    assert.ok(logs.some((msg) => /snapview running at http:\/\/127\.0\.0\.1:\d+\//.test(msg)));

    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/accept`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'file=new.snap',
    });
    assert.equal(res.status, 303);
    assert.equal(fs.readFileSync(path.join(committedDir, 'new.snap'), 'utf8'), 'fresh content');

    await exited;

    assert.equal(exitCode, 0);
    assert.ok(logs.some((msg) => msg.includes('shutting down')));
    await assert.rejects(() => fetch(`http://127.0.0.1:${port}/`));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
