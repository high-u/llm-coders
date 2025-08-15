import type { LLMExternal } from '../../externals/llm/index';
import type { ConversationHistoryRepository } from '../../externals/conversationHistory';
import type { ConfigurationExternal } from '../../externals/configuration';
import type { MCPExternal } from '../../externals/mcp';
import type { ToolsExternal } from '../../externals/tools/types';

// usecases 層で依存関係の単一定義源
export interface ChatDependencies {
  llm: LLMExternal;
  history: ConversationHistoryRepository;
  configuration: ConfigurationExternal;
  mcp?: MCPExternal;
  tools?: ToolsExternal;
}

// ファクトリ引数用に Partial を提供
export type ChatFactoryDependencies = Partial<ChatDependencies>;
