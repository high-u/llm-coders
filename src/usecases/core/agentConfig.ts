export interface Agent {
	id: string;
	name: string;
	endpoint: string;
	model: string;
	color: string;
}

export interface AgentDisplayItem extends Agent {
	id: string;
}

export const validateAgent = (agent: any): agent is Agent => {
	return (
		typeof agent === 'object' &&
		agent !== null &&
		typeof agent.name === 'string' &&
		typeof agent.endpoint === 'string' &&
		typeof agent.model === 'string' &&
		typeof agent.color === 'string'
	);
};

export const convertToDisplayItems = (agents: Agent[]): AgentDisplayItem[] => {
	return agents.map(agent => ({
		...agent,
		id: agent.name
	}));
};

export const findAgentByName = (agents: Agent[], name: string): Agent | undefined => {
	return agents.find(agent => agent.name === name);
};