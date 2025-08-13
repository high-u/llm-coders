import type { OpenAITool } from './toolTypes';
import type { DomainConfigTool } from './validateTools';

// Common parameter schema for config-defined tools
const parametersSchema = {
  type: 'object',
  properties: {
    text: { type: 'string' }
  },
  required: ['text'],
  additionalProperties: false
};

export const mapConfigToolsToOpenAi = (tools: DomainConfigTool[]): OpenAITool[] => {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: parametersSchema
    }
  }));
};
