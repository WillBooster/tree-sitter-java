import { fileURLToPath } from 'node:url';

import { Language, Parser } from '@willbooster/web-tree-sitter';
import { expect, test } from 'vitest';

await Parser.init();
const language = await Language.load(fileURLToPath(new URL('../../tree-sitter-java.wasm', import.meta.url)));

test('exposes every module service implementation through the provider field', () => {
  const parser = new Parser().setLanguage(language);
  try {
    for (const providers of [
      ['sample.First'],
      ['sample.First', 'sample.Second'],
      ['sample.First', 'sample.Second', 'sample.Third'],
    ]) {
      const source = `module sample.providers { provides sample.Service with ${providers.join(', ')}; }`;
      const tree = parser.parse(source)!;
      try {
        expect(tree.rootNode.hasError).toBe(false);
        const [directive] = tree.rootNode.descendantsOfType('provides_module_directive');
        expect(directive?.childForFieldName('provided')?.text).toBe('sample.Service');
        expect(directive?.childForFieldName('provider')?.text).toBe(providers[0]);
        const expected = providers.map((name) => [name, source.indexOf(name), source.indexOf(name) + name.length]);
        expect(
          directive?.childrenForFieldName('provider').map((node) => [node.text, node.startIndex, node.endIndex])
        ).toEqual(expected);
      } finally {
        tree.delete();
      }
    }
  } finally {
    parser.delete();
  }
});
