'use strict';

const { diffSnapshots } = require('./src/diffSnapshots');
const { readSnapshotDir } = require('./src/readSnapshotDir');
const { lineDiff } = require('./src/lineDiff');
const { renderDiffHtml } = require('./src/renderHtml');

module.exports = { diffSnapshots, readSnapshotDir, lineDiff, renderDiffHtml };
