import { Agent } from '../core/agentConfig';
import { StreamEvent, ChatMessage } from '../core/messageFormat';
import { formatUserMessage, formatAssistantMessage, formatToolMessage } from '../core/messageFormat';
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

// ツール実行と継続処理（分離された関数）
const executeToolsAndContinue = async (
	agent: Agent,
	toolCalls: any[],
	onEvent: (event: StreamEvent) => void,
	mcpExternal: MCPExternal,
	assistantResponse: string,
	userPrompt: string,
	llmExternal: LLMExternal,
	conversationHistoryRepository: ConversationHistoryRepository
): Promise<void> => {
	// ログ出力
	const fullResponse = {
		ts: new Date().toISOString(),
		source: 'llm',
		event: 'response_complete',
		agent,
		userPrompt,
		response: {
			content: assistantResponse,
			tool_calls: toolCalls
		}
	};
	console.error(JSON.stringify(fullResponse, null, 2));

	// tool_callsを含むassistantメッセージを履歴に保存
	const assistantMessage = formatAssistantMessage(assistantResponse, toolCalls);
	conversationHistoryRepository.add(assistantMessage);

	// 全てのtool_callに対してツール実行・toolメッセージ作成
	for (const toolCall of toolCalls) {
		let toolContent: string;
		
		try {
			const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
			const result = await mcpExternal.callTool(toolCall.function.name, toolArgs);
			
			// MCPレスポンスからcontent[0].textを抽出
			if (result.content && Array.isArray(result.content) && result.content[0]?.text) {
				toolContent = result.content[0].text;
			} else {
				toolContent = `Error: No text content found in tool response`;
			}
			
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
			// MCPツール実行エラー
			toolContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
			
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
		
		// tool_call_id紐付けでtoolメッセージを作成・履歴に追加
		const toolMessage = formatToolMessage(toolContent, toolCall.id);
		conversationHistoryRepository.add(toolMessage);
	}
	
	// 全toolメッセージ追加後、最終応答を取得（toolsなし）
	const updatedHistory = conversationHistoryRepository.getHistory();
	await llmExternal.streamChat(
		agent.endpoint,
		agent.model,
		updatedHistory,
		onEvent // シンプルな転送
		// toolsは渡さない（ツール実行完了済み）
	);
};

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

			// 3. 初回LLM呼び出し（ツール付き）
			await llmExternal.streamChat(
				agent.endpoint,
				agent.model,
				currentHistory,
				(event: StreamEvent) => {
					// アシスタント応答の蓄積
					if (event.type === 'chunk' && event.data) {
						assistantResponse += event.data;
					} else if (event.type === 'tool_call' && event.tool_call) {
						toolCalls.push(event.tool_call);
					}
					
					// ツール実行がある場合はcompleteイベントを抑制（早期入力欄表示を防ぐ）
					if (event.type === 'complete' && toolCalls.length > 0) {
						return; // completeイベントを転送しない
					}
					
					// その他のイベントを転送
					onEvent(event);
				},
				{ tools }
			);

			// 4. ツール実行後処理（必要な場合のみ）
			if (toolCalls.length > 0 && mcpExternal) {
				await executeToolsAndContinue(
					agent, 
					toolCalls, 
					onEvent, 
					mcpExternal, 
					assistantResponse, 
					userPrompt, 
					llmExternal, 
					conversationHistoryRepository
				);
			}
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
