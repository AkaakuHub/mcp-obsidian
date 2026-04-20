import { buildVaultInventorySummary } from './inventory.js';
import { buildTaskAudit } from './task-audit.js';
import { buildLinkGraph, getVaultSnapshot } from './vault-analysis.js';

export async function buildVaultInventory(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null });
  const graph = buildLinkGraph(scan.notes);
  return buildVaultInventorySummary(scan, graph);
}

export async function auditTasks(vaultPath, options = {}) {
  const scan = await getVaultSnapshot(vaultPath, { directory: options.directory || null, includeContent: true });
  return buildTaskAudit(scan, options.hotspotThreshold ?? 20);
}
