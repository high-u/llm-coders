export const parseStreamChunk = (chunk: string): string[] => {
	return chunk
		.split('\n')
		.filter(line => line.trim() && line.startsWith('data: '));
};

export const extractContentFromLine = (line: string): string | null => {
	if (line === 'data: [DONE]') return null;
	
	try {
		const data = JSON.parse(line.slice(6));
		return data.choices?.[0]?.delta?.content || null;
	} catch (e) {
		return null;
	}
};

export const processStreamChunk = (chunk: string): string[] => {
	const lines = parseStreamChunk(chunk);
	const contents: string[] = [];
	
	for (const line of lines) {
		const content = extractContentFromLine(line);
		if (content) {
			contents.push(content);
		}
	}
	
	return contents;
};