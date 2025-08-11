import config from 'config';
import { Agent } from '../../usecases/core/agentConfig';
import { parseAgentsFromConfig, parseMcpServersFromConfig } from './functions/parseConfig';
import { validateConfigStructure } from './functions/validateConfig';
import type { McpServerDefinition } from './types';

export interface ConfigurationExternal {
	getAgents: () => Agent[];
  getMcpServers: () => McpServerDefinition[];
}

export const createConfigurationExternal = (): ConfigurationExternal => ({
	getAgents: (): Agent[] => {
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
