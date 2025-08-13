export type TransportKind = 'stdio' | 'ws' | 'tcp';

export interface McpServerDefinition {
  name: string;
  transport?: TransportKind;
  command?: string;
  args?: string[];
  url?: string;
  host?: string;
  port?: number;
}

export interface ConfigTool {
  name: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
}
