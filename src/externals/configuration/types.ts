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

