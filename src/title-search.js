export function extractH1Title(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith('# ') && line.length > 2) {
      const normalizedTitle = line
        .slice(2)
        .trim()
        .replace(/\s+#\S+(?:\s+#\S+)*\s*$/, '')
        .trim();
      return {
        title: normalizedTitle,
        line: index + 1
      };
    }
  }

  return null;
}
