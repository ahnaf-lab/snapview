'use strict';

const { readSnapshotDir } = require('./readSnapshotDir');
const { lineDiff } = require('./lineDiff');

/**
 * Compares a committed snapshot directory against a pending snapshot
 * directory and returns a structured diff:
 *   {
 *     added:     [{ file, after }],
 *     removed:   [{ file, before }],
 *     changed:   [{ file, before, after, hunks }],
 *     unchanged: [file, ...]
 *   }
 * `file` is always a POSIX-style path relative to the snapshot directory,
 * so results are stable across platforms.
 */
function diffSnapshots(committedDir, pendingDir) {
  const committed = readSnapshotDir(committedDir);
  const pending = readSnapshotDir(pendingDir);

  const allFiles = new Set([...Object.keys(committed), ...Object.keys(pending)]);
  const sortedFiles = [...allFiles].sort();

  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const file of sortedFiles) {
    const hasCommitted = Object.prototype.hasOwnProperty.call(committed, file);
    const hasPending = Object.prototype.hasOwnProperty.call(pending, file);

    if (hasPending && !hasCommitted) {
      added.push({ file, after: pending[file] });
    } else if (hasCommitted && !hasPending) {
      removed.push({ file, before: committed[file] });
    } else if (committed[file] !== pending[file]) {
      changed.push({
        file,
        before: committed[file],
        after: pending[file],
        hunks: lineDiff(committed[file], pending[file]),
      });
    } else {
      unchanged.push(file);
    }
  }

  return { added, removed, changed, unchanged };
}

module.exports = { diffSnapshots };
