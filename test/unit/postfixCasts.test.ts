import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('parses postfix operands inside intersection and single casts', () => {
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(`class C {
    Object intersection(int value) { return (Object & java.io.Serializable) value++; }
    Object single(int value) { return (Object) value++; }
    int ordinary(int value) { return value++; }
  }`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(
      tree.rootNode
        .descendantsOfType('cast_expression')
        .map((node) => [
          node.childrenForFieldName('type').map((type) => type.text),
          node.childForFieldName('value')?.type,
        ])
    ).toEqual([
      [['Object', 'java.io.Serializable'], 'update_expression'],
      [['Object'], 'update_expression'],
    ]);
    const update = [
      ['identifier', 'value'],
      ['++', '++'],
    ];
    expect(
      tree.rootNode
        .descendantsOfType('update_expression')
        .map((node) => node.children.map((child) => [child.type, child.text]))
    ).toEqual([update, update, update]);
  } finally {
    tree.delete();
    parser.delete();
  }
});
