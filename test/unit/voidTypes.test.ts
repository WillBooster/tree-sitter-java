import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

import sources from '../fixtures/voidTypes.json';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const { source, voidOwners } of sources.valid) {
  test(`preserves supported void uses and ordinary types: ${source}`, () => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const types = tree.rootNode.descendantsOfType('void_type');
      expect(types.map((node) => node.parent?.type)).toEqual(voidOwners);
      const spelling = source.includes(String.raw`v\u006fid`) ? String.raw`v\u006fid` : 'void';
      let cursor = 0;
      for (const type of types) {
        const start = source.indexOf(spelling, cursor);
        expect(type.text).toBe(spelling);
        expect([type.startIndex, type.endIndex]).toEqual([start, start + spelling.length]);
        cursor = start + spelling.length;
        if (type.parent!.type === 'method_declaration') {
          expect(type.parent!.childForFieldName('type')?.equals(type)).toBe(true);
          expect(type.parent!.childForFieldName('name')?.text).toBe('run');
        } else {
          expect(type.parent!.text).toBe(`${type.text}.class`);
        }
      }
      expect(tree.rootNode.lastNamedChild?.childForFieldName('name')?.text).toBe('After');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const source of sources.invalid) {
  test(`reports void outside a result or class literal: ${source}`, () => {
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
