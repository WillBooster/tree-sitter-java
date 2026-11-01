import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import sources from '../fixtures/referenceTypeArguments.json';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const entry of sources.valid) {
  const { source, type, arguments: expectedArguments } = entry;
  test(`preserves reference type arguments and ranges: ${type}`, () => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const fields = tree.rootNode.descendantsOfType('field_declaration');
      expect(fields).toHaveLength(1);
      const target = fields[0]!.childForFieldName('type')!;
      const start = source.indexOf(`${type} value`);
      expect(target.text).toBe(type);
      expect([target.startIndex, target.endIndex]).toEqual([start, start + type.length]);
      const typeArguments = target.descendantsOfType('type_arguments');
      expect(typeArguments.map((node) => node.text)).toEqual(expectedArguments);
      let cursor = start;
      for (const [index, argument] of typeArguments.entries()) {
        const text = expectedArguments[index]!;
        const argumentStart = source.indexOf(text, cursor);
        expect([argument.startIndex, argument.endIndex]).toEqual([argumentStart, argumentStart + text.length]);
        cursor = argumentStart + 1;
      }
      for (const array of target.descendantsOfType('array_type')) {
        expect(array.childrenForFieldName('element')).toHaveLength(1);
        expect(array.childForFieldName('dimensions')).toBeTruthy();
      }
      if (entry.value !== undefined) {
        const value = fields[0]!.childForFieldName('declarator')!.childForFieldName('value')!;
        expect(value.type).toBe(entry.valueType);
        expect(value.text).toBe(entry.value);
        const valueStart = source.indexOf(entry.value);
        expect([value.startIndex, value.endIndex]).toEqual([valueStart, valueStart + entry.value.length]);
        expect(value.childForFieldName('type_arguments')?.text).toBe(entry.valueArgument);
      }
      expect(tree.rootNode.lastNamedChild?.childForFieldName('name')?.text).toBe('After');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const source of sources.invalid) {
  test(`rejects a primitive scalar type argument or wildcard bound: ${source}`, () => {
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
