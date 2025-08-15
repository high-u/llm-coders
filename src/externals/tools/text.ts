import { promises as fs } from 'node:fs';
import path from 'node:path';
import MagicString from 'magic-string';
import type { ToolResult } from './types';

const cwd = process.cwd();
const toAbs = (p: string): string => path.resolve(cwd, p);
const insideCwd = (abs: string): boolean => {
  const normCwd = path.resolve(cwd) + path.sep;
  return (abs === path.resolve(cwd)) || (path.resolve(abs) + (abs.endsWith(path.sep) ? '' : '')).startsWith(normCwd);
};
const notice = (kv: string): ToolResult => ({ content: [{ text: `Notice: ${kv}` }] });

export async function editFile(args: { path: string; edits: { oldText: string; newText: string }[]; dryRun?: boolean }): Promise<ToolResult> {
  const userPath = args?.path ?? '';
  const edits = Array.isArray(args?.edits) ? args.edits : [];
  const abs = toAbs(userPath);
  if (!insideCwd(abs)) {
    return notice(`reason=path_outside_cwd; path=${userPath}`);
  }
  if (edits.length === 0) {
    return notice(`reason=edit_failed; not_found_indices=[]; path=${userPath}`);
  }
  let original: string;
  try {
    original = await fs.readFile(abs, 'utf8');
  } catch (e: any) {
    return notice(`reason=file_read_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
  }

  const s = new MagicString(original);
  const notFound: number[] = [];
  let totalReplacements = 0;

  for (let i = 0; i < edits.length; i++) {
    const { oldText, newText } = edits[i] ?? { oldText: '', newText: '' };
    if (!oldText) { notFound.push(i); continue; }
    let start = 0;
    let foundAny = false;
    while (true) {
      const idx = original.indexOf(oldText, start);
      if (idx === -1) break;
      foundAny = true;
      s.overwrite(idx, idx + oldText.length, newText ?? '');
      totalReplacements++;
      start = idx + oldText.length;
    }
    if (!foundAny) notFound.push(i);
  }

  if (notFound.length > 0) {
    return notice(`reason=edit_failed; not_found_indices=[${notFound.join(',')}]; path=${userPath}`);
  }

  const out = s.toString();
  if (!args?.dryRun) {
    try {
      await fs.writeFile(abs, out, 'utf8');
    } catch (e: any) {
      return notice(`reason=file_write_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
    }
  }
  return { content: [{ text: `OK: status=applied; replacements=${totalReplacements}; path=${userPath}; dryRun=${args?.dryRun ? 'true' : 'false'}` }] };
}

