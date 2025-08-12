export interface JsonSchema {
  [key: string]: any;
}

export interface McpTool {
  name: string;
  description?: string;
  parameters?: JsonSchema;
  // 任意: どのサーバー由来かを保持（重複名の識別に使える）
  serverName?: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: JsonSchema;
  };
}

