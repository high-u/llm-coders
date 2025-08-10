import { Agent, validateAgent } from '../../../usecases/core/agentConfig';

export const validateAgents = (agents: Agent[]): boolean => {
	if (!Array.isArray(agents) || agents.length === 0) {
		return false;
	}

	return agents.every(agent => validateAgent(agent));
};

export const validateConfigStructure = (config: any): boolean => {
	return (
		typeof config === 'object' &&
		config !== null &&
		Array.isArray(config.agents)
	);
};