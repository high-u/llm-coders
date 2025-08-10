import { ChatMessage } from '../../../usecases/core/messageFormat';
import { clearHistory as clearHistoryCore } from '../../../usecases/core/historyUtils';

export const clearHistory = (): ChatMessage[] => {
	return clearHistoryCore();
};