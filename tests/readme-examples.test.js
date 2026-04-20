import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import Ajv from 'ajv';
import { toolDefinitions } from '../src/toolDefinitions.js';

const ajv = new Ajv({ strict: false, allErrors: true });

function extractJsonBlocks(markdown) {
  return [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => match[1]);
}

describe('README examples', () => {
  it('contains JSON examples that remain valid against at least one published schema', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf-8');
    const jsonBlocks = extractJsonBlocks(readme);

    expect(jsonBlocks.length).toBeGreaterThan(0);

    const validators = toolDefinitions.flatMap((tool) => [
      { name: `${tool.name}:input`, validate: ajv.compile(tool.inputSchema) },
      { name: `${tool.name}:output`, validate: ajv.compile(tool.outputSchema) }
    ]);

    for (const block of jsonBlocks) {
      const parsed = JSON.parse(block);
      const matchingValidators = validators.filter(({ validate }) => validate(parsed));

      expect(
        matchingValidators.length,
        `No schema matched README example:\n${block}`
      ).toBeGreaterThan(0);
    }
  });
});
