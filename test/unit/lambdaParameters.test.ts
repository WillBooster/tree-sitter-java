import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const [type, parameters, body] of [
  ['IntSupplier', '()', '1'],
  ['IntUnaryOperator', 'x', 'x'],
  ['IntUnaryOperator', '(x)', 'x'],
  ['IntUnaryOperator', '(int x)', 'x'],
  ['IntUnaryOperator', '(final int x)', 'x'],
  ['IntUnaryOperator', '(var x)', 'x'],
  ['IntUnaryOperator', '(_)', '1'],
  ['IntUnaryOperator', '(int _)', '1'],
  ['IntUnaryOperator', '(@A int x)', 'x'],
  ['IntBinaryOperator', '(int x, int y)', 'x + y'],
  ['ToIntFunction<int[]>', '(int[] values)', 'values.length'],
  ['ToIntFunction<int[]>', '(int values[])', 'values.length'],
  ['ToIntFunction<int[]>', '(int... values)', 'values.length'],
] as const) {
  test(`preserves lambda parameter and body ownership for ${parameters}`, () => {
    const source = `@interface A {} class C { java.util.function.${type} value = ${parameters} -> ${body}; int after; }`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(tree.rootNode.hasError, source).toBe(false);
      const [lambda] = tree.rootNode.descendantsOfType('lambda_expression');
      expect(lambda?.parent?.childForFieldName('value')?.equals(lambda)).toBe(true);
      const parameterNode = lambda!.childForFieldName('parameters')!;
      expect(parameterNode.text).toBe(parameters);
      expect([parameterNode.startIndex, parameterNode.endIndex]).toEqual([
        source.indexOf(parameters, source.indexOf('value =')),
        source.indexOf(parameters, source.indexOf('value =')) + parameters.length,
      ]);
      expect(lambda!.childForFieldName('body')?.text).toBe(body);
      expect(lambda!.descendantsOfType('receiver_parameter')).toHaveLength(0);
      expect(tree.rootNode.descendantsOfType('field_declaration').map((field) => field.text)).toEqual([
        `java.util.function.${type} value = ${parameters} -> ${body};`,
        'int after;',
      ]);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const parameters of ['(C this)', '(C this, int x)', '(@A C this, int x)', '(C C.this)', '(C C.this, int x)']) {
  test(`reports a receiver in lambda parameters: ${parameters}`, () => {
    const source = `@interface A {} class C { java.util.function.IntUnaryOperator value = ${parameters} -> 1; int after; }`;
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
