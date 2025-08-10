import type { LLMExternal } from '../../externals/llm/index';
import { ConversationHistoryRepository } from '../../externals/conversationHistory';
import { ConfigurationExternal } from '../../externals/configuration';

export interface ChatDependencies {
	llmExternal: LLMExternal;
	conversationHistoryRepository: ConversationHistoryRepository;
	configurationExternal: ConfigurationExternal;
}