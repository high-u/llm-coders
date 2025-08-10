import { ChatMessage } from '../../../usecases/core/messageFormat';
import { addMessageToHistory } from '../../../usecases/core/historyUtils';

export const addMessage = (history: ChatMessage[], message: ChatMessage): ChatMessage[] => {
	return addMessageToHistory(history, message);
};