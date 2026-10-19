# snapview

A CLI for teams drowning in giant snapshot-diff PRs. snapview reads a
directory of committed snapshot files and a directory of pending (newly
generated) snapshot files, computes the exact diff between them, and
serves a local, offline web UI with side-by-side diffs and one-click
accept/reject buttons that rewrite the files on disk.

This milestone adds the `snapview` command-line entry point: it wires
the local server (from the previous milestone) to a directory argument
and a `--port` option, and shuts itself down once every pending snapshot
has been accepted or rejected.

## Install

```sh
npm install
```

To use the `snapview` command from anywhere, install it globally or link it:

```sh
npm link
```

## Usage

```sh
snapview <dir> [--port <port>]
```

`<dir>` must contain two subdirectories, `committed/` and `pending/`,
mirroring the same relative file paths (this is the same layout the
diff model from earlier milestones already works with). `snapview`
diffs them, prints a local URL, and serves a web UI there with
accept/reject buttons:

- Accepting a file copies the pending version into `committed/` (or
  deletes it from `committed/` if pending removed it).
- Rejecting a file copies the committed version into `pending/` (or
  deletes it from `pending/` if committed never had it).

Once every file in the diff has been accepted or rejected, the server
shuts down and the process exits - there is nothing left to review.

```sh
snapview ./snapshots
snapview ./snapshots --port 3000   # fixed port instead of the default
snapview ./snapshots --port 0      # let the OS pick a free port
snapview --help
```

If `<dir>/committed` and `<dir>/pending` already match (no added,
removed or changed files), `snapview` prints a message and exits
immediately without starting a server.

The pieces above are also usable as a library:

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

`bin/cli.js` is the `snapview` executable named in `package.json`'s
`bin` field; it just calls `main()` from `src/cli.js` with
`process.argv` and reports errors on stderr. `src/cli.js` exports:

- `parseArgs(argv)` — turns `['<dir>', '--port', '<n>']`-style arguments
  into `{ dir, port, help }`, throwing `CliError` for a missing
  directory or an invalid `--port` value.
- `main(argv, { log, exit })` — parses args, resolves `<dir>/committed`
  and `<dir>/pending`, and (unless `--help` was passed or the two
  directories already match) starts the server bound to
  `127.0.0.1:<port>` and passes it an `onResolved` callback that closes
  the server and calls `exit(0)` once an accept/reject leaves no added,
  removed or changed files. `log` and `exit` default to `console.log`
  and `process.exit` but can be overridden (this is how the tests in
  `test/cli.test.js` observe CLI behavior without tearing down the test
  process itself).

Run the test suite with:

```sh
npm test
```

## Status

This project is built autonomously, milestone by milestone, and every change
is gated on a passing automated test suite before it is accepted.
