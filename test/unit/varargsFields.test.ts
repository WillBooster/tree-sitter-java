import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('exposes varargs type, modifiers and ellipsis annotations without changing the binding', () => {
  const parser = new Parser().setLanguage(language);
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
        const name = spread?.descendantsOfType('variable_declarator')[0]?.childForFieldName('name');
        expect(name?.text).toBe('names');
        for (const node of [
          spread!.childForFieldName('type')!,
          ...spread!.childrenForFieldName('modifiers'),
          ...spread!.childrenForFieldName('annotations'),
          name!,
        ]) {
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
    parser.delete();
  }
});
