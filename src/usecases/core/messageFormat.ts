export interface ChatMessage {
	role: 'user' | 'assistant' | 'tool' | 'system';
	content: string;
	tool_call_id?: string;
	tool_calls?: ToolCall[];
}

export interface ToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string;
	};
}

export interface StreamEvent {
	type: 'chunk' | 'complete' | 'error' | 'tool_call_start' | 'tool_call_result' | 'tool_call_error';
	data?: string;
	error?: string;
	tool_call?: ToolCall;
}

export const createChatMessage = (role: 'user' | 'assistant' | 'system', content: string): ChatMessage => ({
	role,
	content
});

export const formatUserMessage = (content: string): ChatMessage => 
	createChatMessage('user', content);

export const formatSystemMessage = (content: string): ChatMessage => 
	createChatMessage('system', content);

export const formatAssistantMessage = (content: string, tool_calls?: ToolCall[]): ChatMessage => ({
	role: 'assistant',
	content,
	tool_calls
});

export const formatToolMessage = (content: string, tool_call_id: string): ChatMessage => ({
	role: 'tool',
	content,
	tool_call_id
});

export const validateChatMessage = (message: any): message is ChatMessage => {
	return (
		typeof message === 'object' &&
		message !== null &&
		typeof message.role === 'string' &&
		(message.role === 'user' || message.role === 'assistant' || message.role === 'tool' || message.role === 'system') &&
		typeof message.content === 'string'
	);
};

// ツールメッセージ専用の型ガード（安全に参照するために使用可能）
export const isToolMessage = (
	message: ChatMessage
): message is ChatMessage & { role: 'tool'; tool_call_id: string } => {
	return (
		message.role === 'tool' &&
		typeof message.tool_call_id === 'string' &&
		message.tool_call_id.length > 0
	);
};
