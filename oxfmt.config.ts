// wbfy:start oxfmt-base
import type { OxfmtConfig } from 'oxfmt';

// oxlint-disable unicorn/prefer-module -- Oxfmt config files are only auto-discovered as .ts, and CommonJS avoids ESM package loading issues.
const oxfmtConfig = require('@willbooster/oxfmt-config');

const oxfmtResolvedConfig: OxfmtConfig = oxfmtConfig.default ?? oxfmtConfig;
// wbfy:end oxfmt-base

// Preserve the generator's output style and upstream grammar layout so source comparisons stay readable.
oxfmtResolvedConfig.ignorePatterns = [
  ...(oxfmtResolvedConfig.ignorePatterns ?? []),
  'bindings/**',
  'grammar.js',
  'src/**',
];

// wbfy:start oxfmt-export
module.exports = oxfmtResolvedConfig;
// wbfy:end oxfmt-export
