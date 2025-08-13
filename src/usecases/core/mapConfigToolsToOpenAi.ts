import type { ConfigTool } from '../../externals/configuration/types';
import type { OpenAITool } from './toolTypes';

// Common parameter schema for config-defined tools
const parametersSchema = {
  type: 'object',
  properties: {
    text: { type: 'string' }
  },
  required: ['text'],
  additionalProperties: false
};

export const mapConfigToolsToOpenAi = (tools: ConfigTool[]): OpenAITool[] => {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: parametersSchema
    }
  }));
};

