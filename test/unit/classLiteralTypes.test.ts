import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import sources from '../fixtures/classLiteralTypes.json';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const entry of sources.valid) {
  const { source, expression, type } = entry;
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
      expect(literal.namedChildCount).toBe(1);
      const target = literal.firstNamedChild!;
      expect(target.text).toBe(type);
      expect([target.startIndex, target.endIndex]).toEqual([start, start + type.length]);
      if (entry.element !== undefined) {
        expect(target.childrenForFieldName('element')).toHaveLength(1);
        const element = target.childForFieldName('element')!;
        expect(element.text).toBe(entry.element);
        expect([element.startIndex, element.endIndex]).toEqual([start, start + entry.element.length]);
        expect(target.childForFieldName('dimensions')?.text).toBe(type.slice(entry.element.length));
      }
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
