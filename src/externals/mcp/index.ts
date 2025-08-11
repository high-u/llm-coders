import { McpTool } from '../../usecases/core/toolTypes';
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

export interface MCPExternal {
  startAll: (servers: McpServerConfig[]) => Promise<void>;
  listTools: () => Promise<McpTool[]>;
  stopAll: () => Promise<void>;
}

type AnyClient = any;

interface Connection {
  name: string;
  client: AnyClient;
}

export const createMCPExternal = (): MCPExternal => {
  const connections: Connection[] = [];

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

    stopAll: async (): Promise<void> => {
      for (const { client } of connections) {
        try { await client?.close?.(); } catch {}
      }
      connections.length = 0;
    }
  };
};
