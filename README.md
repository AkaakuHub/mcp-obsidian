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
- **🗺️ MOC Discovery**: New `discover-mocs` tool summarizes Maps of Content and their relationships.
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

### search-by-title
Search for notes by their H1 title (# Title).
- Title-based search over indexed note metadata
- Case-sensitive/insensitive matching
- Returns title, file path, and line number
- Optional path filtering
- Only matches H1 headings (single #)

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

### list-notes-full
Return the complete note path list without pagination.
- Useful when you need exact source paths for bulk reorganization
- Returns both `structuredContent.notes` and a plain-text path list

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

### get-note-metadata
Get metadata for one note or many notes without returning full note content.
- Single note mode: Get metadata for a specific note
- Batch mode: Page through metadata for notes in the vault
- Extracts frontmatter, title, normalized tags, and content preview
- Returns metadata and previews instead of full document bodies
- The server still reads note contents internally to extract metadata safely
- Useful for building note indexes or dashboards

### discover-mocs
Discover MOCs (Maps of Content) to inspect your vault's knowledge structure.

[Maps of Content](https://notes.linkingyourthinking.com/Cards/MOCs+Overview) are organizational hub notes (tagged with `#moc`) that link to related content. They were pioneered by [Nick Milo](https://www.linkingyourthinking.com/) as a flexible alternative to rigid folder structures.

**Features:**
- Lists detected MOCs in the scan scope with their linked notes
- Shows MOC hierarchy (which MOCs link to other MOCs)
- Displays normalized wikilink targets from each MOC

### search-links-to
Return backlink sources for one target note.
- Resolves the target by exact path or unique filename
- Shows which notes link to it and the raw wikilink targets they use

### preview-move-impact
Preview backlink fallout before moving or renaming a note.
- Highlights links that would stop resolving after the move
- Useful before batch reorganization

### move-many
Preview or apply multiple note moves in one call.
- `dryRun: true` is the safe default
- Validates all moves before writing
- Attempts rollback if a move fails after earlier moves succeeded

### find-broken-links
Return unresolved wikilinks across the scan scope.
- Useful after batch moves or renames
- Provides a structural summary of your vault's organization
- Filter by MOC name or directory

**Why use MOCs?**
- **Context**: See what knowledge areas exist in your vault
- **Scale**: Understand how developed each area is
- **Relationships**: Discover how topics connect through MOC hierarchy
- **Entry points**: Find strong starting points for exploration

**Example Output:**
```
Found 10 MOCs

📚 Vault Index (24 linked notes)
   Path: 00-INDEX.md
   Links: Work-MOC, AI-MOC, Development-MOC, DevOps-MOC, Tools-MOC, Personal-MOC, Homelab-MOC, MCP-Framework-MOC
   🔗 Links to MOCs: Work-MOC, AI-MOC, Development-MOC, DevOps-MOC, Tools-MOC, Personal-MOC, Homelab-MOC, MCP-Framework-MOC

📚 AI-MOC (61 linked notes)
   Path: _mocs/AI-MOC.md
   Links: chatgpt, ollama, langchain, aider, gp-nvim, MCP-Framework-MOC, ...
   🔗 Links to MOCs: MCP-Framework-MOC, Development-MOC, DevOps-MOC, Tools-MOC, Work-MOC, 00-INDEX
```

This tool gives agents a structural overview of the vault before blind keyword searching.

## New Organization And Audit Tools

These tools are aimed at vault cleanup, inventory, and preview-first bulk operations.

### Structure and note inspection
- `get-vault-structure` - folder hierarchy with note counts
- `list-notes-detailed` - path, created/updated timestamps, tags, size, task count, link count, backlink count
- `preview-notes` - trimmed previews from the first N body lines of many notes without returning full documents to the client

### Frontmatter and bulk edits
- `read-frontmatter` - return parsed frontmatter fields and parse errors
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
- `collect-task-styles` - task marker and completion style drift detection

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
- `detect-daily-notes` - heuristically classify daily, journal, thino, and log-style notes
- `detect-similar-notes` - title similarity for duplicate discovery
- `detect-large-notes` - oversized notes by size or line count
- `detect-unorganized-notes` - missing tags, missing frontmatter, isolated notes, and root clutter
- `vault-inventory` - one-shot vault summary with note counts, top tags, tasks, orphans, large notes, and recent notes
- `task-audit` - missing due dates, task hotspots, completion-style drift, and missing `project` frontmatter
- `daily-journal-audit` - heuristic daily/journal entry points and memo migration candidates
- `propose-note-refactors` - proposal-only refactor mode for moves, renames, and linking suggestions

Examples:
```json
{ "directory": "Daily" }
```
```json
{ "directory": "Projects", "threshold": 0.7 }
```
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
