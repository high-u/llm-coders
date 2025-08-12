import { Coder } from '../core/agentConfig';
import { StreamEvent, ChatMessage } from '../core/messageFormat';
import { formatUserMessage, formatSystemMessage } from '../core/messageFormat';
import { LLMExternal, createLLMExternal } from '../../externals/llm/index';
import { ConversationHistoryRepository, createConversationHistoryRepository } from '../../externals/conversationHistory';
import { ConfigurationExternal, createConfigurationExternal } from '../../externals/configuration';
import { MCPExternal } from '../../externals/mcp';
import type { ChatFactoryDependencies } from './dependencies';
import { mapMcpToolsToOpenAi } from '../core/mapMcpToolsToOpenAi';
import type { OpenAITool } from '../core/toolTypes';

export interface ChatUseCases {
	chat: (
		coder: Coder,
		userPrompt: string,
		onEvent: (event: StreamEvent) => void
	) => Promise<void>;
	clearHistory: () => void;
	getHistory: () => ChatMessage[];
	getCoders: () => Coder[];
}

export const createChatUseCases = (deps: ChatFactoryDependencies = {}): ChatUseCases => {
	// usecases層で依存関係の組み立てを実行（エントリからの DI を優先）
	const llmExternal = deps.llm ?? createLLMExternal();
	const conversationHistoryRepository = deps.history ?? createConversationHistoryRepository();
	const configurationExternal = deps.configuration ?? createConfigurationExternal();
	const mcpExternal = deps.mcp;

	return {
		chat: async (
			coder: Coder,
			userPrompt: string,
			onEvent: (event: StreamEvent) => void
		): Promise<void> => {
			// 1. システムプロンプトを履歴の最初に追加（初回のみ）
			const currentHistory = conversationHistoryRepository.getHistory();
			if (currentHistory.length === 0 && coder.systemPrompt) {
				const systemMessage = formatSystemMessage(coder.systemPrompt);
				conversationHistoryRepository.add(systemMessage);
			}
			
			// 2. ユーザーメッセージを履歴に追加
			const userMessage = formatUserMessage(userPrompt);
			conversationHistoryRepository.add(userMessage);
			
			// 3. LLMに会話を委譲（MCP統合済み）
			const updatedCurrentHistory = conversationHistoryRepository.getHistory();

			// usecases 側で MCP ツールを取得し、OpenAI 互換へ変換
			let tools: OpenAITool[] | undefined = undefined;
			if (mcpExternal) {
				try {
					const mcpTools = await mcpExternal.listTools();
					tools = mapMcpToolsToOpenAi(mcpTools);
				} catch {
					tools = undefined;
				}
			}

			const updatedHistory = await llmExternal.streamChat(
				coder.endpoint,
				coder.modelId,
				updatedCurrentHistory,
				// usecases 層でイベントを受け取り、UI 向けに転送（3層チェーン順守）
				(event) => {
					// 将来ここでドメイン変換やフィルタリングが可能
					onEvent(event);
				},
				{ 
					mcpExternal, // DIでMCP機能を注入
					tools
				}
			);
			
			// 4. 更新された履歴を同期（ユーザーメッセージ以降の更新分のみ）
			const newMessages = updatedHistory.slice(updatedCurrentHistory.length);
			newMessages.forEach(message => conversationHistoryRepository.add(message));
		},

		clearHistory: (): void => {
			conversationHistoryRepository.clear();
		},

		getHistory: (): ChatMessage[] => {
			return conversationHistoryRepository.getHistory();
		},

		getCoders: (): Coder[] => {
			return configurationExternal.getCoders();
		}
	};
};
