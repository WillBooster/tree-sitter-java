import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

const validSources = [
  String.raw`class C { int cl\uDB40\uDC01ass = 1; int after; }`,
  String.raw`class C { int _\uDB40\uDC01 = 1; int after; }`,
  'class C { int cl\u{E0001}ass = 1; int after; }',
  'class C { int _\u{E0001} = 1; int after; }',
  String.raw`class C { boolean value = tr\u0000ue; int after; }`,
  'cl\u0000ass C { int value = 1; int after; }',
  String.raw`sealed interface A permits C {} non\u0000-sealed class C implements A { int value = 1; int after; }`,
  String.raw`class C { int cl\u0000assify = 1; int after; }`,
  String.raw`class C { int class\u0000Name = 1; int after; }`,
  String.raw`cl\u0000ass C { int value = 1; int after; }`,
  String.raw`class\u001a C { int value = 1; int after; }`,
  String.raw`class C { int v\u0000alue = 1; int after; }`,
  'class C { int value = 1; int after; }\u001A',
  String.raw`class C { int value = 1; int after; }\u001a`,
  String.raw`class C { String value = "a"\u0020; int after; }`,
  String.raw`class C { char value = 'a'\u0020; int after; }`,
  String.raw`abs\u0074ract class C { int value = 1; int after; }`,
  String.raw`\u0040Deprecated class C { int value = 1; int after; }`,
  String.raw`class C { int v\u0061r = 1; int after; }`,
  String.raw`class C { int value = 1 \u002b 2; int after; }`,
  String.raw`class C { int value = ((1\u003c\u003c2) \u0026 3); int after; }`,
  String.raw`cl\u0061ss C { int value = 1; int after; }`,
  String.raw`\u0063\u006c\u0061\u0073\u0073 C { int value = 1; int after; }`,
  String.raw`cl\uuu0061ss C { int value = 1; int after; }`,
  String.raw`class C { int v\u0061lue = 1; int after; }`,
  String.raw`class C { int \u03b1 = 1; int after; }`,
  String.raw`class C { int \ud801\udc00 = 1; int after; }`,
  String.raw`class C \u007b int value \u003d 1\u003b int after; \u007d`,
  String.raw`class C { \u0069nt value = 1; int after; }`,
  String.raw`class C { int value = \u0031; int after; }`,
  String.raw`class C { int value = 0\u0078f\u0046; int after; }`,
  String.raw`class C { int value = 0\u00621\u0030; int after; }`,
  String.raw`class C { int value = 0\u0037; int after; }`,
  String.raw`class C { double value = 1\u002e5\u0065\u002b2; int after; }`,
  String.raw`class C { double value = 0x1\u002e8\u0070\u002b2; int after; }`,
  String.raw`class C { boolean value = tr\u0075e; int after; }`,
  String.raw`class C { Object value = n\u0075ll; int after; }`,
  String.raw`\u0020class\u0009C\u000c{ int value = 1; int after; }`,
  String.raw`class C { int value = 1; \u002f\u002a int hidden; \u002a\u002f int after; }`,
  String.raw`class C { int value = 1; /\u002a int hidden; *\u002f int after; }`,
  String.raw`class C { int value = 1; \u002f/ int hidden; \u000a int after; }`,
  String.raw`class C { int value = 1; // int hidden; \u000d int after; }`,
  String.raw`class C { int value = 1; // int hidden; \u000d\u000a int after; }`,
  'class C { int value = 1; // int hidden; \r int after; }',
  String.raw`class C { int value = 1; // \\u000a int hidden;` + '\n int after; }',
  String.raw`class C { int value = 1; // \u005c\u000a int after; }`,
  String.raw`class C { int value = 1; // \u005c\\u000a int after; }`,
  String.raw`class C { int value = 1; /* \\u00Z malformed-looking ineligible escape */ int after; }`,
  String.raw`class C { int value = 1; /* \u005cu002a/ still comment */ int after; }`,
  String.raw`class C { int value = 1; int after; } // final backslash ` + '\\',
];

const unicode17Sources = [
  String.raw`class C { int \u20c1value = 1; int after; }`,
  String.raw`class C { int \ud888\udfb0value = 1; int after; }`,
];

for (const source of [...validSources, ...unicode17Sources]) {
  test(`preserves declarations and raw ranges after Unicode translation: ${JSON.stringify(source)}`, () => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const declarations = tree.rootNode.descendantsOfType('class_declaration');
      expect(declarations).toHaveLength(1);
      expect(declarations[0]!.childForFieldName('name')?.text).toBe('C');
      const fields = tree.rootNode.descendantsOfType('field_declaration');
      expect(fields).toHaveLength(2);
      const variables = tree.rootNode.descendantsOfType('variable_declarator');
      expect(variables).toHaveLength(2);
      expect(variables[1]!.childForFieldName('name')?.text).toBe('after');
      const assignment = source.match(/ (?:=|\\u003d) /)!;
      const expectedName = source.slice(0, assignment.index).split(' ').at(-1)!;
      const name = variables[0]!.childForFieldName('name')!;
      expect(name.type).toBe('identifier');
      expect(name.text).toBe(expectedName);
      expect(name.startIndex).toBe(assignment.index! - expectedName.length);
      expect(name.endIndex).toBe(assignment.index);
      const value = variables[0]!.childForFieldName('value')!;
      const literal = source.match(/(?:=|\\u003d) ([\s\S]*?)(?:\\u0020)?(?:;|\\u003b)/)![1]!;
      expect(value.text).toBe(literal);
      const start = source.indexOf(literal, variables[0]!.childForFieldName('name')!.endIndex);
      expect(value.startIndex).toBe(start);
      expect(value.endIndex).toBe(start + literal.length);
      const comments = tree.rootNode.descendantsOfType(['line_comment', 'block_comment']);
      expect(comments.every((comment) => !comment.text.includes('int after'))).toBe(true);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const terminator of ['\n', '\r', '\r\n', String.raw`\u000a`, String.raw`\u000d`, String.raw`\u000d\u000a`]) {
  test(`keeps the line terminator outside the comment range: ${JSON.stringify(terminator)}`, () => {
    const comment = '// comment';
    const source = `class C { int value = 1; ${comment}${terminator} int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const comments = tree.rootNode.descendantsOfType('line_comment');
      expect(comments).toHaveLength(1);
      expect(comments[0]!.text).toBe(comment);
      expect(comments[0]!.startIndex).toBe(source.indexOf(comment));
      expect(comments[0]!.endIndex).toBe(source.indexOf(comment) + comment.length);
      expect(tree.rootNode.descendantsOfType('field_declaration')).toHaveLength(2);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const source of [
  String.raw`cl\uDB40\uDC01ass C { int value = 1; int after; }`,
  'cl\u{E0001}ass C { int value = 1; int after; }',
  'class C { int \u0558 = 1; }',
  String.raw`class C { int \u0558 = 1; }`,
  String.raw`class C { long value = 1L\u0000; }`,
  'class C { int cl\u0000ass = 1; }',
  String.raw`class C { int c\u0000onst = 1; }`,
  String.raw`class C { int go\u0000to = 1; }`,
  String.raw`sealed interface A permits C {} non-\u0000sealed class C implements A {}`,
  String.raw`class C { int cl\u0000ass = 1; }`,
  String.raw`class C { int ret\u200burn = 1; }`,
  String.raw`class C { int value = 0\u006f17; }`,
  String.raw`class C { int value = 0\u004f17; }`,
  String.raw`class C { double value = 0x1.\u0066; }`,
  String.raw`class C { double value = 0\u00781.\u0066; }`,
  String.raw`class C { double value = 0x1\u002e; }`,
  String.raw`class C { int value = 1\u005f; }`,
  String.raw`cl\u006ss C { int value; }`,
  String.raw`class C { int \u00Z1; }`,
  String.raw`class C { int value = \u003; }`,
  String.raw`class C { int cl\u0061ss = 1; }`,
  String.raw`class C { int \u0031value; }`,
  String.raw`class C { int \ud800; }`,
  String.raw`class\u00a0C { int value; }`,
  'class\u00A0C { int value; }',
  String.raw`class C { int value; } // \u00Z1`,
  String.raw`class C { int value; } /* \u00Z1 */`,
  String.raw`class C { int value; } // \u005c\u00Z1`,
  String.raw`class C { int value; } /* \u005c\u00Z1 */`,
  String.raw`class C { int value; } \u002f\u002a unterminated`,
  String.raw`class C { int value; } \u005cu002f`,
]) {
  test(`reports invalid translated source: ${JSON.stringify(source)}`, () => {
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
