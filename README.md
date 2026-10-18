# snapview

A CLI for teams drowning in giant snapshot-diff PRs. snapview reads a
directory of committed snapshot files and a directory of pending (newly
generated) snapshot files, computes the exact diff between them, and will
eventually serve a local, offline web UI with side-by-side diffs and
one-click accept/reject buttons that rewrite the files on disk.

This milestone implements the diff model (parsing two snapshot directories
into a structured added/removed/changed/unchanged diff) and an HTML
renderer that turns that diff model into a self-contained side-by-side HTML
document.

## Install

```sh
npm install
```

## Usage

The diff model and HTML renderer are available as a library for now; the
CLI and the interactive (accept/reject) web UI land in later milestones.

```js
const { diffSnapshots, renderDiffHtml } = require('./index.js');

const result = diffSnapshots('./snapshots/committed', './snapshots/pending');

// result.added:     [{ file, after }]
// result.removed:   [{ file, before }]
// result.changed:   [{ file, before, after, hunks }]
// result.unchanged: [file, ...]

const html = renderDiffHtml(result, { title: 'my-project diff' });
require('node:fs').writeFileSync('diff.html', html);
```

`hunks` is a line-by-line diff (`{ type: 'equal' | 'add' | 'remove', value }`)
computed with a standard longest-common-subsequence backtrack, implemented
in-house to keep the dependency count at zero.

`renderDiffHtml` turns a diff result into a single self-contained HTML
document: one side-by-side before/after table per added, removed or
changed file, plus a summary line and a list of unchanged files. All
snapshot content is HTML-escaped before being written into the document,
the output has no `<script>` tags, and nothing in the renderer makes a
network call. `test/renderHtml.test.js` golden-tests this output against
a fixed fixture in `test/fixtures/` so unintended formatting changes are
caught.

Run the test suite with:

```sh
npm test
```

## Status

This project is built autonomously, milestone by milestone, and every change
is gated on a passing automated test suite before it is accepted.
