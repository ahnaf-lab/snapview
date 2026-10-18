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

function handleAction(action, committedDir, pendingDir, req, res) {
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
 */
function createServer(committedDir, pendingDir, options = {}) {
  const title = options.title || 'snapview diff';

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/') {
      sendHtml(res, 200, renderPage(committedDir, pendingDir, title));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/accept') {
      handleAction('accept', committedDir, pendingDir, req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/reject') {
      handleAction('reject', committedDir, pendingDir, req, res);
      return;
    }

    sendText(res, 404, 'Not found');
  });
}

module.exports = { createServer };
