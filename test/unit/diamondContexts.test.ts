import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import sources from '../fixtures/diamondContexts.json';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const entry of sources.valid) {
  const { source, expression, nodeType } = entry;
  test(`preserves inferred and explicit type-argument contexts: ${expression}`, () => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const declarators = tree.rootNode.descendantsOfType('variable_declarator');
      expect(declarators).toHaveLength(1);
      const value = declarators[0]!.childForFieldName('value')!;
      expect(value.type).toBe(nodeType);
      expect(value.text).toBe(expression);
      const start = source.indexOf(expression);
      expect([value.startIndex, value.endIndex]).toEqual([start, start + expression.length]);
      if (entry.type !== undefined) {
        const target = value.childForFieldName('type')!;
        const typeStart = source.indexOf(entry.type, start);
        expect(target.text).toBe(entry.type);
        expect([target.startIndex, target.endIndex]).toEqual([typeStart, typeStart + entry.type.length]);
        const typeArguments = target.descendantsOfType('type_arguments');
        expect(typeArguments.map((node) => node.text)).toEqual(entry.typeArguments);
      }
      expect(value.childForFieldName('type_arguments')?.text).toBe(entry.explicitArguments);
      expect(tree.rootNode.lastNamedChild?.childForFieldName('name')?.text).toBe('After');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const source of sources.invalid) {
  test(`rejects an empty type-argument list outside the instantiated type: ${source}`, () => {
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
