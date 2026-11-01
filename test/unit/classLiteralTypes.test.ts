import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import sources from '../fixtures/classLiteralTypes.json';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const { source, expression } of sources.valid) {
  test(`preserves class-literal ownership and ranges: ${expression}`, () => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const literals = tree.rootNode.descendantsOfType('class_literal');
      expect(literals).toHaveLength(1);
      const literal = literals[0]!;
      expect(literal.text).toBe(expression);
      const start = source.indexOf(expression);
      expect([literal.startIndex, literal.endIndex]).toEqual([start, start + expression.length]);
      expect(literal.parent?.childForFieldName('value')?.equals(literal)).toBe(true);
      expect(tree.rootNode.lastNamedChild?.childForFieldName('name')?.text).toBe('After');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const source of sources.invalid) {
  test(`rejects a parameterized or annotated class literal: ${source}`, () => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(true);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}
