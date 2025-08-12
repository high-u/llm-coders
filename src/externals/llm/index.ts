import { ChatMessage, StreamEvent } from '../../usecases/core/messageFormat';
import { OpenAITool } from '../../usecases/core/toolTypes';
import { MCPExternal } from '../mcp';
import { formatEndpoint } from './functions/formatRequest';
import { processStreamChunk } from './functions/parseStream';

export interface LLMExternal {
	streamChat: (
		endpoint: string,
		model: string,
		messages: ChatMessage[],
		onEvent: (event: StreamEvent) => void,
		options?: { 
			mcpExternal?: MCPExternal;
			toolChoice?: any;
		}
	) => Promise<ChatMessage[]>; // 更新された履歴を返す
}

import { mapMcpToolsToOpenAi } from '../../usecases/core/mapMcpToolsToOpenAi';
import { formatAssistantMessage, formatToolMessage } from '../../usecases/core/messageFormat';

export const createLLMExternal = (): LLMExternal => ({
	streamChat: async (
		endpoint: string,
		model: string,
		messages: ChatMessage[],
		onEvent: (event: StreamEvent) => void,
		options?: { 
			mcpExternal?: MCPExternal;
			toolChoice?: any;
		}
	): Promise<ChatMessage[]> => {
		try {
			// MCPツールを取得してOpenAI互換に変換
			let tools: OpenAITool[] | undefined = undefined;
			if (options?.mcpExternal) {
				try {
					const mcpTools = await options.mcpExternal.listTools();
					tools = mapMcpToolsToOpenAi(mcpTools);
				} catch {
					tools = undefined;
				}
			}

			// 履歴をコピー（直接変更を避ける）
			let currentMessages: ChatMessage[] = [...messages];
			
			// LLM応答ループ（ツールコールが続く限り繰り返し）
			while (true) {
				let assistantResponse = '';
				let toolCalls: any[] = [];

				const request = {
					model,
					messages: currentMessages,
					stream: true,
					...(tools ? { tools } : {}),
					...(options?.toolChoice ? { tool_choice: options.toolChoice } : {})
				};

				const headers = {
					'Content-Type': 'application/json'
				};
				const url = formatEndpoint(endpoint);

				// リクエストログ
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

				// ストリーム処理
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = new TextDecoder().decode(value);
					const parsedData = processStreamChunk(chunk);

					for (const data of parsedData) {
						if (data.content) {
							assistantResponse += data.content;
							onEvent({ type: 'chunk', data: data.content });
						}
						if (data.tool_call) {
							toolCalls.push(data.tool_call);
						}
					}
				}

				// アシスタントメッセージを履歴に追加
				if (assistantResponse || toolCalls.length > 0) {
					const assistantMessage = formatAssistantMessage(assistantResponse, toolCalls);
					currentMessages.push(assistantMessage);
				}

				// ツールコールがない場合は終了
				if (toolCalls.length === 0) {
					onEvent({ type: 'complete' });
					break;
				}

				// ツール実行がない場合も終了
				if (!options?.mcpExternal) {
					onEvent({ type: 'complete' });
					break;
				}

				// ツール実行
				for (const toolCall of toolCalls) {
					let toolContent: string;
					
					try {
						const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
						const result = await options.mcpExternal.callTool(toolCall.function.name, toolArgs);
						
						if (result.content && Array.isArray(result.content) && result.content[0]?.text) {
							toolContent = result.content[0].text;
						} else {
							toolContent = `Error: No text content found in tool response`;
						}
						
						// ツール実行結果ログ
						const toolResult = {
							ts: new Date().toISOString(),
							source: 'mcp',
							event: 'tool_execution_complete',
							tool_call: {
								id: toolCall.id,
								name: toolCall.function.name,
								arguments: toolArgs
							},
							result
						};
						console.error(JSON.stringify(toolResult, null, 2));
					} catch (error) {
						toolContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
						
						// ツール実行エラーログ
						const toolError = {
							ts: new Date().toISOString(),
							source: 'mcp',
							event: 'tool_execution_error',
							tool_call: {
								id: toolCall.id,
								name: toolCall.function.name,
								arguments: toolCall.function.arguments
							},
							error: error instanceof Error ? error.message : String(error)
						};
						console.error(JSON.stringify(toolError, null, 2));
					}
					
					// ツールメッセージを履歴に追加
					const toolMessage = formatToolMessage(toolContent, toolCall.id);
					currentMessages.push(toolMessage);
				}
				
				// 次のループに続く
			}
			
			// 更新された履歴を返す
			return currentMessages;
		} catch (error) {
			onEvent({ type: 'error', error: String(error) });
			return messages; // エラー時は元の履歴を返す
		}
	}
});
