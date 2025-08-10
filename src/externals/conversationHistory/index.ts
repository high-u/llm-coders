import { ChatMessage } from '../../usecases/core/messageFormat';
import { getHistoryCopy } from '../../usecases/core/historyUtils';
import { addMessage } from './functions/addMessage';
import { clearHistory } from './functions/clearHistory';
import { filterByAgent } from './functions/filterByAgent';

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
			history = addMessage(history, message);
		},

		clear: (): void => {
			history = clearHistory();
		},

		getHistory: (): ChatMessage[] => {
			return getHistoryCopy(history);
		},

		filterByAgent: (agentName: string): ChatMessage[] => {
			return filterByAgent(history, agentName);
		}
	};
};