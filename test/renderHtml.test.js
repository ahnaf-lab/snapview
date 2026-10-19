'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { renderDiffHtml, escapeHtml } = require('../src/renderHtml');
const { sampleDiff } = require('./fixtures/sampleDiff');

test('escapeHtml neutralizes markup-significant characters', () => {
  assert.equal(
    escapeHtml('<b>"quoted" & \'tagged\'</b>'),
    '&lt;b&gt;&quot;quoted&quot; &amp; &#39;tagged&#39;&lt;/b&gt;'
  );
});

test('renderDiffHtml matches the golden fixture for a fixed sample diff', () => {
  const golden = fs.readFileSync(path.join(__dirname, 'fixtures', 'golden.html'), 'utf8');
  const html = renderDiffHtml(sampleDiff, { title: 'snapview diff' });
  assert.equal(html, golden);
});

test('renderDiffHtml escapes snapshot content instead of injecting raw markup', () => {
  const diff = {
    added: [{ file: 'xss.snap', after: '<script>alert(1)</script>\n' }],
    removed: [],
    changed: [],
    unchanged: [],
  };

  const html = renderDiffHtml(diff);

  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('renderDiffHtml renders a side-by-side table row per hunk entry with line numbers', () => {
  const diff = {
    added: [],
    removed: [],
    changed: [
      {
        file: 'both.snap',
        before: 'a\nb',
        after: 'a\nc',
        hunks: [
          { type: 'equal', value: 'a' },
          { type: 'remove', value: 'b' },
          { type: 'add', value: 'c' },
        ],
      },
    ],
    unchanged: [],
  };

  const html = renderDiffHtml(diff);

  assert.ok(html.includes('<tr class="line equal">'));
  assert.ok(html.includes('<tr class="line remove">'));
  assert.ok(html.includes('<tr class="line add">'));
  assert.ok(html.includes('data-file="both.snap"'));
});

test('renderDiffHtml lists unchanged files and includes a summary count', () => {
  const diff = {
    added: [],
    removed: [],
    changed: [],
    unchanged: ['a.snap', 'b.snap'],
  };

  const html = renderDiffHtml(diff);

  assert.ok(html.includes('0 added, 0 removed, 0 changed, 2 unchanged'));
  assert.ok(html.includes('<li>a.snap</li>'));
  assert.ok(html.includes('<li>b.snap</li>'));
});

test('renderDiffHtml produces no sections for an all-unchanged diff', () => {
  const diff = { added: [], removed: [], changed: [], unchanged: ['same.snap'] };
  const html = renderDiffHtml(diff);
  assert.ok(!html.includes('class="file'));
});

test('renderDiffHtml omits accept/reject forms by default', () => {
  const diff = {
    added: [{ file: 'new.snap', after: 'x\n' }],
    removed: [],
    changed: [],
    unchanged: [],
  };
  const html = renderDiffHtml(diff);
  assert.ok(!html.includes('<form'));
});

test('renderDiffHtml adds accept/reject forms per file when interactive is set', () => {
  const diff = {
    added: [{ file: 'new.snap', after: 'x\n' }],
    removed: [],
    changed: [],
    unchanged: [],
  };
  const html = renderDiffHtml(diff, { interactive: true });

  assert.ok(html.includes('<form method="post" action="/accept">'));
  assert.ok(html.includes('<form method="post" action="/reject">'));
  assert.ok(html.includes('<input type="hidden" name="file" value="new.snap">'));
});

test('renderDiffHtml shows a remaining counter and keyboard-shortcut script when interactive', () => {
  const diff = {
    added: [{ file: 'new.snap', after: 'x\n' }],
    removed: [{ file: 'old.snap', before: 'y\n' }],
    changed: [],
    unchanged: ['same.snap'],
  };
  const html = renderDiffHtml(diff, { interactive: true });

  assert.ok(html.includes('<p class="remaining">2 remaining</p>'));
  assert.ok(html.includes('<script>'));
  assert.ok(html.includes("document.addEventListener('keydown'"));
  assert.ok(!html.includes('<script>alert'));
});

test('renderDiffHtml omits the remaining counter and script outside interactive mode', () => {
  const diff = {
    added: [{ file: 'new.snap', after: 'x\n' }],
    removed: [],
    changed: [],
    unchanged: [],
  };
  const html = renderDiffHtml(diff);

  assert.ok(!html.includes('class="remaining"'));
  assert.ok(!html.includes('<script>'));
});

test('renderDiffHtml omits the counter and script when everything is already resolved', () => {
  const diff = { added: [], removed: [], changed: [], unchanged: ['same.snap'] };
  const html = renderDiffHtml(diff, { interactive: true });

  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('0 remaining'));
});
