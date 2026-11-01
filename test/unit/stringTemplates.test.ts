import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const literal of [
  String.raw`"prefix\{1}"`,
  String.raw`"prefix\u005c{1}"`,
  String.raw`"prefix\u005c\u007b1\u007d"`,
  String.raw`\u0022prefix\{1}\u0022`,
]) {
  test(`preserves the interpolation in the Java 21 template ${literal}`, () => {
    const source = `class C { String value = STR.${literal}; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const templates = tree.rootNode.descendantsOfType('template_expression');
      expect(templates).toHaveLength(1);
      expect(templates[0]!.childForFieldName('template_processor')?.text).toBe('STR');
      const argument = templates[0]!.childForFieldName('template_argument')!;
      expect([argument.text, argument.startIndex, argument.endIndex]).toEqual([
        literal,
        source.indexOf(literal),
        source.indexOf(literal) + literal.length,
      ]);
      const interpolations = argument.descendantsOfType('string_interpolation');
      expect(interpolations).toHaveLength(1);
      expect(interpolations[0]!.descendantsOfType('decimal_integer_literal').map((node) => node.text)).toEqual(['1']);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}
