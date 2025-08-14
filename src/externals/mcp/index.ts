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
  serverName?: string;
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
  // ツール名 -> サーバー名（接続時に確定。実行時は1回だけ送る）
  const toolMap = new Map<string, string>();

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

      // 接続完了後、提供順（serversの順）でツール→サーバーを確定
      toolMap.clear();
      for (const s of servers) {
        const conn = connections.find(c => c.name === s.name);
        if (!conn?.client?.listTools) continue;
        try {
          const resp = await conn.client.listTools();
          const tools = Array.isArray(resp?.tools) ? resp.tools : [];
          for (const t of tools) {
            const toolName = t?.name;
            if (!toolName) continue;
            // 最初に見つかったサーバーを採用（以後は上書きしない）
            if (!toolMap.has(toolName)) {
              toolMap.set(toolName, s.name);
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`[mcp] listTools (build map) failed on ${s.name}:`, e);
        }
      }
    },

    listTools: async (): Promise<McpTool[]> => {
      const results: McpTool[] = [];
      for (const { name, client } of connections) {
        if (!client || !client.listTools) continue;
        try {
          const resp = await client.listTools();
          const tools = Array.isArray(resp?.tools) ? resp.tools : [];
          for (const t of tools) {
            results.push({
              name: t?.name,
              description: t?.description,
              parameters: t?.inputSchema ?? t?.parameters ?? undefined,
              serverName: name
            });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`[mcp] listTools failed on ${name}:`, e);
        }
      }
      return results;
    },

    callTool: async (toolName: string, args: any): Promise<any> => {
      const serverName = toolMap.get(toolName);
      if (!serverName) {
        return {
          content: [{ type: 'text', text: `Error: Tool '${toolName}' not found in connected servers` }],
          isError: true
        };
      }

      const conn = connections.find(c => c.name === serverName);
      if (!conn?.client?.callTool) {
        return {
          content: [{ type: 'text', text: `Error: Server '${serverName}' is unavailable for tool '${toolName}'` }],
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
    }
  };
};
