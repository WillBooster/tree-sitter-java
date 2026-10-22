# @willbooster/tree-sitter-java

[![npm version](https://img.shields.io/npm/v/@willbooster/tree-sitter-java.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-java)
[![license](https://img.shields.io/npm/l/@willbooster/tree-sitter-java.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-java)
[![Test](https://github.com/WillBooster/tree-sitter-java/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-java/actions/workflows/test.yml)
[![Test rust](https://github.com/WillBooster/tree-sitter-java/actions/workflows/test-rust.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-java/actions/workflows/test-rust.yml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![wbfy](https://img.shields.io/badge/wbfy-20.45.0-1e90ff.svg)](https://github.com/WillBooster/shared/tree/main/packages/wbfy)
[![crates.io](https://img.shields.io/crates/v/willbooster-tree-sitter-java.svg)](https://crates.io/crates/willbooster-tree-sitter-java)

Java grammar for [tree-sitter](https://github.com/tree-sitter/tree-sitter), forked from
[tree-sitter/tree-sitter-java](https://github.com/tree-sitter/tree-sitter-java). We are grateful
to its authors and contributors. This is not an official release of that project.

This fork is based on tree-sitter-java 0.23.5 and accepts annotation and `final` modifiers on switch and
`instanceof` type patterns and typed record-pattern components, plus qualified names in record patterns. Unnamed
pattern variables use `underscore_pattern` nodes. Binding annotations are direct children of `type_pattern`,
`instanceof_expression`, or `record_pattern_component`; an `instanceof` type test without a binding keeps its
annotations inside the `right` field's `annotated_type` node.

Annotation interface declarations expose separate `@` and `interface` tokens.
Postfix updates appear inside surrounding cast or unary nodes. An `update_expression` has a primary expression as its operand.

The parser ships as compact tables under the [WillBooster/tree-sitter](https://github.com/WillBooster/tree-sitter)
fork's ABI (`0x57420009`). This package is tested with runtime 13.0.0. Runtimes with a different ABI, including
upstream's tree-sitter, reject the parser.

## Usage

The npm package ships `tree-sitter-java.wasm` for
[@willbooster/web-tree-sitter](https://www.npmjs.com/package/@willbooster/web-tree-sitter) version 13.0.0 or later within major version 13, which runs in Node.js, Bun, browsers, and Cloudflare Workers. In Node.js and Bun, load the grammar from its path:

```js
import { fileURLToPath } from 'node:url';
import { Language, Parser } from '@willbooster/web-tree-sitter';

await Parser.init();
const parser = new Parser();
const wasmPath = fileURLToPath(import.meta.resolve('@willbooster/tree-sitter-java/tree-sitter-java.wasm'));
const language = await Language.load(wasmPath);
parser.setLanguage(language);
const tree = parser.parse('class Main { int answer() { return 42; } }\n');
```

In browsers, serve both `.wasm` files and load them by URL (the example uses Vite's `?url` imports):

```js
import { Language, Parser } from '@willbooster/web-tree-sitter';
import runtimeUrl from '@willbooster/web-tree-sitter/web-tree-sitter.wasm?url';
import javaUrl from '@willbooster/tree-sitter-java/tree-sitter-java.wasm?url';

await Parser.init({ locateFile: () => runtimeUrl });
const parser = new Parser();
parser.setLanguage(await Language.load(javaUrl));
```

Cloudflare Workers do not allow compiling Wasm at run time, so import both `.wasm` files as modules, with or without
Node.js compatibility:

```js
import { Language, Parser } from '@willbooster/web-tree-sitter';
import runtime from '@willbooster/web-tree-sitter/web-tree-sitter.wasm';
import java from '@willbooster/tree-sitter-java/tree-sitter-java.wasm';

await Parser.init({ wasmModule: runtime });
const parser = new Parser();
parser.setLanguage(await Language.load(java));
```

The package also ships `grammar.js`, the queries in `queries/`, and the node types in `src/node-types.json`.

### Queries

Query patterns use the node types and fields in `src/node-types.json`. A label after `@` names a capture chosen by the
query author; `name:` selects the declaration's name field. See the [query syntax guide](https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html)
for the general syntax.

Using `language` and `tree` from the Node.js example, capture class names with the runtime's query API:

```js
import { Query } from '@willbooster/web-tree-sitter';

const query = new Query(language, '(class_declaration name: (identifier) @class.name)');
for (const { name, node } of query.captures(tree.rootNode)) {
  console.log(name, node.text);
}
query.delete();
```

The following patterns capture names of classes, interfaces, enums, records and annotation interfaces:

```scheme
[
  (class_declaration name: (identifier) @type.name)
  (interface_declaration name: (identifier) @type.name)
  (enum_declaration name: (identifier) @type.name)
  (record_declaration name: (identifier) @type.name)
  (annotation_type_declaration name: (identifier) @type.name)
]
```

Capture method names with:

```scheme
(method_declaration name: (identifier) @method.name)
```

Annotations with and without arguments use different node types. The wildcard captures both simple and qualified
annotation names:

```scheme
[
  (marker_annotation name: (_) @annotation.name)
  (annotation name: (_) @annotation.name)
]
```

Filter a captured name by its text with `#eq?`:

```scheme
(class_declaration
  name: (identifier) @class.name
  (#eq? @class.name "Main"))
```

Within a declaration's `modifiers`, access keywords are named `visibility` nodes and other modifier keywords are
named `modifier` nodes. Annotations retain their own nodes, and the keyword tokens remain available for highlighting.
For example, this query captures explicitly public static methods without matching annotation text:

```scheme
(method_declaration
  (modifiers (visibility) @visibility (modifier) @modifier)
  name: (identifier) @method
  (#eq? @visibility "public")
  (#eq? @modifier "static"))
```

### Rust

In Rust, depend on the [crate](https://crates.io/crates/willbooster-tree-sitter-java) and on
[willbooster-tree-sitter](https://crates.io/crates/willbooster-tree-sitter), the runtime this package is tested and
fuzzed with:

```toml
[dependencies]
tree-sitter = { package = "willbooster-tree-sitter", version = "13.0.0" }
tree-sitter-java = { package = "willbooster-tree-sitter-java", version = "11" }
```

```rust
let mut parser = tree_sitter::Parser::new();
parser.set_language(&tree_sitter_java::LANGUAGE.into())?;
```

## Development

```sh
mise install
bun install --frozen-lockfile
bun run test/ci-setup # installs Chromium for the browser test
bun run build/ci
bun run test
script/parse-examples
cargo test
```

The scripts and tests generate, build, test, and parse with `script/tree-sitter`, the tree-sitter CLI of the
WillBooster/tree-sitter runtime version locked in `Cargo.lock`, since the generator and the runtime of upstream's CLI are
not the ones this package ships with. Its first run downloads that CLI from the runtime's GitHub Release, or builds it
with `cargo` (whose build runs the CMake that `mise.toml` pins) when the download fails or the release has no binary that runs here. Run other CLI commands through it as
well (e.g. `script/tree-sitter parse File.java`).

`grammar.js` keeps upstream's code layout so changes can be compared with upstream's grammar; the linter and formatter
skip it.

`bun run generate` records a fresh generation profile from the applicable `test/corpus` cases and any Git-tracked
files in `examples/`, then generates compact parser tables. The parser also embeds metadata from `tree-sitter.json`. After changing a grammar,
`tree-sitter.json`, a corpus case, a tracked example, or the `willbooster-tree-sitter` version in `Cargo.lock` (whose
CLI generates the parser),
regenerate and commit `src/`. Stage added or removed examples with `git add -A examples` before generation so the profile uses the intended file list.
Profiles in `.tmp/generation-profiles/` are temporary and must not be committed. `bun run build-wasm`, `bun run build/ci`,
and the release build regenerate the parsers before compiling them.

`bun run test` runs:

- the corpus in `test/corpus`, with the native build and with the Wasm build (the first run downloads the WASI SDK);
- an incremental-parsing check (`test/unit/incremental.test.ts`): `script/fuzz-corpus` runs `tree-sitter fuzz`, which
  edits each corpus case at random, reparses it, undoes the edits, and reparses again. `TREE_SITTER_SEED`,
  `TREE_SITTER_ITERATIONS`, and `TREE_SITTER_EDITS` run other or more edits;
- a check that the real-world Java files of the repositories cloned into `examples/` fail to parse exactly as listed in
  `script/known-failures.txt`. The first run clones the repositories. The example
  repositories are pinned to commits in `script/parse-examples`. After a grammar change or a moved pin alters that
  list, `script/parse-examples` rewrites it; review its diff before committing;
- a performance check (`test/unit/performance.test.ts`) that recovering from an error on each line takes linear
  time, since consumers parse files while they are being edited. It loads the Wasm build through
  @willbooster/web-tree-sitter, which `bun run build/ci` rebuilds after regenerating the parser;
- a check (`test/unit/runtimeVersion.test.ts`) that `@willbooster/web-tree-sitter` in `package.json` and
  `willbooster-tree-sitter` in `Cargo.lock` are the same version, since the Wasm tests run on the former and the Rust
  tests, the fuzzer, and the CLI on the latter;
- tests that load the Wasm build with @willbooster/web-tree-sitter in Chromium (`test/e2e/browser.test.ts`) and in
  Cloudflare Workers with and without Node.js compatibility (`test/e2e/workers.test.ts`).

The tests and `script/parse-examples` compile the parser into `.tmp/tree-sitter-lib` rather than the CLI's cache shared
by every checkout; `script/fuzz-corpus` builds a parser of its own in `.tmp/fuzz` for each run and deletes it
afterwards.

CI also runs these tests on Linux arm64 and macOS, where the CLI compiles the parser with each platform's C compiler,
and fuzzes the parser with libFuzzer and sanitizers (`.github/workflows/robustness.yml`).
