import { McpTool, OpenAITool } from './toolTypes';

export const mapMcpToolsToOpenAi = (tools: McpTool[]): OpenAITool[] => {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));
};

