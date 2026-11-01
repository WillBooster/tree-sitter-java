import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(path.join(import.meta.dirname, '../../tree-sitter-java.wasm'));

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
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(
        tree.rootNode.descendantsOfType('escape_sequence').map((node) => [node.text, node.startIndex, node.endIndex])
      ).toEqual([[escape, source.indexOf(escape), source.indexOf(escape) + escape.length]]);
      expect(tree.rootNode.descendantsOfType('string_fragment').map((node) => node.text)).toEqual(
        suffix ? [suffix] : []
      );
      expect(tree.rootNode.descendantsOfType('field_declaration')).toHaveLength(2);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}
