'use strict';

const { lineDiff } = require('../../src/lineDiff');

/**
 * A fixed diffSnapshots()-shaped result used by both the golden HTML
 * fixture and the renderHtml golden test, so the two never drift apart.
 */
const sampleDiff = {
  added: [{ file: 'new.snap', after: 'exports.value = "fresh";\n' }],
  removed: [{ file: 'old.snap', before: 'exports.value = "stale";\n' }],
  changed: [
    {
      file: 'button.snap',
      before: '<button>Save</button>\n<p>v1</p>\n',
      after: '<button>Save & Close</button>\n<p>v1</p>\n',
      hunks: lineDiff(
        '<button>Save</button>\n<p>v1</p>\n',
        '<button>Save & Close</button>\n<p>v1</p>\n'
      ),
    },
  ],
  unchanged: ['header.snap', 'footer.snap'],
};

module.exports = { sampleDiff };
