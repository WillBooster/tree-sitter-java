import { fileURLToPath } from 'node:url';

import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('exposes varargs type, modifiers and ellipsis annotations without changing the binding', () => {
  const parser = new Parser().setLanguage(language);
  const query = new Query(
    language,
    `(spread_parameter type: (_) @type)
     (spread_parameter modifiers: (_) @modifiers)
     (spread_parameter annotations: (_) @annotation)
     (spread_parameter (variable_declarator name: (identifier) @name))`
  );
  try {
    for (const parameter of [
      { source: 'String... names', type: 'String', modifiers: undefined, annotations: [] },
      {
        source: 'final @ParameterMark String @DimensionMark [] @EllipsisMark @OtherEllipsisMark ... names',
        type: 'String @DimensionMark []',
        modifiers: 'final @ParameterMark',
        annotations: ['@EllipsisMark', '@OtherEllipsisMark'],
      },
    ]) {
      const source = `class C { void run(${parameter.source}) {} }`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        const [spread] = tree.rootNode.descendantsOfType('spread_parameter');
        expect(spread?.childForFieldName('type')?.text).toBe(parameter.type);
        expect(spread?.childForFieldName('modifiers')?.text).toBe(parameter.modifiers);
        expect(spread?.childrenForFieldName('annotations').map((node) => node.text)).toEqual(parameter.annotations);
        const captures = query.captures(tree.rootNode);
        const texts = (name: string): string[] =>
          captures.filter((capture) => capture.name === name).map(({ node }) => node.text);
        expect(texts('type')).toEqual([parameter.type]);
        expect(texts('modifiers')).toEqual(parameter.modifiers ? [parameter.modifiers] : []);
        expect(texts('annotation')).toEqual(parameter.annotations);
        expect(texts('name')).toEqual(['names']);
        for (const { node } of captures) {
          expect([node.startIndex, node.endIndex]).toEqual([
            source.indexOf(node.text),
            source.indexOf(node.text) + node.text.length,
          ]);
        }
      } finally {
        tree.delete();
      }
    }
  } finally {
    query.delete();
    parser.delete();
  }
});
