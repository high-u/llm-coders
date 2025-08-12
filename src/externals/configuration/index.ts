import config from 'config';
import { parseCodersFromConfig, parseMcpServersFromConfig } from './functions/parseConfig';
import { validateConfigStructure } from './functions/validateConfig';
import type { McpServerDefinition } from './types';
import type { RawCoder } from './functions/parseConfig';

export interface ConfigurationExternal {
	getCoders: () => RawCoder[];
  getMcpServers: () => McpServerDefinition[];
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
  }
});
