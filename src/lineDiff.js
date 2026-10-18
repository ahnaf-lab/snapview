'use strict';

/**
 * Splits text into lines without losing information needed to tell a
 * trailing newline apart from its absence.
 */
function splitLines(text) {
  if (text === '') {
    return [];
  }
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

/**
 * Computes an exact line-level diff between two strings using the standard
 * longest-common-subsequence backtrack. Returns an ordered list of hunks:
 *   { type: 'equal' | 'add' | 'remove', value: string }
 * Consecutive equal lines are kept as separate entries so callers can
 * easily collapse or windows them for display later.
 */
function lineDiff(before, after) {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:]
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const hunks = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      hunks.push({ type: 'equal', value: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      hunks.push({ type: 'remove', value: a[i] });
      i++;
    } else {
      hunks.push({ type: 'add', value: b[j] });
      j++;
    }
  }
  while (i < n) {
    hunks.push({ type: 'remove', value: a[i] });
    i++;
  }
  while (j < m) {
    hunks.push({ type: 'add', value: b[j] });
    j++;
  }

  return hunks;
}

module.exports = { lineDiff, splitLines };
