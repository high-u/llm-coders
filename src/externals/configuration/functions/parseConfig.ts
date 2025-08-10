import { Agent } from '../../../usecases/core/agentConfig';

export const parseAgentsFromConfig = (configData: any): Agent[] => {
	if (!configData || !Array.isArray(configData.agents)) {
		throw new Error('Invalid config: agents must be an array');
	}

	return configData.agents.map((agent: any, index: number) => {
		if (!agent.name || !agent.endpoint || !agent.model || !agent.color) {
			throw new Error(`Invalid agent at index ${index}: missing required fields`);
		}

		return {
			id: agent.name,
			name: agent.name,
			endpoint: agent.endpoint,
			model: agent.model,
			color: agent.color
		};
	});
};