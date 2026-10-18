'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Recursively reads every file under `dirPath` and returns a map of
 * POSIX-style relative path -> file contents (utf8).
 *
 * A missing directory is treated as an empty snapshot set rather than an
 * error, since a brand-new test suite has no committed snapshots yet.
 */
function readSnapshotDir(dirPath) {
  const result = {};

  if (!fs.existsSync(dirPath)) {
    return result;
  }

  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dirPath}`);
  }

  const walk = (currentDir, relativePrefix) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = relativePrefix
        ? `${relativePrefix}/${entry.name}`
        : entry.name;

      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        result[relativePath] = fs.readFileSync(absolutePath, 'utf8');
      }
    }
  };

  walk(dirPath, '');

  return result;
}

module.exports = { readSnapshotDir };
