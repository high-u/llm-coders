export const parseStreamChunk = (chunk: string): string[] => {
	return chunk
		.split('\n')
		.filter(line => line.trim() && line.startsWith('data: '));
};

export interface ParsedStreamData {
	content?: string;
	tool_call?: {
		id: string;
		type: 'function';
		function: {
			name: string;
			arguments: string;
		};
	};
}

export const extractDataFromLine = (line: string): ParsedStreamData | null => {
	if (line === 'data: [DONE]') return null;
	
	try {
		const data = JSON.parse(line.slice(6));
		const delta = data.choices?.[0]?.delta;
		
		if (!delta) return null;
		
		const result: ParsedStreamData = {};
		
		if (delta.content) {
			result.content = delta.content;
		}
		
		if (delta.tool_calls?.[0]) {
			const toolCall = delta.tool_calls[0];
			result.tool_call = {
				id: toolCall.id || '',
				type: 'function',
				function: {
					name: toolCall.function?.name || '',
					arguments: toolCall.function?.arguments || ''
				}
			};
		}
		
		return Object.keys(result).length > 0 ? result : null;
	} catch (e) {
		return null;
	}
};

export const processStreamChunk = (chunk: string): ParsedStreamData[] => {
	const lines = parseStreamChunk(chunk);
	const results: ParsedStreamData[] = [];
	
	for (const line of lines) {
		const data = extractDataFromLine(line);
		if (data) {
			results.push(data);
		}
	}
	
	return results;
};