import { Agent } from '../core/agentConfig';
import { StreamEvent, ChatMessage } from '../core/messageFormat';
import { formatUserMessage } from '../core/messageFormat';
import { LLMExternal, createLLMExternal } from '../../externals/llm/index';
import { ConversationHistoryRepository, createConversationHistoryRepository } from '../../externals/conversationHistory';
import { ConfigurationExternal, createConfigurationExternal } from '../../externals/configuration';
import { MCPExternal } from '../../externals/mcp';
import type { ChatFactoryDependencies } from './dependencies';

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

export const createChatUseCases = (deps: ChatFactoryDependencies = {}): ChatUseCases => {
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
			
			// 2. LLMに会話を委譲（MCP統合済み）
			const currentHistory = conversationHistoryRepository.getHistory();
			const updatedHistory = await llmExternal.streamChat(
				agent.endpoint,
				agent.model,
				currentHistory,
				onEvent,
				{ 
					mcpExternal  // DIでMCP機能を注入
				}
			);
			
			// 3. 更新された履歴を同期（ユーザーメッセージ以降の更新分のみ）
			const newMessages = updatedHistory.slice(currentHistory.length);
			newMessages.forEach(message => conversationHistoryRepository.add(message));
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
