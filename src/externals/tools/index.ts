import type { MCPExternal } from '../mcp';
import type { ConfigurationExternal } from '../configuration';
import type { StreamEvent as LlmStreamEvent, ToolResult as LlmToolResult } from '../llm/types';
import config from 'config';

export interface ToolsExternal {
  callTool: (
    name: string,
    args: Record<string, any>,
    onEvent?: (event: LlmStreamEvent) => void
  ) => Promise<LlmToolResult>;
}

export const createToolsExternal = (
  deps: {
    mcp?: MCPExternal;
    configuration: ConfigurationExternal;
  }
): ToolsExternal => {
  const { mcp, configuration } = deps;

  const resolveToolConfig = (toolName: string): {
    endpoint: string;
    modelId: string;
    systemPrompt?: string;
  } | null => {
    // configuration から tools と model を解決
    const tools = configuration.getTools?.() ?? [];
    const t = tools.find((x: any) => x?.name === toolName);
    if (!t || typeof t.model !== 'string') return null;

    const cfg: any = (config as any).util.toObject();
    const modelCfg = cfg?.model?.[t.model];
    if (!modelCfg || !modelCfg.endpoint || !modelCfg.modelId) return null;

    return {
      endpoint: modelCfg.endpoint,
      modelId: modelCfg.modelId,
      systemPrompt: typeof t.systemPrompt === 'string' ? t.systemPrompt : undefined
    };
  };

  const formatEndpoint = (baseEndpoint: string): string => {
    const trimmed = baseEndpoint.endsWith('/') ? baseEndpoint.slice(0, -1) : baseEndpoint;
    return `${trimmed}/chat/completions`;
  };

  const parseStreamChunk = (chunk: string): string[] => {
    return chunk
      .split('\n')
      .filter(line => line.trim() && line.startsWith('data: '));
  };

  return {
    callTool: async (name, args, onEvent): Promise<LlmToolResult> => {
      // 1) config 定義に存在するなら LLM 経由で実行
      const resolved = resolveToolConfig(name);
      if (resolved) {
        try {
          const userText = typeof args?.text === 'string' ? args.text : undefined;
          if (!userText) {
            return { content: [{ text: "Error: missing required parameter 'text'" }] } as any;
          }

          const url = formatEndpoint(resolved.endpoint);
          const headers = { 'Content-Type': 'application/json' } as const;
          const body = {
            model: resolved.modelId,
            stream: true,
            messages: [
              ...(resolved.systemPrompt ? [{ role: 'system', content: resolved.systemPrompt }] : []),
              { role: 'user', content: userText }
            ]
          };

          // リクエストログ（stderr）
          console.error(JSON.stringify({
            ts: new Date().toISOString(),
            source: 'tool',
            event: 'request',
            name,
            url,
            method: 'POST',
            headers,
            body
          }, null, 2));

          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });

          const reader = res.body?.getReader();
          if (!reader) throw new Error('Failed to get response reader');

          let aggregated = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = new TextDecoder().decode(value);
            const lines = parseStreamChunk(chunk);
            for (const line of lines) {
              if (line === 'data: [DONE]') continue;
              try {
                const data = JSON.parse(line.slice(6));
                const delta = data.choices?.[0]?.delta;
                const content = delta?.content;
                if (content) {
                  aggregated += content;
                  onEvent?.({ type: 'chunk', data: content });
                }
              } catch {}
            }
          }

          console.error(JSON.stringify({
            ts: new Date().toISOString(),
            source: 'tool',
            event: 'response_complete',
            name,
            response: { content: aggregated }
          }, null, 2));

          return { content: [{ text: aggregated }] } as any;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { content: [{ text: `Error: ${msg}` }] } as any;
        }
      }

      // 2) MCP へ委譲（存在すれば）
      if (mcp) {
        return await mcp.callTool(name, args);
      }

      // 3) どこにも存在しない
      return { content: [{ text: `Error: Tool '${name}' not found` }] } as any;
    }
  };
};
