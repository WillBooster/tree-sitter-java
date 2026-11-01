import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const literal of ['0x1p0', '0X1.P+2', '0x.8p-1', '0x1.8p1f', '0X1__A.B__CP1__0D']) {
  test(`parses the complete hexadecimal floating literal ${literal}`, () => {
    const source = `class C { double value = ${literal}; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const literals = tree.rootNode.descendantsOfType('hex_floating_point_literal');
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

for (const literal of ['0x1.0', '0x1.', '0x.8', '0x1.8p', '0x1.8p+']) {
  test(`reports an error for the incomplete hexadecimal floating literal ${literal}`, () => {
    const source = `class C { double value = ${literal}; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(true);
      expect(tree.rootNode.descendantsOfType('hex_floating_point_literal')).toHaveLength(0);
      const after = tree.rootNode.descendantsOfType('field_declaration').find((node) => node.text === 'int after;');
      expect(after?.parent?.type).toBe('class_body');
      expect(after?.startIndex).toBe(source.indexOf('int after;'));
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

test('retains hexadecimal integers without a binary exponent', () => {
  const source = 'class C { int value = 0x1A; int after; }';
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('hex_integer_literal').map((node) => node.text)).toEqual(['0x1A']);
    expect(tree.rootNode.descendantsOfType('hex_floating_point_literal')).toHaveLength(0);
    expect(tree.rootNode.descendantsOfType('field_declaration')).toHaveLength(2);
  } finally {
    tree.delete();
    parser.delete();
  }
});
