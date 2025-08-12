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
  role: 'user' | 'assistant' | 'tool';
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
    | 'tool_call_error';
  data?: string;
  error?: string;
  tool_call?: ToolCall;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

