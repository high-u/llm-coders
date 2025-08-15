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
  // 複数ツールコールをストリームで相関するための任意フィールド
  tool_call_index?: number;
}

export const extractDataFromLine = (line: string): ParsedStreamData[] => {
  if (line === 'data: [DONE]') return [];

  try {
    const data = JSON.parse(line.slice(6));
    const delta = data.choices?.[0]?.delta;
    if (!delta) return [];

    const results: ParsedStreamData[] = [];

    if (typeof delta.content === 'string' && delta.content.length > 0) {
      results.push({ content: delta.content });
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const toolCall of delta.tool_calls) {
        const entry: ParsedStreamData = {
          tool_call: {
            id: toolCall?.id || '',
            type: 'function',
            function: {
              name: toolCall?.function?.name || '',
              arguments: toolCall?.function?.arguments || ''
            }
          }
        };
        if (typeof toolCall?.index === 'number') {
          entry.tool_call_index = toolCall.index;
        }
        results.push(entry);
      }
    }

    return results;
  } catch {
    return [];
  }
};

export const processStreamChunk = (chunk: string): ParsedStreamData[] => {
	const lines = parseStreamChunk(chunk);
	const results: ParsedStreamData[] = [];
	
	for (const line of lines) {
		const items = extractDataFromLine(line);
		if (items.length > 0) results.push(...items);
	}
	
	return results;
};
