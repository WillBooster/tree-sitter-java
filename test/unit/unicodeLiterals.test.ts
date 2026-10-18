import { expect, test } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { Language, Parser, Query } from '@willbooster/web-tree-sitter';

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

for (const [escape, suffix] of [
  [String.raw`\u005c\u005c`, ''],
  [String.raw`\uu005C\uuu005c`, ''],
  [String.raw`\u005c\u006e`, ''],
  [String.raw`\u005c\u0022`, ''],
  [String.raw`\uu005C\uuu0074`, ''],
  [String.raw`\\`, ''],
  [String.raw`\u005c\u003123`, ''],
  [String.raw`\u005c1\u00323`, ''],
  [String.raw`\u005c\u0031\u0032\u0033`, '4'],
  [String.raw`\u005c\u00377`, '7'],
  [String.raw`\u005c77`, '7'],
  [String.raw`\77`, '7'],
  [String.raw`\u005c\u0030`, '8'],
] as const) {
  test(`retains the complete string escape ${escape}`, () => {
    const source = `class C { String a = "${escape}${suffix}"; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    const query = new Query(
      language,
      fs.readFileSync(path.join(import.meta.dirname, '../../queries/highlights.scm'), 'utf8')
    );
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(
        tree.rootNode.descendantsOfType('escape_sequence').map((node) => [node.text, node.startIndex, node.endIndex])
      ).toEqual([[escape, source.indexOf(escape), source.indexOf(escape) + escape.length]]);
      expect(tree.rootNode.descendantsOfType('string_fragment').map((node) => node.text)).toEqual(
        suffix ? [suffix] : []
      );
      expect(
        query
          .captures(tree.rootNode)
          .filter(({ name }) => name === 'string.escape')
          .map(({ node }) => node.text)
      ).toEqual([escape]);
      expect(tree.rootNode.descendantsOfType('field_declaration')).toHaveLength(2);
    } finally {
      query.delete();
      tree.delete();
      parser.delete();
    }
  });
}
