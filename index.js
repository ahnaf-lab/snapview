'use strict';

const { diffSnapshots } = require('./src/diffSnapshots');
const { readSnapshotDir } = require('./src/readSnapshotDir');
const { lineDiff } = require('./src/lineDiff');
const { renderDiffHtml } = require('./src/renderHtml');
const { applyAction, UnknownFileError } = require('./src/applyAction');
const { createServer } = require('./src/server');

module.exports = {
  diffSnapshots,
  readSnapshotDir,
  lineDiff,
  renderDiffHtml,
  applyAction,
  UnknownFileError,
  createServer,
};
