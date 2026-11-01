import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const literal of [
  "'a'",
  "'™'",
  String.raw`'\b'`,
  String.raw`'\s'`,
  String.raw`'\177'`,
  String.raw`'\377'`,
  String.raw`'\47'`,
  String.raw`'\7'`,
  String.raw`'\u0041'`,
  String.raw`'\uD800'`,
  String.raw`'\u005c''`,
  String.raw`'\u005c\'`,
  String.raw`'\u005c\u005c'`,
  String.raw`'\u005c\u006e'`,
  String.raw`'\u005c\u003123'`,
  String.raw`'\u005c1\u00323'`,
  String.raw`'\u005c\u0031\u0032\u0033'`,
  String.raw`'\u005c\u0027'`,
  String.raw`\u0027a\u0027`,
  String.raw`'\uu005C\uuu005c'`,
  String.raw`'\uuu0041'`,
  String.raw`'\\'`,
  String.raw`'\''`,
  String.raw`'\n'`,
  String.raw`'\t'`,
  String.raw`'\f'`,
  String.raw`'\r'`,
  String.raw`'\1\u0032'`,
  String.raw`'\0\u0030'`,
  String.raw`'\3\u0037\u0037'`,
  String.raw`'\7\u0037'`,
  String.raw`'\u005c\\u0027`,
  String.raw`'\u005C\\u0027`,
  String.raw`\u0027\u005C\\u0027`,
]) {
  test(`parses the complete character literal ${JSON.stringify(literal)}`, () => {
    const source = `class C { char value = ${literal}; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const literals = tree.rootNode.descendantsOfType('character_literal');
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

for (const literal of [
  "''",
  "'xx'",
  String.raw`'\NUL'`,
  String.raw`'\q'`,
  String.raw`'\u{41}'`,
  String.raw`'\x41'`,
  String.raw`'\u000a'`,
  String.raw`'\u000d'`,
  String.raw`'\u0027'`,
  String.raw`'\u005c'`,
  String.raw`'\\u006e'`,
  String.raw`'\400'`,
  String.raw`'\777'`,
  "'😀'",
  "'\r'",
  "'\n'",
  String.raw`'\u0\''`,
  String.raw`'\u0\u005c'`,
  String.raw`'\u\uu005C'`,
  String.raw`'\u00Z\u005c'`,
  String.raw`'\u0\n'`,
  String.raw`'\u0 \u0041'`,
  String.raw`'x\u0\n'`,
  String.raw`'\u0\u0'`,
  String.raw`'\u{1}\u{2}'`,
  String.raw`'\u\u'`,
  String.raw`'\uu{1F600}'`,
  String.raw`'\u00'`,
  String.raw`'\u'`,
  String.raw`'\uzz'`,
  String.raw`'\u00ZZ'`,
  String.raw`'\4\u0030\u0030'`,
  String.raw`'\\u0031'`,
  String.raw`'\1\u0038'`,
]) {
  test(`reports an error for the malformed character literal ${JSON.stringify(literal)}`, () => {
    const source = `class C { char value = ${literal}; int after; }`;
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
