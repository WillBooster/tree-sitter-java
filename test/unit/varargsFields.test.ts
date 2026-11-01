import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('preserves varargs types, modifiers, annotations and binding ranges', () => {
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
        const name = spread?.childForFieldName('name');
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

for (const source of [
  'class C { void run(int... names = 1) {} }',
  'class C { void run(int... names = new int[0]) {} }',
  'class C { void run(int... names = {}) {} }',
  'class C { void run(int... names[]) {} }',
  'class C { void run(int... names[][]) {} }',
  'class C { C(int... names = new int[0]) {} }',
  'record C(int... names = new int[0]) {}',
  'class C { java.util.function.ToIntFunction<int[]> value = (int... names = new int[0]) -> names.length; }',
  'class C { java.util.function.ToIntFunction<int[]> value = (int... names[]) -> names.length; }',
]) {
  test(`reports an invalid varargs declarator: ${source}`, () => {
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

for (const source of [
  'class C { C(int... names) {} }',
  'record C(int... names) {}',
  'class C { java.util.function.ToIntFunction<int[]> value = (int... names) -> names.length; }',
]) {
  test(`preserves a varargs binding in its declaration context: ${source}`, () => {
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const [spread] = tree.rootNode.descendantsOfType('spread_parameter');
      const name = spread?.childForFieldName('name');
      expect(name?.type).toBe('identifier');
      expect(name?.text).toBe('names');
      expect([name?.startIndex, name?.endIndex]).toEqual([source.indexOf('names'), source.indexOf('names') + 5]);
      expect(spread?.childForFieldName('type')?.text).toBe('int');
      expect(spread?.text).toBe('int... names');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

test('preserves an unnamed varargs lambda parameter', () => {
  const source = 'class C { java.util.function.ToIntFunction<int[]> value = (int... _) -> 1; }';
  const parser = new Parser().setLanguage(language);
  const tree = parser.parse(source)!;
  try {
    expect(tree.rootNode.hasError, source).toBe(false);
    const [lambda] = tree.rootNode.descendantsOfType('lambda_expression');
    expect(lambda?.parent?.childForFieldName('value')?.equals(lambda)).toBe(true);
    const [spread] = lambda!.descendantsOfType('spread_parameter');
    expect(spread?.parent?.equals(lambda!.childForFieldName('parameters')!)).toBe(true);
    const name = spread?.childForFieldName('name');
    expect(name?.type).toBe('underscore_pattern');
    expect(name?.text).toBe('_');
    expect([name?.startIndex, name?.endIndex]).toEqual([source.indexOf('_'), source.indexOf('_') + 1]);
    expect(spread?.childForFieldName('type')?.text).toBe('int');
    expect(lambda!.childForFieldName('body')?.text).toBe('1');
  } finally {
    tree.delete();
    parser.delete();
  }
});

for (const [declaration, dimensions] of [
  ['void run(int... names @A []) {}', '@A []'],
  ['void run(int... names @A [] []) {}', '@A [] []'],
  ['java.util.function.ToIntFunction<int[][]> value = (int... names @A []) -> names.length;', '@A []'],
  ['java.util.function.ToIntFunction<int[][]> value = (int... _ @A []) -> 1;', '@A []'],
] as const) {
  test(`preserves compiler-supported annotated varargs suffix dimensions: ${declaration}`, () => {
    const source = `import java.lang.annotation.*; @Target(ElementType.TYPE_USE) @interface A {} class C { ${declaration} }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const [spread] = tree.rootNode.descendantsOfType('spread_parameter');
      const name = spread?.childForFieldName('name');
      const expectedName = declaration.includes('int... _') ? '_' : 'names';
      expect(name?.text).toBe(expectedName);
      expect(name?.type).toBe(expectedName === '_' ? 'underscore_pattern' : 'identifier');
      const suffix = spread?.childForFieldName('dimensions');
      expect(suffix?.text).toBe(dimensions);
      expect([suffix?.startIndex, suffix?.endIndex]).toEqual([
        source.indexOf(dimensions),
        source.indexOf(dimensions) + dimensions.length,
      ]);
      expect(spread?.childForFieldName('type')?.text).toBe('int');
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const declaration of ['void run(int... names[] @A []) {}', 'void run(int... names @A) {}']) {
  test(`rejects invalid annotated varargs suffix dimensions: ${declaration}`, () => {
    const source = `import java.lang.annotation.*; @Target(ElementType.TYPE_USE) @interface A {} class C { ${declaration} }`;
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
