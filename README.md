# @willbooster/tree-sitter-java

[![npm version](https://img.shields.io/npm/v/@willbooster/tree-sitter-java.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-java)
[![license](https://img.shields.io/npm/l/@willbooster/tree-sitter-java.svg)](https://www.npmjs.com/package/@willbooster/tree-sitter-java)
[![Test](https://github.com/WillBooster/tree-sitter-java/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-java/actions/workflows/test.yml)
[![Test rust](https://github.com/WillBooster/tree-sitter-java/actions/workflows/test-rust.yml/badge.svg)](https://github.com/WillBooster/tree-sitter-java/actions/workflows/test-rust.yml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![wbfy](https://img.shields.io/badge/wbfy-21.3.0-1e90ff.svg)](https://github.com/WillBooster/shared/tree/main/packages/wbfy)
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
Within a declaration's `modifiers`, access keywords are named `visibility` nodes and other modifier keywords are
named `modifier` nodes; annotations retain their own nodes.
Postfix updates appear inside surrounding cast or unary nodes. An `update_expression` has a primary expression as its operand.

The parser ships as compact tables under the [WillBooster/tree-sitter](https://github.com/WillBooster/tree-sitter)
fork's ABI (`0x5742000c`). This package is tested with runtime 20.0.0. Runtimes with a different ABI, including
upstream's tree-sitter, reject the parser.

## Support Scope

This fork maintains only full parsing: valid input (except keywords spelled with Unicode escapes, such as `\u0063lass`)
yields a correct tree, and invalid input yields `ERROR` or `MISSING` nodes without crashing, hanging, or taking more
than linear time. Incremental parsing and tree queries (including highlights, locals, injections, and tags) are not
supported. Node types, field names, and the trees that error recovery produces may change; such changes are released as
new major versions.

## Usage

The npm package ships `tree-sitter-java.wasm` for
[@willbooster/web-tree-sitter](https://www.npmjs.com/package/@willbooster/web-tree-sitter) version 20.0.0 or later within major version 20, which runs in Node.js, Bun, browsers, and Cloudflare Workers. In Node.js and Bun, load the grammar from its path:

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
import javaUrl from '@willbooster/tree-sitter-java/tree-sitter-java.wasm?url';
import { Language, Parser } from '@willbooster/web-tree-sitter';
import runtimeUrl from '@willbooster/web-tree-sitter/web-tree-sitter.wasm?url';

await Parser.init({ locateFile: () => runtimeUrl });
const parser = new Parser();
parser.setLanguage(await Language.load(javaUrl));
```

Cloudflare Workers do not allow compiling Wasm at run time, so import both `.wasm` files as modules, with or without
Node.js compatibility:

```js
import java from '@willbooster/tree-sitter-java/tree-sitter-java.wasm';
import { Language, Parser } from '@willbooster/web-tree-sitter';
import runtime from '@willbooster/web-tree-sitter/web-tree-sitter.wasm';

await Parser.init({ wasmModule: runtime });
const parser = new Parser();
parser.setLanguage(await Language.load(java));
```

The package also ships `grammar.js` and the node types in `src/node-types.json`.

### Rust

In Rust, depend on the [crate](https://crates.io/crates/willbooster-tree-sitter-java) and on
[willbooster-tree-sitter](https://crates.io/crates/willbooster-tree-sitter), the runtime this package is tested and
fuzzed with:

```sh
cargo add willbooster-tree-sitter@20.0.0 --rename tree-sitter
cargo add willbooster-tree-sitter-java --rename tree-sitter-java
```

```rust
let mut parser = tree_sitter::Parser::new();
parser.set_language(&tree_sitter_java::LANGUAGE.into())?;
let tree = parser.parse("class Main { int answer() { return 42; } }\n").unwrap();
```

## Development

Install [mise](https://mise.jdx.dev/getting-started.html), [rustup](https://rustup.rs/), and a C compiler. From a fresh checkout, run:

```sh
mise install
bun install --frozen-lockfile
bun run test/ci-setup
bun run build/ci
bun run verify
bun run test
cargo test --locked
```

Run Tree-sitter CLI commands through `script/tree-sitter`.

`grammar.js` keeps upstream's code layout so changes can be compared with upstream's grammar.

Run `bun run build/ci` and commit the updated `src/` files after changing any of:

- `grammar.js`
- `tree-sitter.json`
- `test/corpus/`
- Git-tracked files in `examples/` — stage additions or removals with `git add -A examples` before regenerating
- `willbooster-tree-sitter` in `Cargo.lock` — keep `@willbooster/web-tree-sitter` in `package.json` at the same version

Run `script/parse-examples` to update `script/known-failures.txt` when a grammar change or a moved commit pin in `script/parse-examples` changes which real-world Java files fail to parse.
