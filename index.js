'use strict';

const { diffSnapshots } = require('./src/diffSnapshots');
const { readSnapshotDir } = require('./src/readSnapshotDir');
const { lineDiff } = require('./src/lineDiff');

module.exports = { diffSnapshots, readSnapshotDir, lineDiff };
