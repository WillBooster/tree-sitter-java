import path from 'node:path';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(path.join(import.meta.dirname, '../../tree-sitter-java.wasm'));

for (const [statement, type] of [
  ['if (condition) { run(); }', 'if_statement'],
  ['return value;', 'return_statement'],
]) {
  test(`recovers ${type} after incomplete member access`, () => {
    const parser = new Parser();
    parser.setLanguage(language);
    const tree = parser.parse(`class C { Object m() { object.\n${statement} } }`)!;
    try {
      expect(tree.rootNode.hasError).toBe(true);
      expect(tree.rootNode.descendantsOfType(type!).map((node) => node.text)).toEqual([statement]);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

test('rejects reserved words and literals as declaration names', () => {
  const parser = new Parser();
  parser.setLanguage(language);
  try {
    for (const name of ['class', 'if', 'return', 'const', 'goto', 'true', 'false', 'null']) {
      const tree = parser.parse(`class C { int ${name} = 1; }`)!;
      try {
        expect(tree.rootNode.hasError, name).toBe(true);
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});

test('keeps contextual names, keyword prefixes, literals, and unnamed variables', () => {
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(`class C {
    int module, open, record, with, yield, sealed, permits, var, when;
    int exports, opens, provides, requires, to, transitive, uses;
    int className, interfaceName, returnValue;
    Object method() {
      int _ = 1;
      this.yield();
      boolean value = true || false;
      return switch (module) { default -> { yield null; } };
    }
  }`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('yield_statement')).toHaveLength(1);
    expect(tree.rootNode.descendantsOfType('underscore_pattern')).toHaveLength(1);
    expect(tree.rootNode.descendantsOfType('null_literal')).toHaveLength(1);
  } finally {
    tree.delete();
    parser.delete();
  }
});

for (const parameters of ['_', '(_)', '(_, _)', '(_, value)', '(var _, var value)', '(String _, String value)']) {
  test(`preserves unnamed lambda parameters ${parameters}`, () => {
    const parser = new Parser();
    parser.setLanguage(language);
    const tree = parser.parse(`class C { Object f = ${parameters} -> 1; }`)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      const lambda = tree.rootNode.descendantsOfType('lambda_expression');
      expect(lambda).toHaveLength(1);
      expect(lambda[0]?.childForFieldName('parameters')?.text).toBe(parameters);
      expect(tree.rootNode.descendantsOfType('underscore_pattern')).toHaveLength(parameters === '(_, _)' ? 2 : 1);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

for (const reference of ['Outer.super::method', 'p.Outer.super::method', 'Outer.super::<String>method']) {
  test(`preserves qualified superclass method reference ${reference}`, () => {
    const parser = new Parser();
    parser.setLanguage(language);
    const tree = parser.parse(`class C { Object f = ${reference}; }`)!;
    try {
      expect(tree.rootNode.hasError).toBe(false);
      expect(tree.rootNode.descendantsOfType('method_reference').map((node) => node.text)).toEqual([reference]);
      expect(tree.rootNode.descendantsOfType('super')).toHaveLength(1);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

test('preserves unnamed bindings in local, loop, resource, catch, and pattern positions', () => {
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(`class C { void method(Object value) {
    int _ = 1;
    for (var _ : values) {}
    try (var _ = open()) {} catch (Exception _) {}
    if (value instanceof String _) {}
  } }`)!;
  try {
    expect(tree.rootNode.hasError).toBe(false);
    expect(tree.rootNode.descendantsOfType('underscore_pattern')).toHaveLength(5);
  } finally {
    tree.delete();
    parser.delete();
  }
});
