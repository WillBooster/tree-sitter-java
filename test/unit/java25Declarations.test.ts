import path from 'node:path';

import { Edit, Language, type Node, Parser } from '@willbooster/web-tree-sitter';
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

test('retains explicit constructor invocations after prologue statements and edits', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const invocation of ['super(x);', 'this(x);', '<T>super(x);', 'outer.super(x);', 'outer.<T>super(x);']) {
      const prologue = 'int y = x; if (x < 0) throw new IllegalArgumentException(); ';
      const original = `class C extends B { C(int x) { ${invocation} after(); } }`;
      const index = original.indexOf(invocation);
      let tree = parser.parse(original)!;
      try {
        let oldLength = 0;
        for (const prefix of [prologue, '', prologue]) {
          tree.edit(
            new Edit({
              startIndex: index,
              oldEndIndex: index + oldLength,
              newEndIndex: index + prefix.length,
              startPosition: { row: 0, column: index },
              oldEndPosition: { row: 0, column: index + oldLength },
              newEndPosition: { row: 0, column: index + prefix.length },
            })
          );
          const source = original.slice(0, index) + prefix + original.slice(index);
          const old = tree;
          tree = parser.parse(source, old)!;
          old.delete();
          const fresh = parser.parse(source)!;
          try {
            expect(tree.rootNode.hasError, source).toBe(false);
            expect(
              tree.rootNode.descendantsOfType('explicit_constructor_invocation').map((node) => node.text),
              source
            ).toEqual([invocation]);
            expect(snapshot(tree.rootNode)).toEqual(snapshot(fresh.rootNode));
            const body = tree.rootNode.descendantsOfType('constructor_body')[0]!;
            expect(body.namedChildren.at(-1)?.text).toBe('after();');
            expect(body.namedChildren.filter((node) => node.type === 'local_variable_declaration')).toHaveLength(
              prefix ? 1 : 0
            );
          } finally {
            fresh.delete();
          }
          oldLength = prefix.length;
        }
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

function snapshot(node: Node): unknown {
  return [node.type, node.startIndex, node.endIndex, node.startPosition, node.endPosition, node.children.map(snapshot)];
}
