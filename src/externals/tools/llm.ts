import type { ToolsExternal, ToolEvent, ToolResult } from './types';
import { readTextFile, writeFileAll, createDirectory, listDirectory, moveFile, searchFiles } from './file';
import { editTextFile } from './text';

// Utility for uniform Notice messages
const errorMsg = (kv: string): ToolResult => ({ content: [{ text: `Error: ${kv}` }] });

// Keep a minimal local formatter for OpenAI-compatible endpoints
const formatEndpoint = (baseEndpoint: string): string => {
  const trimmed = baseEndpoint.endsWith('/') ? baseEndpoint.slice(0, -1) : baseEndpoint;
  return `${trimmed}/chat/completions`;
};

// Parse streaming chunks in OpenAI-compatible SSE responses
const parseStreamChunk = (chunk: string): string[] => {
  return chunk
    .split('\n')
    .filter((line) => line.trim() && line.startsWith('data: '));
};

export const createToolsExternal = (
  deps: {
    mcp?: { callTool: (toolName: string, args: Record<string, unknown>) => Promise<any> };
    configuration: {
      getTools: () => { name: string; model?: string; systemPrompt?: string }[];
      getModelConfig?: (key: string) => { endpoint: string; modelId: string } | null;
    };
    llm?: unknown;
  }
): ToolsExternal => {
  const { mcp, configuration } = deps;

  // Built-in tool handlers
  const builtins: Record<string, (args: any, onEvent?: (event: ToolEvent) => void) => Promise<ToolResult>> = {
    // file ops
    read_text_file: (args) => readTextFile(args),
    write_file: (args) => writeFileAll(args),
    create_directory: (args) => createDirectory(args),
    list_directory: (args) => listDirectory(args),
    move_file: (args) => moveFile(args),
    search_files: (args) => searchFiles(args),
    // text ops
    edit_text_file: (args) => editTextFile(args)
  };

  const resolveConfigTool = (toolName: string): {
    endpoint: string;
    modelId: string;
    systemPrompt?: string;
  } | null => {
    const tools = configuration.getTools?.() ?? [];
    const t = tools.find((x: any) => x?.name === toolName);
    if (!t || typeof t.model !== 'string') return null;
    const modelCfg = configuration.getModelConfig?.(t.model);
    if (!modelCfg || !modelCfg.endpoint || !modelCfg.modelId) return null;
    return { endpoint: modelCfg.endpoint, modelId: modelCfg.modelId, systemPrompt: t.systemPrompt };
  };

  return {
    callTool: async (name, args, onEvent): Promise<ToolResult> => {
      // 1) Built-in tools take precedence
      const builtin = builtins[name];
      if (builtin) {
        try { return await builtin(args, onEvent); } catch (e: any) {
          return errorMsg(`reason=builtin_error; name=${name}; message=${JSON.stringify(e?.message ?? String(e))}`);
        }
      }

      // 2) Config-defined LLM-powered tools
      const cfg = resolveConfigTool(name);
      if (cfg) {
        try {
          const userText = typeof args?.text === 'string' ? args.text : undefined;
          if (!userText) return errorMsg(`reason=missing_argument; name=${name}; key=text`);
          const url = formatEndpoint(cfg.endpoint);
          const headers = { 'Content-Type': 'application/json' } as const;
          const body = {
            model: cfg.modelId,
            stream: true,
            messages: [
              ...(cfg.systemPrompt ? [{ role: 'system', content: cfg.systemPrompt }] : []),
              { role: 'user', content: userText }
            ]
          };

          const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
          const reader = res.body?.getReader();
          if (!reader) return errorMsg(`reason=response_reader_failed; name=${name}`);

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
          return { content: [{ text: aggregated }] };
        } catch (e: any) {
          return errorMsg(`reason=config_tool_error; name=${name}; message=${JSON.stringify(e?.message ?? String(e))}`);
        }
      }

      // 3) Fall back to MCP if available
      if (mcp) {
        try { return await mcp.callTool(name, args); } catch (e: any) {
          return errorMsg(`reason=mcp_error; name=${name}; message=${JSON.stringify(e?.message ?? String(e))}`);
        }
      }

      // 4) Not found anywhere
      return errorMsg(`reason=tool_not_found; name=${name}`);
    }
  };
};
