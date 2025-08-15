import { Coder } from '../core/agentConfig';
import { StreamEvent, ChatMessage } from '../core/messageFormat';
import { formatUserMessage, formatSystemMessage } from '../core/messageFormat';
import { LLMExternal, createLLMExternal } from '../../externals/llm/index';
import { ConversationHistoryRepository, createConversationHistoryRepository } from '../../externals/conversationHistory';
import { ConfigurationExternal, createConfigurationExternal } from '../../externals/configuration';
import { MCPExternal } from '../../externals/mcp';
import { createToolsExternal } from '../../externals/tools';
import type { ChatFactoryDependencies } from './dependencies';
import { mapMcpToolsToOpenAi } from '../core/mapMcpToolsToOpenAi';
import { mapConfigToolsToOpenAi } from '../core/mapConfigToolsToOpenAi';
import { sanitizeConfigTools, sanitizeMcpTools } from '../core/validateTools';
import type { DomainConfigTool } from '../core/validateTools';
import type { OpenAITool } from '../core/toolTypes';
import { getBuiltinTools } from '../core/builtinTools';

export interface ChatUseCases {
	chat: (
		coder: Coder,
		userPrompt: string,
		onEvent: (event: StreamEvent) => void
	) => Promise<void>;
	clearHistory: () => void;
	getHistory: () => ChatMessage[];
	getCoders: () => Coder[];
}

export const createChatUseCases = (deps: ChatFactoryDependencies = {}): ChatUseCases => {
	// usecases層で依存関係の組み立てを実行（エントリからの DI を優先）
	const llmExternal = deps.llm ?? createLLMExternal();
	const conversationHistoryRepository = deps.history ?? createConversationHistoryRepository();
	const configurationExternal = deps.configuration ?? createConfigurationExternal();
    const mcpExternal = deps.mcp;
    const toolsExternal = deps.tools ?? createToolsExternal({
      llm: llmExternal,
      mcp: mcpExternal,
      configuration: configurationExternal
    });

	return {
		chat: async (
			coder: Coder,
			userPrompt: string,
			onEvent: (event: StreamEvent) => void
		): Promise<void> => {
			// 1. システムプロンプトを履歴の最初に追加（初回のみ）
			const currentHistory = conversationHistoryRepository.getHistory();
			if (currentHistory.length === 0 && coder.systemPrompt) {
				const systemMessage = formatSystemMessage(coder.systemPrompt);
				conversationHistoryRepository.add(systemMessage);
			}
			
			// 2. ユーザーメッセージを履歴に追加
			const userMessage = formatUserMessage(userPrompt);
			conversationHistoryRepository.add(userMessage);
			
			// 3. LLMに会話を委譲（MCP統合済み）
			const updatedCurrentHistory = conversationHistoryRepository.getHistory();

			// usecases 側で config ツールと MCP ツールを取得し、OpenAI 互換へ変換して結合
			let tools: OpenAITool[] | undefined = undefined;
			try {
				// 0) 内蔵ツール（常に最優先で含める）
				const builtinTools = getBuiltinTools();
				const configToolsRaw = configurationExternal.getTools() as any[];
				const configToolsDomain: DomainConfigTool[] = (configToolsRaw || []).map((t: any) => ({
					name: String(t?.name ?? ''),
					description: typeof t?.description === 'string' ? t.description : undefined,
					model: typeof t?.model === 'string' ? t.model : undefined,
					systemPrompt: typeof t?.systemPrompt === 'string' ? t.systemPrompt : undefined
				}));
				const configSanitized = sanitizeConfigTools(configToolsDomain);
				// 現状ポリシー: 不正はstderrに出すだけで処理継続
				configSanitized.errors.forEach((e) => console.error(e));
				const openAiConfigTools = mapConfigToolsToOpenAi(configSanitized.sanitized);

				let openAiMcpTools: OpenAITool[] = [];
				if (mcpExternal) {
					try {
						const mcpToolsRaw = await mcpExternal.listTools();
						const mcpSanitized = sanitizeMcpTools(
							mcpToolsRaw as any,
							new Set(configSanitized.sanitized.map(t => t.name))
						);
						mcpSanitized.errors.forEach((e) => console.error(e));
						openAiMcpTools = mapMcpToolsToOpenAi(mcpSanitized.sanitized as any);
					} catch {
						openAiMcpTools = [];
					}
				}

				const combined = [...builtinTools, ...openAiConfigTools, ...openAiMcpTools];
				tools = combined.length > 0 ? combined : undefined;
			} catch {
				tools = undefined;
			}

			const updatedHistory = await llmExternal.streamChat(
				coder.endpoint,
				coder.modelId,
				updatedCurrentHistory,
				// usecases 層でイベントを受け取り、UI 向けに転送（3層チェーン順守）
				(event) => {
					// 将来ここでドメイン変換やフィルタリングが可能
					onEvent(event);
				},
				(() => {
					const toolExecutor = toolsExternal
						? {
							callTool: (
								name: string,
								args: Record<string, any>,
								onEvent?: (event: any) => void
							) => toolsExternal.callTool(name, args, onEvent)
						}
						: undefined;
					return {
						toolExecutor, // ツール実行は抽象I/Fで注入
						tools
					};
				})()
			);
			
			// 4. 更新された履歴を同期（ユーザーメッセージ以降の更新分のみ）
			const newMessages = updatedHistory.slice(updatedCurrentHistory.length);
			newMessages.forEach(message => conversationHistoryRepository.add(message));
		},

		clearHistory: (): void => {
			conversationHistoryRepository.clear();
		},

		getHistory: (): ChatMessage[] => {
			return conversationHistoryRepository.getHistory();
		},

		getCoders: (): Coder[] => {
			return configurationExternal.getCoders();
		}
	};
};
