export type StreamEventType = 'chunk' | 'complete' | 'error';

export interface StreamEvent {
	type: StreamEventType;
	data?: string;
	error?: string;
}

interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export class LLMService {
	static async streamChat(
		endpoint: string,
		model: string,
		messages: ChatMessage[],
		onEvent: (event: StreamEvent) => void
	): Promise<void> {
		try {
			const response = await fetch(`${endpoint}/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model,
					messages,
					stream: true
				})
			});

			const reader = response.body?.getReader();
			if (!reader) throw new Error('Failed to get response reader');

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = new TextDecoder().decode(value);
				const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

				for (const line of lines) {
					if (line === 'data: [DONE]') continue;
					
					try {
						const data = JSON.parse(line.slice(6));
						const content = data.choices?.[0]?.delta?.content;
						if (content) {
							onEvent({ type: 'chunk', data: content });
						}
					} catch (e) {
						// Ignore parsing errors
					}
				}
			}

			onEvent({ type: 'complete' });
		} catch (error) {
			onEvent({ type: 'error', error: String(error) });
		}
	}
}