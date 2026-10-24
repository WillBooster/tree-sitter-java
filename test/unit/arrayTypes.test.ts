import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(path.join(import.meta.dirname, '../../tree-sitter-java.wasm'));

for (const element of ['int', 'String', 'java.util.List<String>']) {
  test(`keeps ${element} array dimensions together across declaration and expression contexts`, () => {
    const parser = new Parser();
    parser.setLanguage(language);
    const type = `${element}[][][]`;
    const tree = parser.parse(`class C {
      ${type} field;
      java.util.List<${type}> generic;
      ${type} method(${type} parameter) {
        ${type} local;
        Object cast = (${type}) value;
        return local;
      }
    }`)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      const arrays = tree.rootNode.descendantsOfType('array_type');
      expect(arrays).toHaveLength(6);
      for (const array of arrays) {
        expect(array.childForFieldName('element')?.text).toBe(element);
        expect(array.childForFieldName('dimensions')?.text).toBe('[][][]');
      }
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

test('keeps primitive array class literal dimensions together', () => {
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse('class C { Object value = int[][][].class; }')!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    const arrays = tree.rootNode.descendantsOfType('array_type');
    expect(arrays).toHaveLength(1);
    expect(arrays[0]?.childForFieldName('element')?.text).toBe('int');
    expect(arrays[0]?.childForFieldName('dimensions')?.text).toBe('[][][]');
  } finally {
    tree.delete();
    parser.delete();
  }
});
