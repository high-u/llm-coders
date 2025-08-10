import { ChatMessage } from './messageFormat';

export const addMessageToHistory = (history: ChatMessage[], message: ChatMessage): ChatMessage[] => {
	return [...history, message];
};

export const clearHistory = (): ChatMessage[] => {
	return [];
};

export const getHistoryCopy = (history: ChatMessage[]): ChatMessage[] => {
	return [...history];
};

export const filterHistoryByRole = (history: ChatMessage[], role: 'user' | 'assistant'): ChatMessage[] => {
	return history.filter(message => message.role === role);
};

export const getLastMessage = (history: ChatMessage[]): ChatMessage | undefined => {
	return history[history.length - 1];
};

export const getHistoryLength = (history: ChatMessage[]): number => {
	return history.length;
};