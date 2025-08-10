export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface StreamEvent {
	type: 'chunk' | 'complete' | 'error';
	data?: string;
	error?: string;
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