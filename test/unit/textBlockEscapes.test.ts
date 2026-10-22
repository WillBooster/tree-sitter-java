import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { expect, test } from 'vitest';
import { Language, Parser, Query } from '@willbooster/web-tree-sitter';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));
const highlights = fs.readFileSync(new URL('../../queries/highlights.scm', import.meta.url), 'utf8');

for (const lineEnding of ['\n', '\r\n', '\r']) {
  test(`exposes complete text block escapes with ${JSON.stringify(lineEnding)} line endings`, () => {
    const escapes = [
      String.raw`\"`,
      `\\${lineEnding}`,
      String.raw`\s`,
      String.raw`\0`,
      String.raw`\07`,
      String.raw`\377`,
      String.raw`\47`,
      String.raw`\"`,
      String.raw`\'`,
      String.raw`\n`,
      String.raw`\t`,
      String.raw`\b`,
      String.raw`\f`,
      String.raw`\r`,
      String.raw`\\`,
      String.raw`\u0041`,
    ];
    const source = `class C { String text = """${lineEnding}before "quote${escapes.join(' middle ')} after${lineEnding}"""; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    const query = new Query(language, highlights);
    try {
      expect(tree.rootNode.hasError).toBe(false);
      let cursor = 0;
      const expected = escapes.map((escape) => {
        const start = source.indexOf(escape, cursor);
        cursor = start + escape.length;
        return [escape, start, cursor];
      });
      expect(
        tree.rootNode.descendantsOfType('escape_sequence').map((node) => [node.text, node.startIndex, node.endIndex])
      ).toEqual(expected);
      expect(
        query
          .captures(tree.rootNode)
          .filter(({ name }) => name === 'string.escape')
          .map(({ node }) => [node.text, node.startIndex, node.endIndex])
      ).toEqual(expected);
      expect(
        tree.rootNode.descendantsOfType('variable_declarator').map((node) => node.childForFieldName('name')?.text)
      ).toEqual(['text', 'after']);
    } finally {
      query.delete();
      tree.delete();
      parser.delete();
    }
  });
}
