import path from 'node:path';

import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(path.join(import.meta.dirname, '../../tree-sitter-java.wasm'));

test('queries method visibility independently of annotations', () => {
  const parser = new Parser().setLanguage(language);
  const query = new Query(
    language,
    `(method_declaration
       (modifiers (visibility) @visibility (modifier) @modifier)
       name: (identifier) @method
       (#eq? @visibility "public")
       (#eq? @modifier "static"))`
  );
  try {
    for (const [visibility, methods] of [
      ['public', ['exported']],
      ['private', []],
    ] as const) {
      const source = `class API { @Owned("private") ${visibility} static int exported() { return 1; } @Owned("public") private static int hidden() { return 2; } }`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        expect(
          query
            .captures(tree.rootNode)
            .filter(({ name }) => name === 'method')
            .map(({ node }) => node.text),
          source
        ).toEqual(methods);
        expect(
          tree.rootNode.descendantsOfType('method_declaration').map((node) => node.childForFieldName('name')?.text),
          source
        ).toEqual(['exported', 'hidden']);
      } finally {
        tree.delete();
      }
    }
  } finally {
    query.delete();
    parser.delete();
  }
});
