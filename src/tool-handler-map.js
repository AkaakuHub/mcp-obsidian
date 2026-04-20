import { createAnalysisHandlers } from './tool-handler-groups/analysis-handlers.js';
import { createBaseHandlers } from './tool-handler-groups/base-handlers.js';

export function createToolHandlerMap(vaultPath) {
  return {
    ...createBaseHandlers(vaultPath),
    ...createAnalysisHandlers(vaultPath)
  };
}
