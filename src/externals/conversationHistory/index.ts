// Local structural type to avoid importing core/usecases
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
}

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
			history = [...history, message];
		},

		clear: (): void => {
			history = [];
		},

		getHistory: (): ChatMessage[] => {
			return [...history];
		},

		filterByAgent: (agentName: string): ChatMessage[] => {
			return [...history];
		}
	};
};
