import path from 'node:path';
import { Edit, Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(path.join(import.meta.dirname, '../../tree-sitter-java.wasm'));

test('queries method visibility independently of annotations after an incremental modifier edit', () => {
  const parser = new Parser().setLanguage(language);
  const query = new Query(
    language,
    `(method_declaration
       (modifiers (visibility) @visibility (modifier) @modifier)
       name: (identifier) @method
       (#eq? @visibility "public")
       (#eq? @modifier "static"))`
  );
  const source =
    'class API { @Owned("private") public static int exported() { return 1; } @Owned("public") private static int hidden() { return 2; } }';
  let tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(
      query
        .captures(tree.rootNode)
        .filter(({ name }) => name === 'method')
        .map(({ node }) => node.text)
    ).toEqual(['exported']);
    const start = source.indexOf('public static');
    tree.edit(
      new Edit({
        startIndex: start,
        oldEndIndex: start + 'public'.length,
        newEndIndex: start + 'private'.length,
        startPosition: { row: 0, column: start },
        oldEndPosition: { row: 0, column: start + 'public'.length },
        newEndPosition: { row: 0, column: start + 'private'.length },
      })
    );
    const previous = tree;
    tree = parser.parse(source.slice(0, start) + 'private' + source.slice(start + 'public'.length), previous)!;
    previous.delete();
    expect(tree.rootNode.hasError).toBe(false);
    expect(query.captures(tree.rootNode)).toEqual([]);
    expect(
      tree.rootNode.descendantsOfType('method_declaration').map((node) => node.childForFieldName('name')?.text)
    ).toEqual(['exported', 'hidden']);
  } finally {
    tree.delete();
    query.delete();
    parser.delete();
  }
});
