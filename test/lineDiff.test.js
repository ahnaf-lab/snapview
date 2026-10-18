'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { lineDiff } = require('../src/lineDiff');

test('lineDiff returns only equal hunks for identical text', () => {
  const hunks = lineDiff('a\nb\nc', 'a\nb\nc');
  assert.deepEqual(hunks, [
    { type: 'equal', value: 'a' },
    { type: 'equal', value: 'b' },
    { type: 'equal', value: 'c' },
  ]);
});

test('lineDiff marks a single changed line as remove+add around equal context', () => {
  const hunks = lineDiff('a\nb\nc', 'a\nx\nc');
  assert.deepEqual(hunks, [
    { type: 'equal', value: 'a' },
    { type: 'remove', value: 'b' },
    { type: 'add', value: 'x' },
    { type: 'equal', value: 'c' },
  ]);
});

test('lineDiff handles pure additions and pure removals', () => {
  const added = lineDiff('a', 'a\nb');
  assert.deepEqual(added, [
    { type: 'equal', value: 'a' },
    { type: 'add', value: 'b' },
  ]);

  const removed = lineDiff('a\nb', 'a');
  assert.deepEqual(removed, [
    { type: 'equal', value: 'a' },
    { type: 'remove', value: 'b' },
  ]);
});
