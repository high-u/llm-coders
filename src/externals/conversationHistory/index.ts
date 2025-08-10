import { ChatMessage } from '../../usecases/core/messageFormat';
import { getHistoryCopy, addMessageToHistory, clearHistory as clearHistoryCore } from '../../usecases/core/historyUtils';

export interface ConversationHistoryRepository {
	add: (message: ChatMessage) => void;
	clear: () => void;
	getHistory: () => ChatMessage[];
	filterByAgent: (agentName: string) => ChatMessage[];
}

export const createConversationHistoryRepository = (): ConversationHistoryRepository => {
	let history: ChatMessage[] = [];

	return {
		add: (message: ChatMessage): void => {
			history = addMessageToHistory(history, message);
		},

		clear: (): void => {
			history = clearHistoryCore();
		},

		getHistory: (): ChatMessage[] => {
			return getHistoryCopy(history);
		},

		filterByAgent: (agentName: string): ChatMessage[] => {
			return [...history];
		}
	};
};