import path from 'path';
import { collectAssetReferences, listAssetFiles, normalizePath } from './asset-references.js';

export async function auditAssets(vaultPath, options = {}) {
  const { directory = null } = options;
  const { noteReferences, owners, missingAssets } = await collectAssetReferences(vaultPath, { directory });
  const assetFiles = await listAssetFiles(vaultPath, directory);

  const sharedAssets = [];
  const unreferencedAssets = [];
  const ownedAssetMap = new Map();

  for (const assetFullPath of assetFiles) {
    const relativePath = normalizePath(path.relative(vaultPath, assetFullPath));
    const noteOwners = [...(owners.get(assetFullPath) ?? [])].sort();

    if (noteOwners.length === 0) {
      unreferencedAssets.push(relativePath);
      continue;
    }

    if (noteOwners.length > 1) {
      sharedAssets.push({
        path: relativePath,
        notePaths: noteOwners
      });
      continue;
    }

    const ownerPath = noteOwners[0];
    const ownedAssets = ownedAssetMap.get(ownerPath) ?? [];
    ownedAssets.push(relativePath);
    ownedAssetMap.set(ownerPath, ownedAssets);
  }

  return {
    assetCount: assetFiles.length,
    referencedAssetCount: assetFiles.length - unreferencedAssets.length,
    unreferencedAssets: unreferencedAssets.sort(),
    missingAssets: missingAssets.sort((left, right) => left.notePath.localeCompare(right.notePath) || left.target.localeCompare(right.target)),
    sharedAssets: sharedAssets.sort((left, right) => left.path.localeCompare(right.path)),
    ownedAssetsByNote: [...ownedAssetMap.entries()]
      .map(([notePath, assets]) => ({
        notePath,
        assets: assets.sort()
      }))
      .sort((left, right) => left.notePath.localeCompare(right.notePath)),
    noteCount: noteReferences.length
  };
}
