// Note: Avoid externals→externals direct imports. Use minimal local types.

// Local event/result types to avoid coupling to LLM external types
export type ToolEvent = {
  type: 'chunk' | 'complete' | 'error';
  data?: string;
  error?: string;
};

export type ToolResult = {
  content?: { text?: string }[];
  // keep open for forward-compat
  [key: string]: any;
};

export interface ToolsExternal {
  callTool: (
    name: string,
    args: Record<string, any>,
    onEvent?: (event: ToolEvent) => void
  ) => Promise<ToolResult>;
}

export const createToolsExternal = (
  deps: {
    // minimal, structurally compatible shape (no direct import)
    mcp?: { callTool: (toolName: string, args: Record<string, unknown>) => Promise<any> };
    configuration: {
      getTools: () => { name: string; model?: string; systemPrompt?: string }[];
      // optional: provided by configuration external to resolve model settings
      getModelConfig?: (key: string) => { endpoint: string; modelId: string } | null;
    };
    // tolerate extra fields passed by callers (e.g., llm) without depending on them
    llm?: unknown;
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

    const modelCfg = configuration.getModelConfig?.(t.model);
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
    callTool: async (name, args, onEvent): Promise<ToolResult> => {
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
