import { Agent } from '../core/agentConfig';
import { StreamEvent, ChatMessage } from '../core/messageFormat';
import { formatUserMessage, formatAssistantMessage } from '../core/messageFormat';
import { LLMExternal, createLLMExternal } from '../../externals/llm/index';
import { ConversationHistoryRepository, createConversationHistoryRepository } from '../../externals/conversationHistory';
import { ConfigurationExternal, createConfigurationExternal } from '../../externals/configuration';
import { MCPExternal } from '../../externals/mcp';
import { mapMcpToolsToOpenAi } from '../core/mapMcpToolsToOpenAi';

export interface ChatUseCases {
	chat: (
		agent: Agent,
		userPrompt: string,
		onEvent: (event: StreamEvent) => void
	) => Promise<void>;
	clearHistory: () => void;
	getHistory: () => ChatMessage[];
	getAgents: () => Agent[];
}

export interface ChatUseCasesDependencies {
  llm?: LLMExternal;
  history?: ConversationHistoryRepository;
  configuration?: ConfigurationExternal;
  mcp?: MCPExternal;
}

export const createChatUseCases = (deps: ChatUseCasesDependencies = {}): ChatUseCases => {
	// usecases層で依存関係の組み立てを実行（エントリからの DI を優先）
	const llmExternal = deps.llm ?? createLLMExternal();
	const conversationHistoryRepository = deps.history ?? createConversationHistoryRepository();
	const configurationExternal = deps.configuration ?? createConfigurationExternal();
	const mcpExternal = deps.mcp;

	return {
		chat: async (
			agent: Agent,
			userPrompt: string,
			onEvent: (event: StreamEvent) => void
		): Promise<void> => {
			// 1. ユーザーメッセージを履歴に追加
			const userMessage = formatUserMessage(userPrompt);
			conversationHistoryRepository.add(userMessage);
			
			// 2. 現在の履歴を取得してLLMに送信
			const currentHistory = conversationHistoryRepository.getHistory();
			let assistantResponse = '';
			let toolCalls: any[] = [];
			
			// MCP ツールを取得して OpenAI 互換 tools に変換
			let tools: any[] | undefined = undefined;
			try {
				if (mcpExternal) {
					const mcpTools = await mcpExternal.listTools();
					tools = mapMcpToolsToOpenAi(mcpTools);
				}
			} catch {
				tools = undefined; // 取得失敗時は tools なしで継続
			}

			await llmExternal.streamChat(
				agent.endpoint,
				agent.model,
				currentHistory,
				async (event: StreamEvent) => {
					// アシスタント応答の蓄積
					if (event.type === 'chunk' && event.data) {
						assistantResponse += event.data;
					} else if (event.type === 'tool_call' && event.tool_call) {
						toolCalls.push(event.tool_call);
					} else if (event.type === 'complete') {
						// 3. 完全なLLM応答をログ出力
						const fullResponse = {
							ts: new Date().toISOString(),
							source: 'llm',
							event: 'response_complete',
							agent,
							userPrompt,
							response: {
								content: assistantResponse,
								tool_calls: toolCalls.length > 0 ? toolCalls : undefined
							}
						};
						console.error(JSON.stringify(fullResponse, null, 2));

						// 3.5. ツール実行処理
						if (toolCalls.length > 0 && mcpExternal) {
							for (const toolCall of toolCalls) {
								try {
									const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
									const result = await mcpExternal.callTool(toolCall.function.name, toolArgs);
									
									// ツール実行結果をstderrに出力
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
									// ツール実行エラーをstderrに出力
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
							}
						}

						// 4. アシスタント応答を履歴に追加
						const assistantMessage = formatAssistantMessage(assistantResponse);
						conversationHistoryRepository.add(assistantMessage);
					}
					
					// 5. 元のイベントハンドラーに転送
					onEvent(event);
				},
				{ tools }
			);
		},

		clearHistory: (): void => {
			conversationHistoryRepository.clear();
		},

		getHistory: (): ChatMessage[] => {
			return conversationHistoryRepository.getHistory();
		},

		getAgents: (): Agent[] => {
			return configurationExternal.getAgents();
		}
	};
};
