'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { diffSnapshots } = require('./diffSnapshots');
const { createServer } = require('./server');

const DEFAULT_PORT = 4848;
const DEFAULT_HOST = '127.0.0.1';

class CliError extends Error {}

const USAGE = `Usage: snapview <dir> [--port <port>]

Reads <dir>/committed and <dir>/pending, diffs the snapshot files in
each, and serves a local web UI with side-by-side diffs and
accept/reject buttons that rewrite files in <dir>/committed and
<dir>/pending. Shuts down automatically once every diff is resolved.

Options:
  -p, --port <port>  Port to listen on (default: ${DEFAULT_PORT}; 0 picks a free port)
  -h, --help         Show this help text
`;

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new CliError(`Invalid port: ${value}`);
  }
  return port;
}

/**
 * Parses CLI arguments (as in process.argv.slice(2)) for the
 * `snapview <dir> [--port <port>]` entrypoint.
 */
function parseArgs(argv) {
  let dir;
  let port = DEFAULT_PORT;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--port' || arg === '-p') {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new CliError(`${arg} requires a value`);
      }
      port = parsePort(value);
      i += 1;
    } else if (arg.startsWith('--port=')) {
      port = parsePort(arg.slice('--port='.length));
    } else if (arg.startsWith('-')) {
      throw new CliError(`Unknown option: ${arg}`);
    } else if (dir === undefined) {
      dir = arg;
    } else {
      throw new CliError(`Unexpected argument: ${arg}`);
    }
  }

  if (!help && !dir) {
    throw new CliError('Missing required <dir> argument');
  }

  return { dir, port, help };
}

function isFullyResolved(committedDir, pendingDir) {
  const diff = diffSnapshots(committedDir, pendingDir);
  return diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0;
}

/**
 * Parses CLI args, and - unless --help was passed or there is nothing to
 * review - starts the snapview server over <dir>/committed and
 * <dir>/pending, bound to 127.0.0.1, and wires it to shut itself down
 * once every diff is resolved.
 *
 * `log` and `exit` are injectable (defaulting to console.log and
 * process.exit) so callers, including tests, can observe CLI output and
 * shutdown without touching the real process.
 *
 * Returns the started http.Server, or undefined if there was nothing to
 * start (--help, or no pending diff at all).
 */
async function main(argv, { log = console.log, exit = process.exit } = {}) {
  const { dir, port, help } = parseArgs(argv);

  if (help) {
    log(USAGE);
    return undefined;
  }

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new CliError(`Not a directory: ${dir}`);
  }

  const committedDir = path.join(dir, 'committed');
  const pendingDir = path.join(dir, 'pending');

  if (isFullyResolved(committedDir, pendingDir)) {
    log('No pending snapshot changes - nothing to review.');
    exit(0);
    return undefined;
  }

  const server = createServer(committedDir, pendingDir, {
    title: `snapview: ${dir}`,
    onResolved: () => {
      log('All snapshot diffs resolved, shutting down.');
      server.close(() => exit(0));
    },
  });

  await new Promise((resolve) => server.listen(port, DEFAULT_HOST, resolve));

  const actualPort = server.address().port;
  log(`snapview running at http://${DEFAULT_HOST}:${actualPort}/`);

  return server;
}

module.exports = { parseArgs, main, CliError, DEFAULT_PORT, DEFAULT_HOST, USAGE };
