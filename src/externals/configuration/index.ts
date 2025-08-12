import config from 'config';
import { parseAgentsFromConfig, parseMcpServersFromConfig } from './functions/parseConfig';
import { validateConfigStructure } from './functions/validateConfig';
import type { McpServerDefinition } from './types';
import type { RawAgent } from './functions/parseConfig';

export interface ConfigurationExternal {
	getAgents: () => RawAgent[];
  getMcpServers: () => McpServerDefinition[];
}

export const createConfigurationExternal = (): ConfigurationExternal => ({
	getAgents: (): RawAgent[] => {
		const configData = config.util.toObject();
		
		if (!validateConfigStructure(configData)) {
			throw new Error('Invalid configuration structure');
		}

		return parseAgentsFromConfig(configData);
	},
  getMcpServers: (): McpServerDefinition[] => {
    const configData = config.util.toObject();
    return parseMcpServersFromConfig(configData);
  }
});
