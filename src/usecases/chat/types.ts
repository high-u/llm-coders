import type { StreamEvent, ChatMessage } from '../core/messageFormat';
import type { Coder } from '../core/agentConfig';

// Public types for the chat usecases boundary
export interface ChatUseCases {
  chat: (
    coder: Coder,
    userPrompt: string,
    onEvent: (event: StreamEvent) => void,
    confirmToolExecution?: (input: { name: string; args: Record<string, any> }) => Promise<boolean>
  ) => Promise<void>;
  clearHistory: () => void;
  getHistory: () => ChatMessage[];
  getCoders: () => Coder[];
}

// Re-export core-owned domain type through the usecases boundary
export type { Coder } from '../core/agentConfig';
