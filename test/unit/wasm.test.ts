import { testCommand } from './run.js';

// The package ships a Wasm build, which the WASI SDK's compiler builds instead of the native one, so the corpus is run
// on it as well. The first run downloads the WASI SDK.
testCommand(
  'parses the corpus in test/corpus as expected with the Wasm build',
  ['script/tree-sitter', 'test', '--wasm'],
  900_000
);
