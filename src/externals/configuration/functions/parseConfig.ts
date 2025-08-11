import { Agent } from '../../../usecases/core/agentConfig';
import { McpServerDefinition } from '../types';

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

export const parseMcpServersFromConfig = (configData: any): McpServerDefinition[] => {
  const servers = configData?.mcpServer ?? {};
  if (!servers || typeof servers !== 'object') return [];
  return Object.entries(servers).map(([name, value]: [string, any]) => ({
    name,
    transport: (value?.transport as any) ?? 'stdio',
    command: value?.command,
    args: Array.isArray(value?.args) ? value.args : undefined,
    url: value?.url,
    host: value?.host,
    port: typeof value?.port === 'number' ? value.port : undefined
  }));
};
