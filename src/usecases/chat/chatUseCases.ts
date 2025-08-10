import { Agent } from '../core/agentConfig';
import { StreamEvent, ChatMessage } from '../core/messageFormat';
import { formatUserMessage, formatAssistantMessage } from '../core/messageFormat';
import { createLLMExternal } from '../../externals/llm/index';
import { createConversationHistoryRepository } from '../../externals/conversationHistory';
import { createConfigurationExternal } from '../../externals/configuration';

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

export const createChatUseCases = (): ChatUseCases => {
	// usecases層で依存関係の組み立てを実行
	const llmExternal = createLLMExternal();
	const conversationHistoryRepository = createConversationHistoryRepository();
	const configurationExternal = createConfigurationExternal();

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
			
			await llmExternal.streamChat(
				agent.endpoint,
				agent.model,
				currentHistory,
				(event: StreamEvent) => {
					if (event.type === 'chunk' && event.data) {
						assistantResponse += event.data;
					} else if (event.type === 'complete') {
						// 3. アシスタント応答を履歴に追加
						const assistantMessage = formatAssistantMessage(assistantResponse);
						conversationHistoryRepository.add(assistantMessage);
					}
					
					// 4. 元のイベントハンドラーに転送
					onEvent(event);
				}
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