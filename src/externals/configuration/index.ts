import config from 'config';
import { parseCodersFromConfig, parseMcpServersFromConfig, parseToolsFromConfig } from './functions/parseConfig';
import { validateConfigStructure } from './functions/validateConfig';
import type { McpServerDefinition } from './types';
import type { RawCoder } from './functions/parseConfig';
import type { ConfigTool } from './types';

export interface ConfigurationExternal {
	getCoders: () => RawCoder[];
  getMcpServers: () => McpServerDefinition[];
  getTools: () => ConfigTool[];
  getModelConfig: (key: string) => { endpoint: string; modelId: string } | null;
}

export const createConfigurationExternal = (): ConfigurationExternal => ({
	getCoders: (): RawCoder[] => {
		const configData = config.util.toObject();
		
		if (!validateConfigStructure(configData)) {
			throw new Error('Invalid configuration structure');
		}

		return parseCodersFromConfig(configData);
	},
  getMcpServers: (): McpServerDefinition[] => {
    const configData = config.util.toObject();
    return parseMcpServersFromConfig(configData);
  },
  getTools: (): ConfigTool[] => {
    const configData = config.util.toObject();
    return parseToolsFromConfig(configData);
  },
  getModelConfig: (key: string): { endpoint: string; modelId: string } | null => {
    const configData = config.util.toObject();
    const modelCfg = configData?.model?.[key];
    if (!modelCfg || typeof modelCfg !== 'object') return null;
    const endpoint = modelCfg?.endpoint;
    const modelId = modelCfg?.modelId;
    if (typeof endpoint !== 'string' || typeof modelId !== 'string') return null;
    return { endpoint, modelId };
  }
});
