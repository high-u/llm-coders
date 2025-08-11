export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
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
	type: 'chunk' | 'complete' | 'error' | 'tool_call';
	data?: string;
	error?: string;
	tool_call?: ToolCall;
}

export const createChatMessage = (role: 'user' | 'assistant', content: string): ChatMessage => ({
	role,
	content
});

export const formatUserMessage = (content: string): ChatMessage => 
	createChatMessage('user', content);

export const formatAssistantMessage = (content: string): ChatMessage => 
	createChatMessage('assistant', content);

export const validateChatMessage = (message: any): message is ChatMessage => {
	return (
		typeof message === 'object' &&
		message !== null &&
		typeof message.role === 'string' &&
		(message.role === 'user' || message.role === 'assistant') &&
		typeof message.content === 'string'
	);
};