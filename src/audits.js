import { buildDailyJournalAudit, buildDailyNoteDetection } from './daily-audit.js';
import { buildVaultInventorySummary } from './inventory.js';
import { buildLargeNotesDetection, buildSimilarNotesDetection, buildUnorganizedNotesDetection } from './note-detection.js';
import { buildRefactorProposal } from './refactor-audit.js';
import { buildTaskAudit } from './task-audit.js';
import { buildLinkGraph, getVaultSnapshot } from './vault-analysis.js';

export async function detectDailyNotes(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null });
  return buildDailyNoteDetection(scan);
}

export async function detectSimilarNotes(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null });
  return buildSimilarNotesDetection(scan, options.threshold ?? 0.6);
}

export async function detectLargeNotes(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null });
  return buildLargeNotesDetection(scan, options.minSizeBytes ?? 50000, options.minLineCount ?? 800);
}

export async function detectUnorganizedNotes(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null });
  return buildUnorganizedNotesDetection(scan);
}

export async function buildVaultInventory(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null });
  const graph = buildLinkGraph(scan.notes);
  return buildVaultInventorySummary(scan, graph);
}

export async function auditTasks(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null, includeContent: true });
  return buildTaskAudit(scan, options.hotspotThreshold ?? 20);
}

export async function auditDailyJournal(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null });
  return buildDailyJournalAudit(scan);
}

export async function proposeNoteRefactors(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null });
  const graph = buildLinkGraph(scan.notes);
  return buildRefactorProposal(scan, graph);
}
