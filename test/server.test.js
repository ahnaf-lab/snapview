'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { createServer } = require('../src/server');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snapview-'));
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function withServer(committedDir, pendingDir, fn) {
  const server = createServer(committedDir, pendingDir, { title: 'test diff' });
  const port = await listen(server);
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await close(server);
  }
}

test('GET / renders the current diff with accept/reject forms', async () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(pendingDir, 'new.snap'), 'fresh content');

    await withServer(committedDir, pendingDir, async (base) => {
      const res = await fetch(`${base}/`);
      const html = await res.text();

      assert.equal(res.status, 200);
      assert.ok(html.includes('<title>test diff</title>'));
      assert.ok(html.includes('data-file="new.snap"'));
      assert.ok(html.includes('action="/accept"'));
      assert.ok(html.includes('action="/reject"'));
    });
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('POST /accept writes the pending content to the committed dir and redirects', async () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(pendingDir, 'new.snap'), 'fresh content');

    await withServer(committedDir, pendingDir, async (base) => {
      const res = await fetch(`${base}/accept`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'file=new.snap',
      });

      assert.equal(res.status, 303);
      assert.equal(res.headers.get('location'), '/');
      assert.equal(fs.readFileSync(path.join(committedDir, 'new.snap'), 'utf8'), 'fresh content');
    });
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('POST /reject on a changed file restores the pending copy to the committed content', async () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    fs.writeFileSync(path.join(committedDir, 'both.snap'), 'old value');
    fs.writeFileSync(path.join(pendingDir, 'both.snap'), 'new value');

    await withServer(committedDir, pendingDir, async (base) => {
      const res = await fetch(`${base}/reject`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'file=both.snap',
      });

      assert.equal(res.status, 303);
      assert.equal(fs.readFileSync(path.join(pendingDir, 'both.snap'), 'utf8'), 'old value');
    });
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('POST /accept with an unknown file is rejected and touches nothing on disk', async () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    await withServer(committedDir, pendingDir, async (base) => {
      const res = await fetch(`${base}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'file=../../etc/passwd',
      });

      assert.equal(res.status, 400);
      assert.deepEqual(fs.readdirSync(committedDir), []);
    });
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});

test('an unknown route returns 404', async () => {
  const committedDir = makeTmpDir();
  const pendingDir = makeTmpDir();
  try {
    await withServer(committedDir, pendingDir, async (base) => {
      const res = await fetch(`${base}/does-not-exist`);
      assert.equal(res.status, 404);
    });
  } finally {
    fs.rmSync(committedDir, { recursive: true, force: true });
    fs.rmSync(pendingDir, { recursive: true, force: true });
  }
});
