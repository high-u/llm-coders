import type { ConfigTool } from '../../externals/configuration/types';
import type { McpTool } from './toolTypes';

const NAME_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9]|[_-](?=[A-Za-z0-9]))*[A-Za-z0-9]$/;

const err = (msg: string): void => {
  // 現状ポリシー: 検証エラーはアプリを止めず、stderr に英語で出すのみ
  console.error(msg);
};

export const sanitizeConfigTools = (tools: ConfigTool[]): ConfigTool[] => {
  const seen = new Set<string>();
  const out: ConfigTool[] = [];
  for (const t of tools) {
    const name = t.name;
    if (!NAME_REGEX.test(name)) {
      err(`[validation] Skipping config tool '${name}': invalid name`);
      continue;
    }
    if (seen.has(name)) {
      err(`[validation] Skipping duplicate config tool '${name}'`);
      continue;
    }
    seen.add(name);
    out.push(t);
  }
  return out;
};

export const sanitizeMcpTools = (tools: McpTool[], existingNames?: Set<string>): McpTool[] => {
  const seen = new Set<string>();
  const out: McpTool[] = [];
  for (const t of tools) {
    const name = t.name;
    if (!NAME_REGEX.test(name)) {
      err(`[validation] Skipping MCP tool '${name}': invalid name`);
      continue;
    }
    if (existingNames && existingNames.has(name)) {
      err(`[validation] Skipping MCP tool '${name}': conflicts with config tool`);
      continue;
    }
    if (seen.has(name)) {
      err(`[validation] Skipping duplicate MCP tool '${name}'`);
      continue;
    }
    seen.add(name);
    out.push(t);
  }
  return out;
};

