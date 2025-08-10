import config from 'config';
import { Agent } from '../../usecases/core/agentConfig';
import { parseAgentsFromConfig } from './functions/parseConfig';
import { validateConfigStructure } from './functions/validateConfig';

export interface ConfigurationExternal {
	getAgents: () => Agent[];
}

export const createConfigurationExternal = (): ConfigurationExternal => ({
	getAgents: (): Agent[] => {
		const configData = config.util.toObject();
		
		if (!validateConfigStructure(configData)) {
			throw new Error('Invalid configuration structure');
		}

		return parseAgentsFromConfig(configData);
	}
});