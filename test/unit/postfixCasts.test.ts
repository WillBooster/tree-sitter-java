import { fileURLToPath } from 'node:url';

import { Language, Parser, Query } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('queries postfix operands inside intersection and single casts', () => {
  const parser = new Parser().setLanguage(language);
  const bounds = new Query(
    language,
    `(cast_expression
       type: (type_identifier) @first
       type: (scoped_type_identifier) @bound
       value: (update_expression (identifier) @operand "++" @operator))`
  );
  const updates = new Query(language, '(update_expression (identifier) @operand "++" @operator)');
  const tree = parser.parse(`class C {
    Object intersection(int value) { return (Object & java.io.Serializable) value++; }
    Object single(int value) { return (Object) value++; }
    int ordinary(int value) { return value++; }
  }`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(bounds.captures(tree.rootNode).map(({ name, node }) => [name, node.text])).toEqual([
      ['first', 'Object'],
      ['bound', 'java.io.Serializable'],
      ['operand', 'value'],
      ['operator', '++'],
    ]);
    expect(updates.captures(tree.rootNode).map(({ name, node }) => [name, node.text])).toEqual([
      ['operand', 'value'],
      ['operator', '++'],
      ['operand', 'value'],
      ['operator', '++'],
      ['operand', 'value'],
      ['operator', '++'],
    ]);
  } finally {
    tree.delete();
    updates.delete();
    bounds.delete();
    parser.delete();
  }
});
