'use strict';

const http = require('node:http');

const { diffSnapshots } = require('./diffSnapshots');
const { renderDiffHtml } = require('./renderHtml');
const { applyAction, UnknownFileError } = require('./applyAction');

const MAX_BODY_BYTES = 1024 * 1024;

function sendText(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function renderPage(committedDir, pendingDir, title) {
  const diff = diffSnapshots(committedDir, pendingDir);
  return renderDiffHtml(diff, { title, interactive: true });
}

function handleAction(action, committedDir, pendingDir, req, res, onResolved) {
  readBody(req)
    .then((body) => {
      const file = new URLSearchParams(body).get('file');
      if (!file) {
        sendText(res, 400, 'Missing "file" field');
        return;
      }

      try {
        applyAction(action, committedDir, pendingDir, file);
      } catch (err) {
        if (err instanceof UnknownFileError) {
          sendText(res, 400, 'Unknown snapshot file');
          return;
        }
        throw err;
      }

      res.writeHead(303, { Location: '/' });
      res.end();

      if (onResolved) {
        const diff = diffSnapshots(committedDir, pendingDir);
        if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
          onResolved();
        }
      }
    })
    .catch((err) => {
      sendText(res, 400, `Bad request: ${err.message}`);
    });
}

/**
 * Creates (but does not start listening on) a local HTTP server that:
 *   - serves the current snapshot diff as HTML at GET /
 *   - applies an accept decision via POST /accept (form body: file=<path>)
 *   - applies a reject decision via POST /reject (form body: file=<path>)
 *
 * The diff (and therefore the set of valid `file` values) is recomputed
 * from committedDir/pendingDir on every request, so the page always
 * reflects the current state of the two directories on disk. No request
 * made to this server causes any further network call.
 *
 * If `options.onResolved` is given, it is called (with no arguments)
 * right after an accept/reject request leaves the diff with no added,
 * removed or changed files left - i.e. every snapshot has been reviewed.
 * It may be called more than once if further accept/reject calls keep
 * the diff empty.
 */
function createServer(committedDir, pendingDir, options = {}) {
  const title = options.title || 'snapview diff';
  const onResolved = options.onResolved;

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/') {
      sendHtml(res, 200, renderPage(committedDir, pendingDir, title));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/accept') {
      handleAction('accept', committedDir, pendingDir, req, res, onResolved);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/reject') {
      handleAction('reject', committedDir, pendingDir, req, res, onResolved);
      return;
    }

    sendText(res, 404, 'Not found');
  });
}

module.exports = { createServer };
