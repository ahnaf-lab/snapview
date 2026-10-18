# snapview

A CLI for teams drowning in giant snapshot-diff PRs. snapview reads a
directory of committed snapshot files and a directory of pending (newly
generated) snapshot files, computes the exact diff between them, and
serves a local, offline web UI with side-by-side diffs and one-click
accept/reject buttons that rewrite the files on disk.

This milestone adds the local HTTP server: it serves the diff as HTML
(reusing the diff model and HTML renderer from earlier milestones) and
exposes `POST /accept` and `POST /reject` endpoints that patch the
snapshot directories on disk. The CLI entry point that wires this server
to command-line arguments lands in a later milestone; for now the server
and diff/render pieces are used as a library.

## Install

```sh
npm install
```

## Usage

```js
const { diffSnapshots, renderDiffHtml, createServer } = require('./index.js');

const result = diffSnapshots('./snapshots/committed', './snapshots/pending');

// result.added:     [{ file, after }]
// result.removed:   [{ file, before }]
// result.changed:   [{ file, before, after, hunks }]
// result.unchanged: [file, ...]

const html = renderDiffHtml(result, { title: 'my-project diff' });
require('node:fs').writeFileSync('diff.html', html);

// Or serve the diff locally with accept/reject buttons:
const server = createServer('./snapshots/committed', './snapshots/pending', {
  title: 'my-project diff',
});
server.listen(3000, () => console.log('http://localhost:3000'));
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
caught. Pass `{ interactive: true }` (what `createServer` does internally)
to also render an Accept/Reject form under each added, removed or changed
file; these are plain HTML `<form method="post">` elements with no inline
scripts, so the page works with JavaScript disabled.

`createServer(committedDir, pendingDir, options)` builds a local HTTP
server (call `.listen(port)` on the result to start it) with three routes:

- `GET /` — renders the current diff between `committedDir` and
  `pendingDir` as HTML, recomputed on every request.
- `POST /accept` (form body `file=<relative path>`) — makes the committed
  snapshot match the pending one: writes the pending file's content into
  `committedDir`, or deletes the committed file if pending no longer has
  it.
- `POST /reject` (form body `file=<relative path>`) — makes the pending
  snapshot match the committed one: writes the committed file's content
  into `pendingDir`, or deletes the pending file if committed doesn't have
  it.

A request's `file` value is only acted on if it is already a key in a
snapshot map that `readSnapshotDir` built from a real directory listing
(see `src/applyAction.js`), which rules out path traversal: those maps are
built purely from entries returned by `fs.readdirSync`, which never yields
`.` or `..` segments. Unrecognized `file` values get a `400` response and
touch nothing on disk. The server makes no outbound network calls of its
own — it only reads and writes inside the two directories it was given.

Run the test suite with:

```sh
npm test
```

## Status

This project is built autonomously, milestone by milestone, and every change
is gated on a passing automated test suite before it is accepted.
