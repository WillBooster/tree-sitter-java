import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

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
