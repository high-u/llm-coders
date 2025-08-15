export type ToolEvent = {
  type: 'chunk' | 'complete' | 'error';
  data?: string;
  error?: string;
};

export type ToolResult = {
  content?: { text?: string }[];
  // forward-compat for MCP-like payloads
  [key: string]: any;
};

export interface ToolsExternal {
  callTool: (
    name: string,
    args: Record<string, any>,
    onEvent?: (event: ToolEvent) => void
  ) => Promise<ToolResult>;
}

