const snapshotCache = new Map();

function isFresh(entry, ttlMs) {
  return entry && (Date.now() - entry.createdAt) < ttlMs;
}

export function getCachedSnapshot(cacheKey, ttlMs) {
  const entry = snapshotCache.get(cacheKey);
  if (!isFresh(entry, ttlMs)) {
    snapshotCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

export function setCachedSnapshot(cacheKey, value) {
  snapshotCache.set(cacheKey, {
    createdAt: Date.now(),
    value
  });
}

export function clearSnapshotCache() {
  snapshotCache.clear();
}

export function invalidateSnapshotsForVault(vaultPath) {
  for (const cacheKey of snapshotCache.keys()) {
    if (cacheKey.includes(`"vaultPath":"${vaultPath}"`)) {
      snapshotCache.delete(cacheKey);
    }
  }
}
