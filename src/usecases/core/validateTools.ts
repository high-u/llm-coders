import type { McpTool } from './toolTypes';

export interface DomainConfigTool {
  name: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
}

export interface SanitizedResult<T> {
  sanitized: T[];
  errors: string[];
}

const NAME_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9]|[_-](?=[A-Za-z0-9]))*[A-Za-z0-9]$/;

export const sanitizeConfigTools = (tools: DomainConfigTool[]): SanitizedResult<DomainConfigTool> => {
  const seen = new Set<string>();
  const out: DomainConfigTool[] = [];
  const errors: string[] = [];
  for (const t of tools) {
    const name = t.name;
    if (!NAME_REGEX.test(name)) {
      errors.push(`[validation] Skipping config tool '${name}': invalid name`);
      continue;
    }
    if (seen.has(name)) {
      errors.push(`[validation] Skipping duplicate config tool '${name}'`);
      continue;
    }
    seen.add(name);
    out.push(t);
  }
  return { sanitized: out, errors };
};

export const sanitizeMcpTools = (
  tools: McpTool[],
  existingNames?: Set<string>
): SanitizedResult<McpTool> => {
  const seen = new Set<string>();
  const out: McpTool[] = [];
  const errors: string[] = [];
  for (const t of tools) {
    const name = t.name;
    if (!NAME_REGEX.test(name)) {
      errors.push(`[validation] Skipping MCP tool '${name}': invalid name`);
      continue;
    }
    if (existingNames && existingNames.has(name)) {
      errors.push(`[validation] Skipping MCP tool '${name}': conflicts with config tool`);
      continue;
    }
    if (seen.has(name)) {
      errors.push(`[validation] Skipping duplicate MCP tool '${name}'`);
      continue;
    }
    seen.add(name);
    out.push(t);
  }
  return { sanitized: out, errors };
};
