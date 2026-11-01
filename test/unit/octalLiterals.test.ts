import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const literal of ['00', '0123', '0_7', '0__1__7L', '0777l']) {
  test(`parses the complete octal literal ${literal}`, () => {
    const source = `class C { long value = ${literal}; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const literals = tree.rootNode.descendantsOfType('octal_integer_literal');
      expect(literals.map((node) => [node.text, node.startIndex, node.endIndex])).toEqual([
        [literal, source.indexOf(literal), source.indexOf(literal) + literal.length],
      ]);
      expect(literals[0]!.parent?.childForFieldName('value')?.equals(literals[0]!)).toBe(true);
      expect(tree.rootNode.descendantsOfType('field_declaration')).toHaveLength(2);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const literal of ['0o17', '0O17', '0o7L', '0O7l']) {
  test(`reports an error for the non-Java octal prefix in ${literal}`, () => {
    const source = `class C { long value = ${literal}; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(true);
      expect(tree.rootNode.descendantsOfType('octal_integer_literal')).toHaveLength(0);
      const after = tree.rootNode.descendantsOfType('field_declaration').find((node) => node.text === 'int after;');
      expect(after?.parent?.type).toBe('class_body');
      expect(after?.startIndex).toBe(source.indexOf('int after;'));
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

test('keeps a single zero as a decimal integer', () => {
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse('class C { int value = 0; }')!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('decimal_integer_literal').map((node) => node.text)).toEqual(['0']);
    expect(tree.rootNode.descendantsOfType('octal_integer_literal')).toHaveLength(0);
  } finally {
    tree.delete();
    parser.delete();
  }
});
