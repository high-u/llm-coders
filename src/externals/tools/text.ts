import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ToolResult } from './types';

const cwd = process.cwd();
const toAbs = (p: string): string => path.resolve(cwd, p);
const insideCwd = (abs: string): boolean => {
  const normCwd = path.resolve(cwd) + path.sep;
  return (abs === path.resolve(cwd)) || (path.resolve(abs) + (abs.endsWith(path.sep) ? '' : '')).startsWith(normCwd);
};
const errorMsg = (kv: string): ToolResult => ({ content: [{ text: `Error: ${kv}` }] });
const success = (kv: string): ToolResult => ({ content: [{ text: `Success: ${kv}` }] });

export async function editTextFile(args: { path: string; edits: { oldText: string; newText: string }[]; dryRun?: boolean }): Promise<ToolResult> {
  const userPath = args?.path ?? '';
  const edits = Array.isArray(args?.edits) ? args.edits : [];
  const abs = toAbs(userPath);
  if (!insideCwd(abs)) {
    return errorMsg(`reason=path_outside_cwd; path=${userPath}`);
  }
  if (edits.length === 0) {
    return errorMsg(`reason=edit_failed; not_found_indices=[]; path=${userPath}`);
  }
  let original: string;
  try {
    original = await fs.readFile(abs, 'utf8');
  } catch (e: any) {
    return errorMsg(`reason=file_read_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
  }
  // Helper: escape regex metacharacters in a literal string
  const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Apply edits sequentially to the working content
  let working = original;
  const notFound: number[] = [];
  let totalReplacements = 0;

  for (let i = 0; i < edits.length; i++) {
    const e = edits[i] ?? { oldText: '', newText: '' };
    const oldText = String(e.oldText ?? '');
    const newText = String(e.newText ?? '');
    if (!oldText) { notFound.push(i); continue; }

    // Build a regex that matches oldText literally, but with EOL-insensitive matching
    const parts = oldText.split(/\r\n|\n|\r/g).map(escapeRegExp);
    const pattern = parts.join('(?:\r?\n)');
    const re = new RegExp(pattern, 'g');

    let count = 0;
    working = working.replace(re, () => { count++; return newText; });
    if (count === 0) notFound.push(i);
    totalReplacements += count;
  }

  if (notFound.length > 0) {
    return errorMsg(`reason=edit_failed; not_found_indices=[${notFound.join(',')}]; path=${userPath}`);
  }

  if (!args?.dryRun) {
    try {
      await fs.writeFile(abs, working, 'utf8');
    } catch (e: any) {
      return errorMsg(`reason=file_write_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
    }
  }
  return success(`action=edit_text_file; replacements=${totalReplacements}; path=${userPath}; dryRun=${args?.dryRun ? 'true' : 'false'}`);
}
