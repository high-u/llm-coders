import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface McpServerConfig {
  name: string;
  transport?: 'stdio' | 'ws' | 'tcp';
  command?: string;
  args?: string[];
  url?: string;
  host?: string;
  port?: number;
}

export interface McpTool {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  serverName?: string; // 配列スナップショットで必ず付与
}

export interface MCPExternal {
  startAll: (servers: McpServerConfig[]) => Promise<void>;
  listTools: () => Promise<McpTool[]>;
  callTool: (toolName: string, args: any) => Promise<any>;
  stopAll: () => Promise<void>;
}

type AnyClient = any;

interface Connection {
  name: string;
  client: AnyClient;
}

export const createMCPExternal = (): MCPExternal => {
  const connections: Connection[] = [];
  // 起動時に一度だけ作るツールスナップショット（重複許容・順序はサーバー定義順）
  const toolCatalog: McpTool[] = [];

  const startOne = async (cfg: McpServerConfig): Promise<void> => {
    const transport = cfg.transport ?? 'stdio';
    if (transport !== 'stdio') {
      // 未来の拡張ポイント（ws/tcp）
      throw new Error(`Unsupported transport: ${transport}`);
    }
    if (!cfg.command) {
      throw new Error(`Missing command for stdio transport: ${cfg.name}`);
    }
    const transportInstance = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args ?? []
    });
    const client = new Client(
      { name: 'llm-coders', version: '1.0.0' },
      { capabilities: {} }
    );
    await client.connect(transportInstance);
    connections.push({ name: cfg.name, client });
  };

  return {
    startAll: async (servers: McpServerConfig[]): Promise<void> => {
      await Promise.all(servers.map((s) => startOne(s).catch((e) => {
        // eslint-disable-next-line no-console
        console.warn(`[mcp] failed to start ${s.name}:`, e);
      })));

      // 接続完了後、提供順（servers の順）でツールスナップショットを構築（重複は許容）
      toolCatalog.length = 0;
      for (const s of servers) {
        const conn = connections.find(c => c.name === s.name);
        if (!conn?.client?.listTools) continue;
        try {
          const resp = await conn.client.listTools();
          const tools = Array.isArray(resp?.tools) ? resp.tools : [];
          for (const t of tools) {
            const toolName = t?.name;
            if (!toolName) continue;
            toolCatalog.push({
              name: toolName,
              description: t?.description,
              parameters: t?.inputSchema ?? t?.parameters ?? undefined,
              serverName: s.name
            });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`[mcp] listTools (snapshot) failed on ${s.name}:`, e);
        }
      }
    },

    listTools: async (): Promise<McpTool[]> => {
      // 起動時に確定したスナップショットを返す（再取得しない）
      return [...toolCatalog];
    },

    callTool: async (toolName: string, args: any): Promise<any> => {
      // 同名ツールは許容。実行ポリシー: 先勝ち（起動時スナップショットの順序）
      const entry = toolCatalog.find(t => t.name === toolName);
      if (!entry?.serverName) {
        return {
          content: [{ type: 'text', text: `Error: Tool '${toolName}' not found in connected servers` }],
          isError: true
        };
      }

      const conn = connections.find(c => c.name === entry.serverName);
      if (!conn?.client?.callTool) {
        return {
          content: [{ type: 'text', text: `Error: Server '${entry.serverName}' is unavailable for tool '${toolName}'` }],
          isError: true
        };
      }

      try {
        return await conn.client.callTool({ name: toolName, arguments: args });
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: 'text', text: `Error: ${msg}` }],
          isError: true
        };
      }
    },

    stopAll: async (): Promise<void> => {
      for (const { client } of connections) {
        try { await client?.close?.(); } catch {}
      }
      connections.length = 0;
      toolCatalog.length = 0;
    }
  };
};
