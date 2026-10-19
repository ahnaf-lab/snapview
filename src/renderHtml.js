'use strict';

const { splitLines } = require('./lineDiff');

/**
 * Escapes text for safe inclusion in HTML output. All snapshot content is
 * untrusted test fixture data, so every value written into the document
 * must go through this before being concatenated into markup.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRow(beforeLine, beforeValue, afterLine, afterValue, rowClass) {
  const beforeNo = beforeLine === null ? '' : String(beforeLine);
  const afterNo = afterLine === null ? '' : String(afterLine);
  const beforeCode = beforeValue === null ? '' : escapeHtml(beforeValue);
  const afterCode = afterValue === null ? '' : escapeHtml(afterValue);
  return (
    `<tr class="line ${rowClass}">` +
    `<td class="lineno">${beforeNo}</td><td class="code">${beforeCode}</td>` +
    `<td class="lineno">${afterNo}</td><td class="code">${afterCode}</td>` +
    '</tr>'
  );
}

/**
 * Renders a hunk list (as produced by lineDiff) into side-by-side table
 * rows. Equal lines occupy both columns of the same row; add/remove lines
 * occupy only their own column, since the backing hunk list is a single
 * ordered sequence rather than pre-paired lines.
 */
function renderHunkRows(hunks) {
  let beforeLine = 0;
  let afterLine = 0;
  const rows = [];

  for (const hunk of hunks) {
    if (hunk.type === 'equal') {
      beforeLine++;
      afterLine++;
      rows.push(renderRow(beforeLine, hunk.value, afterLine, hunk.value, 'equal'));
    } else if (hunk.type === 'remove') {
      beforeLine++;
      rows.push(renderRow(beforeLine, hunk.value, null, null, 'remove'));
    } else {
      afterLine++;
      rows.push(renderRow(null, null, afterLine, hunk.value, 'add'));
    }
  }

  return rows.join('\n');
}

function renderWholeFileRows(text, side) {
  const lines = splitLines(text);
  return lines
    .map((line, index) => {
      const lineNo = index + 1;
      return side === 'before'
        ? renderRow(lineNo, line, null, null, 'remove')
        : renderRow(null, null, lineNo, line, 'add');
    })
    .join('\n');
}

function renderTable(rowsHtml) {
  return (
    '<table class="side-by-side">\n' +
    '<thead><tr><th colspan="2">before</th><th colspan="2">after</th></tr></thead>\n' +
    `<tbody>\n${rowsHtml}\n</tbody>\n` +
    '</table>'
  );
}

/**
 * Renders the accept/reject controls for a single file as plain HTML
 * forms (no inline scripts, no fetch/XHR) so the page keeps working with
 * JavaScript disabled and stays within the "no network calls the README
 * does not describe" rule: a normal form POST to /accept or /reject is the
 * only network activity, and both routes are documented in the README.
 */
function renderActions(file) {
  const encodedFile = escapeHtml(file);
  return (
    '<div class="actions">\n' +
    '<form method="post" action="/accept">' +
    `<input type="hidden" name="file" value="${encodedFile}">` +
    '<button type="submit" class="accept">Accept</button>' +
    '</form>\n' +
    '<form method="post" action="/reject">' +
    `<input type="hidden" name="file" value="${encodedFile}">` +
    '<button type="submit" class="reject">Reject</button>' +
    '</form>\n' +
    '</div>\n'
  );
}

function renderSection(status, file, rowsHtml, actionsHtml = '') {
  return (
    `<section class="file ${status}" data-file="${escapeHtml(file)}">\n` +
    `<h2><span class="status">${status}</span> ${escapeHtml(file)}</h2>\n` +
    actionsHtml +
    `${renderTable(rowsHtml)}\n` +
    '</section>'
  );
}

/**
 * Inline keyboard-shortcut script for the interactive page: `j`/`k` (or the
 * down/up arrows) move a "current file" highlight between the review
 * sections, and `a`/`r` submit that section's existing accept/reject form.
 * It never builds or evaluates markup/strings as code (no eval, no innerHTML
 * from request data) - it only calls requestSubmit() on forms that are
 * already present in the document, so it adds no network call beyond the
 * plain form POSTs to /accept and /reject that the README already documents.
 */
const SHORTCUTS_SCRIPT = `
(function () {
  var sections = Array.prototype.slice.call(document.querySelectorAll('section.file'));
  if (!sections.length) return;
  var current = 0;

  function highlight() {
    sections.forEach(function (section, index) {
      section.classList.toggle('current', index === current);
    });
    sections[current].scrollIntoView({ block: 'nearest' });
  }

  function submitAction(action) {
    var form = sections[current].querySelector('form[action="/' + action + '"]');
    if (!form) return;
    if (form.requestSubmit) {
      form.requestSubmit();
    } else {
      form.submit();
    }
  }

  document.addEventListener('keydown', function (event) {
    var target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    if (event.key === 'j' || event.key === 'ArrowDown') {
      current = Math.min(current + 1, sections.length - 1);
      highlight();
    } else if (event.key === 'k' || event.key === 'ArrowUp') {
      current = Math.max(current - 1, 0);
      highlight();
    } else if (event.key === 'a') {
      submitAction('accept');
    } else if (event.key === 'r') {
      submitAction('reject');
    }
  });

  highlight();
})();
`;

/**
 * Renders a full diffSnapshots() result as a single self-contained HTML
 * document with side-by-side before/after columns per file. The output has
 * no external dependencies (inline <style>, no network calls) so it can be
 * written to disk and opened directly, or served as-is. In non-interactive
 * mode the page has no <script> tag at all. In interactive mode, and only
 * when there is at least one file left to review, it also gets one inline
 * <script> (SHORTCUTS_SCRIPT) for keyboard shortcuts; it only calls
 * requestSubmit() on the accept/reject forms already in the page.
 */
function renderDiffHtml(diff, options = {}) {
  const title = options.title || 'snapview diff';
  const interactive = Boolean(options.interactive);

  const sections = [];

  for (const entry of diff.added) {
    sections.push(
      renderSection(
        'added',
        entry.file,
        renderWholeFileRows(entry.after, 'after'),
        interactive ? renderActions(entry.file) : ''
      )
    );
  }

  for (const entry of diff.removed) {
    sections.push(
      renderSection(
        'removed',
        entry.file,
        renderWholeFileRows(entry.before, 'before'),
        interactive ? renderActions(entry.file) : ''
      )
    );
  }

  for (const entry of diff.changed) {
    sections.push(
      renderSection(
        'changed',
        entry.file,
        renderHunkRows(entry.hunks),
        interactive ? renderActions(entry.file) : ''
      )
    );
  }

  const unchangedList = diff.unchanged
    .map((file) => `<li>${escapeHtml(file)}</li>`)
    .join('\n');

  const summary =
    `<p class="summary">` +
    `${diff.added.length} added, ${diff.removed.length} removed, ` +
    `${diff.changed.length} changed, ${diff.unchanged.length} unchanged` +
    '</p>';

  const remaining = diff.added.length + diff.removed.length + diff.changed.length;
  const remainingHtml = interactive
    ? `<p class="remaining">${remaining} remaining</p>\n` +
      '<p class="shortcuts">shortcuts: j/k move, a accept, r reject</p>\n'
    : '';

  const unchangedSection = diff.unchanged.length
    ? `<section class="unchanged">\n<h2>unchanged</h2>\n<ul>\n${unchangedList}\n</ul>\n</section>`
    : '';

  const scriptTag = interactive && remaining > 0 ? `<script>${SHORTCUTS_SCRIPT}</script>\n` : '';

  return (
    '<!doctype html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    `<title>${escapeHtml(title)}</title>\n` +
    `<style>${STYLE}</style>\n` +
    '</head>\n' +
    '<body>\n' +
    `<h1>${escapeHtml(title)}</h1>\n` +
    `${summary}\n` +
    remainingHtml +
    `${sections.join('\n')}\n` +
    `${unchangedSection}\n` +
    scriptTag +
    '</body>\n' +
    '</html>\n'
  );
}

const STYLE =
  'body{font-family:monospace;margin:1.5rem;}' +
  '.summary{color:#555;}' +
  'table.side-by-side{border-collapse:collapse;width:100%;margin-bottom:1.5rem;}' +
  'table.side-by-side td,table.side-by-side th{border:1px solid #ddd;padding:2px 6px;text-align:left;vertical-align:top;}' +
  'td.lineno{color:#999;width:3em;text-align:right;user-select:none;}' +
  'td.code{white-space:pre;}' +
  'tr.add td.code{background:#e6ffed;}' +
  'tr.remove td.code{background:#ffeef0;}' +
  'section.file h2{font-size:1rem;}' +
  'span.status{text-transform:uppercase;font-size:0.75rem;color:#888;}' +
  '.actions{margin:0.25rem 0 0.75rem;display:flex;gap:0.5rem;}' +
  '.actions form{margin:0;}' +
  'button.accept{color:#036b26;}' +
  'button.reject{color:#b00020;}' +
  '.remaining{font-weight:bold;}' +
  '.shortcuts{color:#777;font-size:0.85rem;}' +
  'section.file.current{outline:2px solid #1a73e8;outline-offset:2px;}';

module.exports = { renderDiffHtml, escapeHtml };
