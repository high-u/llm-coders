// Types local to the LLM external layer.

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface StreamEvent {
  type:
    | 'chunk'
    | 'complete'
    | 'error'
    | 'tool_call_start'
    | 'tool_call_result'
    | 'tool_call_error'
    | 'tool_approval_request'
    | 'tool_approval_result';
  data?: string;
  error?: string;
  tool_call?: ToolCall;
  approval?: {
    name: string;
    args: Record<string, any>;
    approved?: boolean;
  };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

// Minimal interface for executing tools, injected from usecases.
export interface ToolResult {
  // MCP互換の最小構造（現状使用部分のみ）
  content?: { text?: string }[];
  // 将来の拡張のために任意フィールドも許容
  [key: string]: any;
}

export interface ToolExecutor {
  callTool: (
    name: string,
    args: Record<string, any>,
    onEvent?: (event: StreamEvent) => void
  ) => Promise<ToolResult>;
}

export type ToolApprovalDecision = 'yes' | 'no' | 'escape';
export interface ConfirmToolExecutionFn {
  (input: { name: string; args: Record<string, any>; tool_call?: ToolCall }): Promise<ToolApprovalDecision>;
}
