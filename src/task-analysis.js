const TASK_PATTERN = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const TASK_STYLE_PATTERN = /^\s*[-*]\s+\[(.*?)\]\s+/;
const DUE_PATTERNS = [
  /\bdue::\s*(\d{4}-\d{2}-\d{2})\b/i,
  /📅\s*(\d{4}-\d{2}-\d{2})/,
  /\bdue\s*[:=]\s*(\d{4}-\d{2}-\d{2})\b/i,
  /@due\((\d{4}-\d{2}-\d{2})\)/
];

export function extractTasksFromContent(content, notePath = '') {
  const lines = (content || '').split('\n');
  const tasks = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.match(TASK_PATTERN);
    if (!match) {
      continue;
    }

    const checkbox = match[1];
    const text = match[2].trim();
    const due = extractTaskDueDate(text);

    tasks.push({
      path: notePath,
      line: index + 1,
      text,
      completed: checkbox.toLowerCase() === 'x',
      due,
      raw: line
    });
  }

  return tasks;
}

function extractTaskDueDate(text) {
  for (const pattern of DUE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function collectTaskStyleVariants(content, notePath = '') {
  const styles = [];

  for (const [index, line] of (content || '').split('\n').entries()) {
    const styleMatch = line.match(TASK_STYLE_PATTERN);
    if (!styleMatch) {
      continue;
    }

    styles.push({
      path: notePath,
      line: index + 1,
      marker: styleMatch[1]
    });
  }

  return styles;
}

export function summarizeTasks(tasks) {
  const byNote = new Map();

  for (const task of tasks) {
    const current = byNote.get(task.path) || {
      path: task.path,
      total: 0,
      open: 0,
      completed: 0,
      dueCount: 0
    };

    current.total += 1;
    current.open += task.completed ? 0 : 1;
    current.completed += task.completed ? 1 : 0;
    current.dueCount += task.due ? 1 : 0;
    byNote.set(task.path, current);
  }

  return [...byNote.values()].sort((left, right) => right.total - left.total || left.path.localeCompare(right.path));
}
