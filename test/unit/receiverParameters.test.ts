import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { Edit, Language, Parser, type Node } from '@willbooster/web-tree-sitter';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('retains annotated receiver roles beside ordinary parameters', () => {
  const parser = new Parser();
  parser.setLanguage(language);
  try {
    for (const annotation of ['', '@Owned ', '@Owned() ', '@Owned(value = 1) ', '@A @B ', '@pkg.Owned /* trivia */ ']) {
      for (const type of ['C', 'C<T>', 'Outer.Inner', 'Outer<T>.Inner<U>']) {
        const source = `class C { void method(${annotation}${type} this, @Owned C ordinary) {} }`;
        const tree = parser.parse(source)!;
        try {
          expect(tree.rootNode.hasError, source).toBe(false);
          const [receiver] = tree.rootNode.descendantsOfType('receiver_parameter');
          expect(receiver?.text, source).toBe(`${annotation}${type} this`);
          expect(receiver?.children.at(-1)?.type, source).toBe('this');
          expect(
            tree.rootNode.descendantsOfType('formal_parameter').map((node) => node.childForFieldName('name')?.text)
          ).toEqual(['ordinary']);
        } finally {
          tree.delete();
        }
      }
    }
    const tree = parser.parse('class Outer { class Inner { Inner(@Owned Outer Outer.this, int value) {} } }')!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.descendantsOfType('receiver_parameter').map((node) => node.text)).toEqual([
        '@Owned Outer Outer.this',
      ]);
    } finally {
      tree.delete();
    }
  } finally {
    parser.delete();
  }
});

test('preserves receiver roles when annotations are inserted and removed', () => {
  const parser = new Parser();
  parser.setLanguage(language);
  const original = 'class C { void method(C this, C ordinary) {} }';
  const index = original.indexOf('C this');
  const annotation = '@Owned ';
  const annotated = original.slice(0, index) + annotation + original.slice(index);
  let tree = parser.parse(original)!;
  try {
    for (const inserting of [true, false, true, false]) {
      tree.edit(
        new Edit({
          startIndex: index,
          oldEndIndex: index + (inserting ? 0 : annotation.length),
          newEndIndex: index + (inserting ? annotation.length : 0),
          startPosition: { row: 0, column: index },
          oldEndPosition: { row: 0, column: index + (inserting ? 0 : annotation.length) },
          newEndPosition: { row: 0, column: index + (inserting ? annotation.length : 0) },
        })
      );
      const source = inserting ? annotated : original;
      const next = parser.parse(source, tree)!;
      tree.delete();
      tree = next;
      const fresh = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(tree.rootNode.descendantsOfType('receiver_parameter')).toHaveLength(1);
        expect(snapshot(tree.rootNode)).toEqual(snapshot(fresh.rootNode));
      } finally {
        fresh.delete();
      }
    }
  } finally {
    tree.delete();
    parser.delete();
  }
});

function snapshot(node: Node): unknown {
  return [node.type, node.startIndex, node.endIndex, node.startPosition, node.endPosition, node.children.map(snapshot)];
}
