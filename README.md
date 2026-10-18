# snapview

A CLI for teams drowning in giant snapshot-diff PRs. snapview reads a
directory of committed snapshot files and a directory of pending (newly
generated) snapshot files, computes the exact diff between them, and will
eventually serve a local, offline web UI with side-by-side diffs and
one-click accept/reject buttons that rewrite the files on disk.

This milestone implements the diff model: parsing two snapshot directories
into a structured added/removed/changed/unchanged diff.

## Install

```sh
npm install
```

## Usage

The diff model is available as a library for now; the CLI and web UI land
in later milestones.

```js
const { diffSnapshots } = require('./index.js');

const result = diffSnapshots('./snapshots/committed', './snapshots/pending');

// result.added:     [{ file, after }]
// result.removed:   [{ file, before }]
// result.changed:   [{ file, before, after, hunks }]
// result.unchanged: [file, ...]
```

`hunks` is a line-by-line diff (`{ type: 'equal' | 'add' | 'remove', value }`)
computed with a standard longest-common-subsequence backtrack, implemented
in-house to keep the dependency count at zero.

Run the test suite with:

```sh
npm test
```

## Status

This project is built autonomously, milestone by milestone, and every change
is gated on a passing automated test suite before it is accepted.
