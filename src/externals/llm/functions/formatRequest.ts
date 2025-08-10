import { ChatMessage } from '../../../usecases/core/messageFormat';

export interface LLMRequest {
	model: string;
	messages: ChatMessage[];
	stream: boolean;
}

export const createLLMRequest = (
	model: string, 
	messages: ChatMessage[]
): LLMRequest => ({
	model,
	messages,
	stream: true
});

export const createRequestHeaders = (): Record<string, string> => ({
	'Content-Type': 'application/json'
});

export const formatEndpoint = (baseEndpoint: string): string => {
	const trimmedEndpoint = baseEndpoint.endsWith('/') 
		? baseEndpoint.slice(0, -1) 
		: baseEndpoint;
	return `${trimmedEndpoint}/chat/completions`;
};