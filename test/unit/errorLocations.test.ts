import { fileURLToPath } from 'node:url';

import { Language, type Node, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

for (const [name, statement] of [
  ['a missing semicolon', 'int count = 1'],
  ['an unterminated string literal', 'String text = "hello;'],
  ['an unterminated string literal with an encoded line feed', String.raw`String text = "hello\u000a";`],
  ['a fullwidth semicolon', 'int count = 1；'],
  ['a character literal with two characters', "char letter = 'ab';"],
  ['an else after an empty statement', 'if (true) {}; else {}'],
  ['a try without catch or finally', 'try {}'],
] as const) {
  test(`reports ${name} on its own line`, () => {
    const source = `class Main {\n  public static void main(String[] args) {\n    ${statement}\n  }\n\n}\n`;
    const parser = new Parser().setLanguage(language);
    const tree = parser.parse(source)!;
    try {
      expect(firstProblem(tree.rootNode)?.startPosition.row, tree.rootNode.toString()).toBe(2);
    } finally {
      tree.delete();
      parser.delete();
    }
  });
}

function firstProblem(node: Node): Node | undefined {
  if (node.isError || node.isMissing) return node;
  for (const child of node.children) {
    const problem = child && firstProblem(child);
    if (problem) return problem;
  }
  return undefined;
}
