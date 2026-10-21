import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('exposes separate annotation declaration tokens to structural and highlighting queries', () => {
  const parser = new Parser().setLanguage(language);
  const query = new Query(
    language,
    '(annotation_type_declaration "@" @marker "interface" @keyword name: (identifier) @name)'
  );
  const highlights = new Query(
    language,
    readFileSync(new URL('../../queries/highlights.scm', import.meta.url), 'utf8')
  );
  try {
    for (const separator of ['', ' ', '/* separator */', '\n']) {
      const source = `@Deprecated @${separator}interface Mark {} @Mark class User {}`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        expect(query.captures(tree.rootNode).map(({ name, node }) => [name, node.text])).toEqual([
          ['marker', '@'],
          ['keyword', 'interface'],
          ['name', 'Mark'],
        ]);
        const captures = highlights.captures(tree.rootNode);
        expect(captures.filter(({ name, node }) => name === 'operator' && node.text === '@')).toHaveLength(3);
        expect(captures.filter(({ name, node }) => name === 'keyword' && node.text === 'interface')).toHaveLength(1);
        expect(captures.filter(({ name }) => name === 'attribute').map(({ node }) => node.text)).toEqual([
          'Deprecated',
          'Mark',
        ]);
      } finally {
        tree.delete();
      }
    }
  } finally {
    highlights.delete();
    query.delete();
    parser.delete();
  }
});
