import { ChatMessage, StreamEvent } from '../../usecases/core/messageFormat';
import { formatEndpoint } from './functions/formatRequest';
import { processStreamChunk } from './functions/parseStream';

export interface LLMExternal {
	streamChat: (
		endpoint: string,
		model: string,
		messages: ChatMessage[],
		onEvent: (event: StreamEvent) => void
	) => Promise<void>;
}

export const createLLMExternal = (): LLMExternal => ({
	streamChat: async (
		endpoint: string,
		model: string,
		messages: ChatMessage[],
		onEvent: (event: StreamEvent) => void
	): Promise<void> => {
		try {
			const request = {
				model,
				messages,
				stream: true
			};
			const headers = {
				'Content-Type': 'application/json'
			};
			const url = formatEndpoint(endpoint);

			const response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(request)
			});

			const reader = response.body?.getReader();
			if (!reader) throw new Error('Failed to get response reader');

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = new TextDecoder().decode(value);
				const contents = processStreamChunk(chunk);

				for (const content of contents) {
					onEvent({ type: 'chunk', data: content });
				}
			}

			onEvent({ type: 'complete' });
		} catch (error) {
			onEvent({ type: 'error', error: String(error) });
		}
	}
});