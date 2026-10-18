'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { readSnapshotDir } = require('./readSnapshotDir');

class UnknownFileError extends Error {
  constructor(file) {
    super(`Unknown snapshot file: ${file}`);
    this.name = 'UnknownFileError';
  }
}

function toAbsolutePath(dirPath, file) {
  return path.join(dirPath, ...file.split('/'));
}

function writeFile(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
}

function deleteFileIfExists(absPath) {
  if (fs.existsSync(absPath)) {
    fs.unlinkSync(absPath);
  }
}

/**
 * Applies an accept or reject decision for a single snapshot file.
 *
 * `file` must be a key already present in a snapshot map produced by
 * readSnapshotDir (of either committedDir or pendingDir) - this is what
 * rules out path traversal from caller input (e.g. an HTTP request body):
 * those maps are built purely from real entries returned by
 * fs.readdirSync, which never yields "." or ".." segments, so a `file`
 * found there can never point outside committedDir/pendingDir.
 *
 * 'accept' makes the committed snapshot match pending: it writes pending's
 * content into committedDir, or deletes the committed file if pending has
 * no such file (the pending side deleted it).
 *
 * 'reject' makes pending match committed: it writes committed's content
 * into pendingDir, or deletes the pending file if committed has no such
 * file (the pending side added it).
 */
function applyAction(action, committedDir, pendingDir, file) {
  const committed = readSnapshotDir(committedDir);
  const pending = readSnapshotDir(pendingDir);

  const inCommitted = Object.prototype.hasOwnProperty.call(committed, file);
  const inPending = Object.prototype.hasOwnProperty.call(pending, file);

  if (!inCommitted && !inPending) {
    throw new UnknownFileError(file);
  }

  if (action === 'accept') {
    if (inPending) {
      writeFile(toAbsolutePath(committedDir, file), pending[file]);
    } else {
      deleteFileIfExists(toAbsolutePath(committedDir, file));
    }
  } else if (action === 'reject') {
    if (inCommitted) {
      writeFile(toAbsolutePath(pendingDir, file), committed[file]);
    } else {
      deleteFileIfExists(toAbsolutePath(pendingDir, file));
    }
  } else {
    throw new Error(`Unknown action: ${action}`);
  }
}

module.exports = { applyAction, UnknownFileError };
