import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));
const annotations =
  'import java.lang.annotation.*; @Target({ElementType.RECORD_COMPONENT, ElementType.TYPE_USE}) @interface A {} @Target(ElementType.TYPE_USE) @interface B {}';

for (const [typeParameters, parameters, names, types, dimensions] of [
  ['', '', [], [], []],
  ['', 'int value, String label', ['value', 'label'], ['int', 'String'], [undefined, undefined]],
  ['', 'C value', ['value'], ['C'], [undefined]],
  ['', 'int[] values', ['values'], ['int[]'], [undefined]],
  ['', '@A int @B [] values', ['values'], ['int @B []'], [undefined]],
  ['', 'int... values', ['values'], ['int'], [undefined]],
  ['', '@A String @B [] @B ... values', ['values'], ['String @B []'], [undefined]],
  [
    '<T>',
    'T value, java.util.List<? extends T> values',
    ['value', 'values'],
    ['T', 'java.util.List<? extends T>'],
    [undefined, undefined],
  ],
  ['', 'java.util.List<@A String> values', ['values'], ['java.util.List<@A String>'], [undefined]],
  [
    '',
    'int record, int yield, int when, int var',
    ['record', 'yield', 'when', 'var'],
    ['int', 'int', 'int', 'int'],
    [undefined, undefined, undefined, undefined],
  ],
  ['', 'int values @B []', ['values'], ['int'], ['@B []']],
  ['', 'int... values @B []', ['values'], ['int'], ['@B []']],
  ['', 'int[] values @B [] []', ['values'], ['int[]'], ['@B [] []']],
] as const) {
  test(`preserves record component ownership and ranges: ${parameters}`, () => {
    const source = `${annotations} record C${typeParameters}(${parameters}) { int next() { return 1; } } class After {}`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const [record] = tree.rootNode.descendantsOfType('record_declaration');
      expect(record?.childForFieldName('name')?.text).toBe('C');
      const header = record!.childForFieldName('parameters')!;
      expect(header.text).toBe(`(${parameters})`);
      expect([header.startIndex, header.endIndex]).toEqual([
        source.indexOf(`(${parameters})`, source.indexOf('record C')),
        source.indexOf(`(${parameters})`, source.indexOf('record C')) + parameters.length + 2,
      ]);
      const components = header.namedChildren;
      expect(components).toHaveLength(names.length);
      for (let index = 0; index < components.length; index++) {
        const component = components[index]!;
        const name = component.childForFieldName('name')!;
        expect(name.type).toBe('identifier');
        expect(name.text).toBe(names[index]);
        expect([name.startIndex, name.endIndex]).toEqual([
          source.indexOf(names[index]!, header.startIndex),
          source.indexOf(names[index]!, header.startIndex) + names[index]!.length,
        ]);
        expect(component.childForFieldName('type')?.text).toBe(types[index]);
        const suffix = component.childForFieldName('dimensions');
        expect(suffix?.text).toBe(dimensions[index]);
        if (dimensions[index]) {
          const start = source.indexOf(dimensions[index]!, component.startIndex);
          expect([suffix?.startIndex, suffix?.endIndex]).toEqual([start, start + dimensions[index]!.length]);
        }
        expect(component.parent?.equals(header)).toBe(true);
      }
      expect(record!.childForFieldName('body')?.text).toBe('{ int next() { return 1; } }');
      expect(
        tree.rootNode
          .descendantsOfType('class_declaration')
          .map((declaration) => declaration.childForFieldName('name')?.text)
      ).toEqual(['After']);
      expect(tree.rootNode.descendantsOfType('receiver_parameter')).toHaveLength(0);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const parameters of [
  'C this',
  'C C.this',
  '@A C this',
  'int values[]',
  'int values[][]',
  'final int value',
  '@A final int value',
  'public int value',
]) {
  test(`reports invalid record component syntax: ${parameters}`, () => {
    const source = `${annotations} record C(${parameters}) {}`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(true);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}
