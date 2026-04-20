import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { toolDefinitions } from '../src/toolDefinitions.js';

const bannedPhrases = [
  /content size validation/i,
  /full list of wikilinks/i,
  /fast title-based search/i,
  /tag distribution/i,
  /safe refactor mode/i,
  /lightweight alternative/i,
  /all notes in (your )?vault/i,
  /all mocs in (your )?vault/i,
  /safe bulk edits?/i,
  /safe deletion/i
];

describe('public wording', () => {
  it('avoids banned wording in README', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf-8');

    for (const pattern of bannedPhrases) {
      expect(readme).not.toMatch(pattern);
    }
  });

  it('avoids banned wording in tool descriptions', () => {
    const descriptions = toolDefinitions.map((tool) => `${tool.name}\n${tool.title}\n${tool.description}`).join('\n\n');

    for (const pattern of bannedPhrases) {
      expect(descriptions).not.toMatch(pattern);
    }
  });
});
