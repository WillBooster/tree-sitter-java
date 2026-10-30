import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('keeps the annotation declaration @ and interface tokens separate', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const separator of ['', ' ', '/* separator */', '\n']) {
      const source = `@Deprecated @${separator}interface Mark {} @Mark class User {}`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError, source).toBe(false);
        const declarations = tree.rootNode.descendantsOfType('annotation_type_declaration');
        expect(declarations).toHaveLength(1);
        expect(
          declarations[0]!.children.filter((node) => !node.isExtra).map((node) => [node.type, node.text]),
          source
        ).toEqual([
          ['modifiers', '@Deprecated'],
          ['@', '@'],
          ['interface', 'interface'],
          ['identifier', 'Mark'],
          ['annotation_type_body', '{}'],
        ]);
        expect(declarations[0]!.childForFieldName('name')?.text).toBe('Mark');
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});
