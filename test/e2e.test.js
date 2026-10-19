'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { main } = require('../src/cli');

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'e2e-repo');

/**
 * Copies the fixture repo (test/fixtures/e2e-repo/{committed,pending}) into
 * a fresh tmp dir so the test can accept/reject against it without mutating
 * the checked-in fixture.
 */
function copyFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapview-e2e-'));
  fs.cpSync(FIXTURE_ROOT, root, { recursive: true });
  return root;
}

function postForm(url, file) {
  return fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `file=${encodeURIComponent(file)}`,
  });
}

test('e2e: accepting and rejecting every pending file against a fixture repo resolves and shuts down', async () => {
  const root = copyFixtureRepo();
  const committedDir = path.join(root, 'committed');
  const pendingDir = path.join(root, 'pending');

  try {
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

    assert.ok(server, 'server should start since the fixture has pending diffs');
    const base = `http://127.0.0.1:${server.address().port}`;

    const initialPage = await (await fetch(`${base}/`)).text();
    assert.ok(initialPage.includes('data-file="new.snap"'), 'added file should appear');
    assert.ok(initialPage.includes('data-file="old.snap"'), 'removed file should appear');
    assert.ok(initialPage.includes('data-file="both.snap"'), 'changed file should appear');
    assert.ok(!initialPage.includes('data-file="header.snap"'), 'unchanged file has no diff section');
    assert.ok(initialPage.includes('3 remaining'));

    // Accept the added file: committed/new.snap should come to exist with pending's content.
    const acceptAdded = await postForm(`${base}/accept`, 'new.snap');
    assert.equal(acceptAdded.status, 303);
    assert.equal(fs.readFileSync(path.join(committedDir, 'new.snap'), 'utf8'), 'exports.value = "fresh";\n');

    // Reject the removed file: pending/old.snap should come to exist with committed's content.
    const rejectRemoved = await postForm(`${base}/reject`, 'old.snap');
    assert.equal(rejectRemoved.status, 303);
    assert.equal(fs.readFileSync(path.join(pendingDir, 'old.snap'), 'utf8'), 'exports.value = "stale";\n');

    assert.equal(exitCode, undefined, 'one file (both.snap) is still pending, so the server stays up');

    // Accept the changed file: committed/both.snap should match pending's content.
    const acceptChanged = await postForm(`${base}/accept`, 'both.snap');
    assert.equal(acceptChanged.status, 303);
    assert.equal(
      fs.readFileSync(path.join(committedDir, 'both.snap'), 'utf8'),
      '<button>Save & Close</button>\n<p>v1</p>\n'
    );

    await exited;

    assert.equal(exitCode, 0);
    assert.ok(logs.some((msg) => msg.includes('shutting down')));
    await assert.rejects(() => fetch(`${base}/`), 'server should no longer be listening');

    // header.snap was identical in committed/pending all along and must be untouched.
    assert.equal(fs.readFileSync(path.join(committedDir, 'header.snap'), 'utf8'), '<header>Site</header>\n');
    assert.equal(fs.readFileSync(path.join(pendingDir, 'header.snap'), 'utf8'), '<header>Site</header>\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('e2e: rejecting every change restores pending to exactly match committed', async () => {
  const root = copyFixtureRepo();
  const committedDir = path.join(root, 'committed');
  const pendingDir = path.join(root, 'pending');

  try {
    let exitCode;
    let resolveExit;
    const exited = new Promise((resolve) => {
      resolveExit = resolve;
    });

    const server = await main([root, '--port', '0'], {
      log: () => {},
      exit: (code) => {
        exitCode = code;
        resolveExit();
      },
    });

    const base = `http://127.0.0.1:${server.address().port}`;

    await postForm(`${base}/reject`, 'new.snap');
    await postForm(`${base}/accept`, 'old.snap');
    await postForm(`${base}/reject`, 'both.snap');

    await exited;
    assert.equal(exitCode, 0);

    assert.ok(!fs.existsSync(path.join(pendingDir, 'new.snap')), 'rejected addition should be gone from pending');
    assert.ok(!fs.existsSync(path.join(committedDir, 'old.snap')), 'accepted removal should be gone from committed');
    assert.equal(fs.readFileSync(path.join(pendingDir, 'both.snap'), 'utf8'), '<button>Save</button>\n<p>v1</p>\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
