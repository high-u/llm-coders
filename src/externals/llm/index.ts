import { ChatMessage, StreamEvent } from '../../usecases/core/messageFormat';
import { OpenAITool } from '../../usecases/core/toolTypes';
import { formatEndpoint } from './functions/formatRequest';
import { processStreamChunk } from './functions/parseStream';

export interface LLMExternal {
	streamChat: (
		endpoint: string,
		model: string,
		messages: ChatMessage[],
		onEvent: (event: StreamEvent) => void,
		options?: { tools?: OpenAITool[]; toolChoice?: any }
	) => Promise<void>;
}

export const createLLMExternal = (): LLMExternal => ({
	streamChat: async (
		endpoint: string,
		model: string,
		messages: ChatMessage[],
		onEvent: (event: StreamEvent) => void,
		options?: { tools?: OpenAITool[]; toolChoice?: any }
	): Promise<void> => {
		try {
			const request = {
				model,
				messages,
				stream: true,
				...(options?.tools ? { tools: options.tools } : {}),
				...(options?.toolChoice ? { tool_choice: options.toolChoice } : {})
			};
			const headers = {
				'Content-Type': 'application/json'
			};
			const url = formatEndpoint(endpoint);

			// リクエスト直前にstderrへフルJSONを出力
			const log = {
				ts: new Date().toISOString(),
				source: 'llm',
				event: 'request',
				url,
				method: 'POST',
				headers,
				body: request
			};
			console.error(JSON.stringify(log, null, 2));

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
				const parsedData = processStreamChunk(chunk);

				for (const data of parsedData) {
					if (data.content) {
						onEvent({ type: 'chunk', data: data.content });
					}
					if (data.tool_call) {
						onEvent({ type: 'tool_call', tool_call: data.tool_call });
					}
				}
			}

			onEvent({ type: 'complete' });
		} catch (error) {
			onEvent({ type: 'error', error: String(error) });
		}
	}
});
