# Obsidian MCP Server

[![Tests](https://github.com/Piotr1215/mcp-obsidian/actions/workflows/test.yml/badge.svg)](https://github.com/Piotr1215/mcp-obsidian/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/Piotr1215/mcp-obsidian/graph/badge.svg)](https://codecov.io/gh/Piotr1215/mcp-obsidian)
[![MCP Compliant](https://img.shields.io/badge/MCP-Compliant-green)](./MCP_SPEC_COMPLIANCE.md)

MCP server for Obsidian that provides direct file system access to vault files with path validation and resource limits.

## Why This Server?

Most existing Obsidian MCP servers rely on the Obsidian REST API plugin, which requires:
- Obsidian to be installed
- Obsidian to be running
- The REST API plugin to be configured

This server instead works directly with Obsidian vault files on disk, making it compatible with setups using [obsidian.nvim](https://github.com/obsidian-nvim/obsidian.nvim) - a Neovim plugin that provides Obsidian-like features without requiring the Obsidian app.

## Features

- **Direct file system access** to Obsidian vaults - no Obsidian app required
- **Security-first design** with path traversal prevention and input validation
- **Performance-conscious scanning** with snapshot reuse, pagination, and resource limits
- **Rich search capabilities** with boolean operators, title/tag filters, and tag-based search
- **Metadata support** with frontmatter and inline tag parsing
- **Vault analysis tools** for folder structure, task extraction, link graph inspection, and audits

## Recent Updates

### 🎉 New Features
- **Context Snippets in Search Results**: Search results now include surrounding lines and highlighted snippets for better context understanding
- **Match Highlighting**: Search terms are highlighted with **bold** markers in results
- **Improved Search Result Structure**: Results are now grouped by file with match counts and snippets

## Installation

```bash
pnpm install
```

## Usage

### Testing with MCP Inspector

```bash
# Replace /home/decoder/dev/obsidian/decoder with your vault path
pnpm dlx @modelcontextprotocol/inspector node src/index.js /home/decoder/dev/obsidian/decoder
```

The inspector will open at http://localhost:5173

Use the Inspector `tools/list` view to browse all available tools, descriptions, and JSON Schemas before calling anything. That is the easiest way to confirm argument names and defaults.

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage report
pnpm run test:coverage

# Run tests with coverage and check thresholds
pnpm run coverage

# Run mutation testing (all files)
pnpm run test:mutation

# Run mutation testing (pagination code only - faster)
pnpm run test:mutation-pagination
```

### Adding to Claude Desktop

To add this server to Claude Desktop, use the Claude CLI:

```bash
# Clone this repository
git clone https://github.com/Piotr1215/mcp-obsidian.git
cd mcp-obsidian

# Install dependencies
pnpm install

# Add to Claude (replace /path/to/your/vault with your Obsidian vault path)
claude mcp add obsidian -s user -- node /path/to/mcp-obsidian/src/index.js /path/to/your/vault
```

For example, if you cloned the repo to `~/dev/mcp-obsidian` and your vault is at `~/Documents/ObsidianVault`:

```bash
claude mcp add obsidian -s user -- node ~/dev/mcp-obsidian/src/index.js ~/Documents/ObsidianVault
```

This will add the server to your Claude configuration file (typically `~/.claude.json` or `~/.config/Claude/claude_desktop_config.json`).

To verify the installation:

```bash
claude mcp list
```

You should see `obsidian` in the list of available MCP servers.

## Available Tools

### search-vault
Search for content across vault notes within the current scan scope.

**Features:**
- Boolean operators: AND, OR, NOT (also supports &&, ||, -)
- Field specifiers: `title:term`, `content:term`, `tag:term`
- Quoted phrases: `"exact phrase"`
- Grouping with parentheses: `(term1 OR term2) AND term3`
- Case-sensitive/insensitive search
- **Context snippets**: See surrounding lines and a highlighted snippet for each match
- **Match highlighting**: Search terms are highlighted with **bold**
- Returns grouped results by file with match counts
- Optional path filtering

**Context Options:**
- `includeContext` (default: true) - Include surrounding lines and a highlighted context snippet for each match
- `contextLines` (default: 2) - Number of lines before/after match (0-10)

**Examples:**
- `readme AND install` - Find notes containing both words
- `title:setup OR tag:documentation` - Find by title or tag
- `"getting started" -deprecated` - Exact phrase, excluding deprecated
- `(python OR javascript) AND tutorial` - Complex queries with grouping

**Example Output with Context:**
```json
{
  "files": [{
    "path": "notes/dotfiles.md",
    "matchCount": 3,
    "matches": [{
      "line": 42,
      "content": "Managing my dotfiles with stow",
      "context": {
        "lines": [
          { "number": 41, "text": "I keep system setup notes here", "isMatch": false },
          { "number": 42, "text": "Managing my dotfiles with stow", "isMatch": true },
          { "number": 43, "text": "The repo lives under ~/dotfiles", "isMatch": false }
        ],
        "highlighted": "Managing my **dotfiles** with stow"
      }
    }]
  }],
  "totalMatches": 43,
  "fileCount": 15,
  "filesSearched": 120,
  "pagination": {
    "total": 43,
    "returned": 43,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

### search-by-filename
Search for notes by filename, stem, or vault-relative path.
- Useful when the note filename is known but the H1 title differs
- Matches `My Note.md`, `My Note`, and partial path fragments
- Case-sensitive/insensitive matching
- Returns filename, stem, title, and file path
- Optional path filtering

### list-notes
List markdown files in your vault or a specific directory with pagination.
- Returns file paths, page counts, and total count
- Supports directory filtering

### list-folders
Return the folder tree and flattened folder paths.
- Useful before large-scale moves or area/project cleanup
- Returns both the nested tree and plain-text folder paths

### read-note
Read the complete content of a specific note.
- **Wikilink-style resolution**: Just provide the filename (e.g., `bitwarden-cli.md`) and the server finds it anywhere in the vault
- Falls back to exact path if provided (e.g., `Notes/projects/bitwarden-cli.md`)
- Reports ambiguity if multiple notes share the same filename
- Path validation ensures security
- File size limits prevent memory issues

### write-note
Create or update a note with new content.
- Automatic directory creation
- Content size limits aligned with the server file-size cap

### append-to-note
Append content to an existing note without replacing the rest of the file.
- Accepts an exact path or a unique filename resolved anywhere in the vault
- Uses a configurable separator between existing and appended content
- Useful for inbox, journal, and task capture flows

### move-note
Move or rename a note to a new vault-relative path.
- Accepts an exact source path or a unique filename resolved anywhere in the vault
- Creates destination directories automatically
- Supports safe overwrite mode when explicitly enabled
- Returns both the resolved source path and destination path

### delete-note
Delete a note from your vault.
- Validated deletion with proper path checks
- Path security checks

### search-by-tags
Find notes containing specific tags.
- Supports inline `#tags` and common frontmatter `tags` shapes
- AND operation for multiple tags
- Case-sensitive/insensitive matching

### preview-move-impact
Preview backlink fallout before moving or renaming a note.
- Highlights links that would stop resolving after the move
- Useful before batch reorganization

### move-many
Preview or apply multiple note moves in one call.
- `dryRun: true` is the safe default
- Validates all moves before writing
- Attempts rollback if a move fails after earlier moves succeeded

## New Organization And Audit Tools

These tools are aimed at vault cleanup, inventory, and preview-first bulk operations.

### Structure and note inspection
- `list-notes-detailed` - path, created/updated timestamps, tags, size, task count, link count, backlink count
- `list-folders` - folder tree and flat folder paths

### Frontmatter and bulk edits
- `write-frontmatter` - single-note frontmatter update with `dryRun`
- `bulk-update-frontmatter` - multi-note frontmatter updates with `dryRun`, per-note diffs, and target counts

Examples:
```json
{ "path": "Projects/alpha.md" }
```
```json
{ "path": "Projects/alpha.md", "fields": { "status": "active", "area": "work" }, "dryRun": true }
```
```json
{ "directory": "Projects", "fields": { "area": "work" }, "dryRun": true, "limit": 50 }
```

### Tasks and links
- `extract-tasks` - vault-wide task extraction with due-date detection
- `analyze-links` - backlinks, outbound links, orphan notes, and hub notes
- `preview-move-impact` - backlink fallout preview before renames or moves
- `move-many` - preview-first batch move execution with rollback attempts

Examples:
```json
{ "directory": "Projects", "includeCompleted": false, "limit": 200 }
```
```json
{ "notePath": "Projects/alpha.md" }
```
```json
{ "directory": "Projects" }
```

### Detection and audits
- `vault-inventory` - one-shot vault summary with note counts, top tags, tasks, orphans, large notes, and recent notes
- `task-audit` - missing due dates, task hotspots, completion-style drift, and missing `project` frontmatter

Examples:
```json
{ "directory": "Projects", "hotspotThreshold": 15 }
```

## Security Features

This server implements these security measures:

- **Path Traversal Prevention**: All file paths are validated to prevent access outside the vault
- **Server-side Validation**: Paths, markdown extensions, required arguments, and file sizes are validated before file operations
- **File Size Limits**: Configurable limits prevent memory exhaustion (default: 10MB)
- **Content Sanitization**: Removes potentially harmful null bytes
- **Markdown-only Access**: Only `.md` files can be accessed

See [MCP_SPEC_COMPLIANCE.md](./MCP_SPEC_COMPLIANCE.md) for detailed compliance information.

## Contributing

1. Ensure all tests pass: `pnpm test`
2. Maintain test coverage above 90%: `pnpm run coverage`
3. Follow functional programming principles
4. Add tests for new features
5. Update documentation as needed
