import { McpServerDefinition, ConfigTool } from '../types';

export interface RawCoder {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  modelId: string;
  color: string;
  systemPrompt?: string;
}

export const parseCodersFromConfig = (configData: any): RawCoder[] => {
	if (!configData || !Array.isArray(configData.coders)) {
		throw new Error('Invalid config: coders must be an array');
	}

	if (!configData.model || typeof configData.model !== 'object') {
		throw new Error('Invalid config: model must be an object');
	}

	return configData.coders.map((coder: any, index: number) => {
		if (!coder.name || !coder.model || !coder.color) {
			throw new Error(`Invalid coder at index ${index}: missing required fields`);
		}

		const modelConfig = configData.model[coder.model];
		if (!modelConfig) {
			throw new Error(`Invalid coder at index ${index}: model "${coder.model}" not found`);
		}

		if (!modelConfig.endpoint || !modelConfig.modelId) {
			throw new Error(`Invalid model "${coder.model}": missing endpoint or modelId`);
		}

		return {
			id: coder.name,
			name: coder.name,
			endpoint: modelConfig.endpoint,
			model: coder.model,
			modelId: modelConfig.modelId,
			color: coder.color,
			systemPrompt: coder.systemPrompt
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

const TOOL_NAME_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9]|[_-](?=[A-Za-z0-9]))*[A-Za-z0-9]$/;

export const parseToolsFromConfig = (configData: any): ConfigTool[] => {
  const toolRoot = configData?.tool;
  if (!toolRoot) return [];
  if (typeof toolRoot !== 'object' || Array.isArray(toolRoot)) {
    throw new Error('Invalid config: tool must be an object');
  }

  const names = new Set<string>();
  const result: ConfigTool[] = [];
  for (const [key, value] of Object.entries(toolRoot)) {
    const name = String(key);
    if (!TOOL_NAME_REGEX.test(name)) {
      throw new Error(`Invalid tool name: ${name}`);
    }
    if (names.has(name)) {
      throw new Error(`Duplicate tool name: ${name}`);
    }
    names.add(name);

    const obj: any = value ?? {};
    const description = typeof obj.description === 'string' ? obj.description : undefined;
    const model = typeof obj.model === 'string' ? obj.model : undefined;
    const systemPrompt = typeof obj.systemPrompt === 'string' ? obj.systemPrompt : undefined;

    result.push({ name, description, model, systemPrompt });
  }

  return result;
};
