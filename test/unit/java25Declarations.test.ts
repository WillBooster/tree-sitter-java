import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(path.join(import.meta.dirname, '../../tree-sitter-java.wasm'));

test('distinguishes module imports from ordinary and static imports', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const name of ['java.base', 'java.sql', 'my.module', 'module', 'open.record']) {
      const source = `import module ${name}; class C {}`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        const declaration = tree.rootNode.descendantsOfType('import_declaration')[0]!;
        expect(
          declaration.children.some((node) => node.type === 'module' && !node.isNamed),
          source
        ).toBe(true);
        expect(declaration.namedChildren.at(-1)?.text, source).toBe(name);
      } finally {
        tree.delete();
      }
    }
    for (const source of [
      'import module.Type;',
      'import module.*;',
      'import static module.Type.FIELD;',
      'import static module.Type.*;',
    ]) {
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        expect(
          tree.rootNode.descendantsOfType('import_declaration')[0]?.children.some((node) => node.type === 'module'),
          source
        ).toBe(false);
      } finally {
        tree.delete();
      }
    }
    for (const source of ['import module java.base.*;', 'import static module java.base;']) {
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(true);
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('retains explicit constructor invocations after prologue statements', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const invocation of ['super(x);', 'this(x);', '<T>super(x);', 'outer.super(x);', 'outer.<T>super(x);']) {
      for (const prologue of ['', 'int y = x; if (x < 0) throw new IllegalArgumentException(); ']) {
        const source = `class C extends B { C(int x) { ${prologue}${invocation} after(); } }`;
        const tree = parser.parse(source)!;
        try {
          expect(tree.rootNode.hasError, source).toBe(false);
          expect(
            tree.rootNode.descendantsOfType('explicit_constructor_invocation').map((node) => node.text),
            source
          ).toEqual([invocation]);
          const body = tree.rootNode.descendantsOfType('constructor_body')[0]!;
          expect(body.namedChildren.at(-1)?.text, source).toBe('after();');
          expect(
            body.namedChildren.filter((node) => node.type === 'local_variable_declaration'),
            source
          ).toHaveLength(prologue ? 1 : 0);
        } finally {
          tree.delete();
        }
      }
    }
  } finally {
    parser.delete();
  }
});
