import path from 'path';

export function buildRefactorProposal(scan, graph) {
  const orphanSet = new Set(graph.orphans);
  const suggestions = [];

  for (const note of scan.notes) {
    if (!note.directory && note.frontmatter.area) {
      suggestions.push({
        type: 'move',
        path: note.path,
        proposedPath: `${note.frontmatter.area}/${path.basename(note.path)}`,
        reason: 'frontmatter-area'
      });
    }

    if (note.title && path.basename(note.path, '.md') !== note.title) {
      const safeTitle = note.title.replace(/[\\/:*?"<>|]/g, '-');
      suggestions.push({
        type: 'rename',
        path: note.path,
        proposedPath: note.directory ? `${note.directory}/${safeTitle}.md` : `${safeTitle}.md`,
        reason: 'title-file-mismatch'
      });
    }

    if (orphanSet.has(note.path)) {
      suggestions.push({
        type: 'link',
        path: note.path,
        proposedAction: 'review for MOC or index links',
        reason: 'isolated-note'
      });
    }
  }

  return {
    mode: 'proposal-only',
    suggestionCount: suggestions.length,
    suggestions
  };
}
