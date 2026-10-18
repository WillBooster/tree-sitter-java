import { expect, test } from 'vitest';
import path from 'node:path';
import { Language, Parser } from '@willbooster/web-tree-sitter';

await Parser.init();
const language = await Language.load(path.join(import.meta.dirname, '../../tree-sitter-java.wasm'));

for (const literal of [
  String.raw`'\u005c\u005c'`,
  String.raw`'\uu005C\uuu005c'`,
  String.raw`'\u005c\'`,
  String.raw`'\u005c''`,
  String.raw`'\u005cn'`,
  String.raw`'\uuu0041'`,
  String.raw`'\\'`,
  String.raw`'\''`,
]) {
  test(`preserves adjacent declarations after ${literal}`, () => {
    const parser = new Parser();
    parser.setLanguage(language);
    const tree = parser.parse(`class C { char a = ${literal}; char b = 'x'; int after; }`)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.descendantsOfType('field_declaration')).toHaveLength(3);
      expect(tree.rootNode.descendantsOfType('character_literal').map((node) => node.text)).toEqual([literal, "'x'"]);
      expect(
        tree.rootNode.descendantsOfType('variable_declarator').map((node) => node.childForFieldName('name')?.text)
      ).toEqual(['a', 'b', 'after']);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}
