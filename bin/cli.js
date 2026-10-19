#!/usr/bin/env node
'use strict';

const { main, CliError } = require('../src/cli');

main(process.argv.slice(2)).catch((err) => {
  if (err instanceof CliError) {
    console.error(err.message);
  } else {
    console.error(err.stack || err.message);
  }
  process.exitCode = 1;
});
