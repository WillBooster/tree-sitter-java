import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('parses intersection-cast complement fields like ordinary unary expressions', () => {
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(`class C {
    Object cast(int value) { return (Object & java.io.Serializable) ~value; }
    int ordinary(int value) { return ~value; }
  }`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const [cast] = tree.rootNode.descendantsOfType('cast_expression');
    expect(cast?.childrenForFieldName('type').map((node) => [node.type, node.text])).toEqual([
      ['type_identifier', 'Object'],
      ['scoped_type_identifier', 'java.io.Serializable'],
    ]);
    const unaries = tree.rootNode.descendantsOfType('unary_expression');
    expect(cast?.childForFieldName('value')?.id).toBe(unaries[0]?.id);
    expect(
      unaries.map((node) => [
        node.childForFieldName('operator')?.text,
        node.childForFieldName('operand')?.type,
        node.childForFieldName('operand')?.text,
      ])
    ).toEqual([
      ['~', 'identifier', 'value'],
      ['~', 'identifier', 'value'],
    ]);
  } finally {
    tree.delete();
    parser.delete();
  }
});
