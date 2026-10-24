import { fileURLToPath } from 'node:url';

import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('queries intersection-cast complement fields like ordinary unary expressions', () => {
  const parser = new Parser().setLanguage(language);
  const bounds = new Query(
    language,
    `(cast_expression
       type: (type_identifier) @first
       type: (scoped_type_identifier) @bound
       value: (unary_expression operator: _ @operator operand: (identifier) @operand))`
  );
  const unary = new Query(language, '(unary_expression operator: _ @operator operand: (identifier) @operand)');
  const tree = parser.parse(`class C {
    Object cast(int value) { return (Object & java.io.Serializable) ~value; }
    int ordinary(int value) { return ~value; }
  }`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(bounds.captures(tree.rootNode).map(({ name, node }) => [name, node.text])).toEqual([
      ['first', 'Object'],
      ['bound', 'java.io.Serializable'],
      ['operator', '~'],
      ['operand', 'value'],
    ]);
    expect(unary.captures(tree.rootNode).map(({ name, node }) => [name, node.text])).toEqual([
      ['operator', '~'],
      ['operand', 'value'],
      ['operator', '~'],
      ['operand', 'value'],
    ]);
  } finally {
    tree.delete();
    unary.delete();
    bounds.delete();
    parser.delete();
  }
});
