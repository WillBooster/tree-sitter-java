import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import sources from '../fixtures/objectCreationTypes.json';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const { source, expression, type, nodeType } of sources.valid) {
  test(`preserves creation type, ownership and ranges: ${expression}`, () => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const creations = tree.rootNode.descendantsOfType(['object_creation_expression', 'array_creation_expression']);
      expect(creations).toHaveLength(1);
      const creation = creations[0]!;
      expect(creation.type).toBe(nodeType);
      expect(creation.text).toBe(expression);
      const start = source.indexOf(expression);
      expect([creation.startIndex, creation.endIndex]).toEqual([start, start + expression.length]);
      expect(creation.parent?.childForFieldName('value')?.equals(creation)).toBe(true);
      const target = creation.childForFieldName('type')!;
      const typeStart = source.indexOf(type, start);
      expect(target.text).toBe(type);
      expect([target.startIndex, target.endIndex]).toEqual([typeStart, typeStart + type.length]);
      if (nodeType === 'object_creation_expression') expect(creation.childForFieldName('arguments')?.text).toBe('()');
      else expect(creation.childForFieldName('dimensions')?.text).toBe('[1]');
      expect(tree.rootNode.lastNamedChild?.childForFieldName('name')?.text).toBe('After');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const source of sources.invalid) {
  test(`rejects a primitive constructor target: ${source}`, () => {
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
