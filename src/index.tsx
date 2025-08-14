import { render } from 'ink';
import { CommandInterface } from './interfaces/cli';
import { createChatUseCases } from './usecases/chat/chatUseCases';
import { createLLMExternal } from './externals/llm';
import { createConversationHistoryRepository } from './externals/conversationHistory';
import { createConfigurationExternal } from './externals/configuration';
import type { McpServerDefinition } from './externals/configuration/types';
import type { McpServerConfig } from './externals/mcp';
import { createMCPExternal } from './externals/mcp';
import { createToolsExternal } from './externals/tools';

// エントリポイントで依存関係を組み立て（rules.md 準拠）
const bootstrap = async () => {
  const configurationExternal = createConfigurationExternal();
  const llmExternal = createLLMExternal();
  const historyRepository = createConversationHistoryRepository();

  // MCP クライアントの起動（全サーバー同時接続）
  const mcpExternal = createMCPExternal();
  const mcpServerDefs: McpServerDefinition[] = configurationExternal.getMcpServers();
  const mcpServers: McpServerConfig[] = mcpServerDefs.map(def => ({ ...def }));
  try {
    await mcpExternal.startAll(mcpServers);
    // MCP接続情報をstderrへ出力（サーバー定義 + 取得ツール）
    let toolsSnapshot: any[] = [];
    try {
      toolsSnapshot = await mcpExternal.listTools();
    } catch {}
    const mcpLog = {
      ts: new Date().toISOString(),
      source: 'mcp',
      event: 'connected',
      servers: mcpServerDefs,
      tools: toolsSnapshot
    };
    // UI(stdout)と分離するため stderr へフルJSONを出力
    console.error(JSON.stringify(mcpLog, null, 2));
  } catch (e) {
    // 接続失敗時もアプリは継続（tools なしで動作）
    // eslint-disable-next-line no-console
    console.warn('[mcp] failed to start servers:', e);
  }

  const chatUseCases = createChatUseCases({
    llm: llmExternal,
    history: historyRepository,
    configuration: configurationExternal,
    mcp: mcpExternal,
    tools: createToolsExternal({ llm: llmExternal, mcp: mcpExternal, configuration: configurationExternal })
  });

  // 終了時のクリーンアップ
  const shutdown = async () => {
    try { await mcpExternal.stopAll(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  render(<CommandInterface chatUseCases={chatUseCases} />, { exitOnCtrlC: false });
};

bootstrap();
