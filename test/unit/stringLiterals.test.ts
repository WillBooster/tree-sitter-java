import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const literal of [
  '""',
  '"plain"',
  String.raw`"\b"`,
  String.raw`"\s"`,
  String.raw`"\\"`,
  String.raw`"\'"`,
  String.raw`"\""`,
  String.raw`"\177"`,
  String.raw`"\7"`,
  String.raw`"\400"`,
  String.raw`"\777"`,
  String.raw`"\1\u0032"`,
  String.raw`"\3\u0037\u0037"`,
  String.raw`"\\u006e"`,
  String.raw`"\u0041"`,
  String.raw`"\uuu0041"`,
  String.raw`"\u005c\u006e"`,
  String.raw`"\u005c1\u00323"`,
  String.raw`"\u005c\u0031\u0032\u0033"`,
  String.raw`"\uD83D\uDE00"`,
  '"😀"',
  String.raw`"/* \" */"`,
  String.raw`\u0022hello\u0022`,
  String.raw`"hello\u0022`,
  String.raw`\u0022hello"`,
  String.raw`"\u005c\u0022"`,
  String.raw`"""
"""`,
  String.raw`"""
text
"""`,
  '""" \t\f\r\nbody\r\n"""',
  String.raw`"""
"quoted"
"""`,
  String.raw`"""
a\
b
"""`,
  '"""\na\\\r\nb\n"""',
  '"""\na\\\rb\n"""',
  String.raw`\u0022\u0022\u0022
body
\u0022\u0022\u0022`,
  String.raw`"""
body\u0022"\u0022`,
  String.raw`"""\u000abody
"""`,
  String.raw`"""\u0020\u0009\u000c\u000d\u000abody
"""`,
  String.raw`"""
\u0022a\u0022\u0022
"""`,
  String.raw`"""
\u000a
"""`,
  String.raw`"\u005c\\u0071"`,
  String.raw`"\u005c\\u0022`,
  String.raw`"""
\u005c\\u0022\u0022\u0022`,
  String.raw`"\u005c\x"`,
  String.raw`"\u005c\U0071"`,
]) {
  test(`parses the complete string literal ${JSON.stringify(literal)}`, () => {
    const source = `class C { String value = ${literal}; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const literals = tree.rootNode.descendantsOfType('string_literal');
      expect(literals.map((node) => [node.text, node.startIndex, node.endIndex])).toEqual([
        [literal, source.indexOf(literal), source.indexOf(literal) + literal.length],
      ]);
      expect(literals[0]!.parent?.childForFieldName('value')?.equals(literals[0]!)).toBe(true);
      expect(literals[0]!.descendantsOfType(['line_comment', 'block_comment'])).toHaveLength(0);
      expect(tree.rootNode.descendantsOfType('field_declaration')).toHaveLength(2);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const literal of [
  String.raw`"\q"`,
  String.raw`"\a"`,
  String.raw`"\v"`,
  String.raw`"\?"`,
  String.raw`"\x41"`,
  String.raw`"\u{41}"`,
  String.raw`"\u00"`,
  String.raw`"\u00ZZ"`,
  String.raw`"\8"`,
  String.raw`"a
b"`,
  '"a\rb"',
  String.raw`"a\
b"`,
  '"a\\\r\nb"',
  String.raw`"\u000a"`,
  String.raw`"\u000d"`,
  String.raw`"\u0022"`,
  String.raw`"\u005c\u0071"`,
  String.raw`"\u005cq"`,
  '"""no newline"""',
  String.raw`""" 	X
text
"""`,
  '""""""',
  String.raw`"""
\q
"""`,
  String.raw`"""
\x41
"""`,
  String.raw`"""
\u{41}
"""`,
  String.raw`""" 
body
"""`,
  String.raw`"\u005c\uZZZZ"`,
  String.raw`"\u005c\u"`,
]) {
  test(`reports an error for the malformed string literal ${JSON.stringify(literal)}`, () => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(`class C { String value = ${literal}; int after; }`)!;
    try {
      expect(tree.rootNode.hasError).toBe(true);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const [kind, opening, closing] of [
  ['ordinary string', '"', '"'],
  ['text block', '"""\n', '\n"""'],
] as const) {
  test(`preserves all characters in long ${kind} content`, () => {
    const content = `${'plain text /* content */ '.repeat(128)}${String.raw`\u0041\n`}${'tail '.repeat(128)}`;
    const literal = `${opening}${content}${closing}`;
    const source = `class C { String value = ${literal}; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      const [string] = tree.rootNode.descendantsOfType('string_literal');
      expect(string?.text).toBe(literal);
      expect(string!.namedChildren.map((node) => node.text).join('')).toBe(
        `${content}${kind === 'text block' ? '\n' : ''}`
      );
      expect([string!.startIndex, string!.endIndex]).toEqual([
        source.indexOf(literal),
        source.indexOf(literal) + literal.length,
      ]);
      expect(string!.parent?.childForFieldName('value')?.equals(string!)).toBe(true);
      expect(tree.rootNode.descendantsOfType('field_declaration')).toHaveLength(2);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}
