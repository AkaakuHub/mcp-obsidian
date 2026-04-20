import { analysisToolDefinitions } from './tool-definitions/analysis-tools.js';
import { baseToolDefinitions } from './tool-definitions/base-tools.js';

export const toolDefinitions = [
  ...baseToolDefinitions,
  ...analysisToolDefinitions
];
