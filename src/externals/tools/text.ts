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
    return errorMsg(`reason=edit_failed; not_found_indices=[${notFound.join(',')}]; path=${userPath}`);
  }

  const out = s.toString();
  if (!args?.dryRun) {
    try {
      await fs.writeFile(abs, out, 'utf8');
    } catch (e: any) {
      return errorMsg(`reason=file_write_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
    }
  }
  return success(`action=edit_text_file; replacements=${totalReplacements}; path=${userPath}; dryRun=${args?.dryRun ? 'true' : 'false'}`);
}

export async function editTextFileByRange(args: { path: string; edits: { startLine: number; lineCount: number; newText: string }[]; dryRun?: boolean }): Promise<ToolResult> {
  const userPath = args?.path ?? '';
  const abs = toAbs(userPath);
  if (!insideCwd(abs)) {
    return errorMsg(`reason=path_outside_cwd; path=${userPath}`);
  }
  const edits = Array.isArray(args?.edits) ? args.edits : [];
  if (edits.length === 0) {
    return errorMsg(`reason=invalid_arguments; path=${userPath}; message="no edits"`);
  }

  let original: string;
  try {
    original = await fs.readFile(abs, 'utf8');
  } catch (e: any) {
    return errorMsg(`reason=file_read_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
  }

  // Detect line ending style
  const usesCRLF = original.includes('\r\n');
  const eol = usesCRLF ? '\r\n' : '\n';

  // Build array of line start indices (1-based lines -> 0-based indices)
  const lineStarts: number[] = [0];
  for (let i = 0; i < original.length; i++) {
    if (original.charCodeAt(i) === 10) { // '\n'
      lineStarts.push(i + 1);
    }
  }
  const totalLines = lineStarts.length; // last line start may be string.length if ends with newline? fine.

  type RangeEdit = { start: number; end: number; newText: string; startLine: number; lineCount: number };
  const rangeEdits: RangeEdit[] = [];
  let replacedLines = 0;
  let insertedLines = 0;

  for (let i = 0; i < edits.length; i++) {
    const e = edits[i] ?? ({} as any);
    const startLine = Number(e.startLine);
    const lineCount = Number(e.lineCount);
    if (!Number.isInteger(startLine) || !Number.isInteger(lineCount) || startLine < 1 || lineCount < 0) {
      return errorMsg(`reason=invalid_arguments; path=${userPath}; index=${i}; startLine=${e.startLine}; lineCount=${e.lineCount}`);
    }

    // Allowed startLine up to totalLines+1 for insertion at EOF
    if (startLine > totalLines + 1) {
      return errorMsg(`reason=range_out_of_bounds; path=${userPath}; index=${i}; startLine=${startLine}; totalLines=${totalLines}`);
    }

    // Compute start and end offsets
    const startIdx = startLine <= totalLines ? lineStarts[startLine - 1] : original.length; // start at EOF when startLine==totalLines+1
    let endIdx: number;
    if (lineCount === 0) {
      endIdx = startIdx; // insertion
    } else {
      const endLineExclusive = startLine - 1 + lineCount; // exclusive line index
      if (endLineExclusive > totalLines) {
        return errorMsg(`reason=range_out_of_bounds; path=${userPath}; index=${i}; startLine=${startLine}; lineCount=${lineCount}; totalLines=${totalLines}`);
      }
      endIdx = endLineExclusive < totalLines ? lineStarts[endLineExclusive] : original.length;
    }

    // Normalize new text EOLs to match file
    let newText = String(e.newText ?? '');
    newText = newText.replace(/\r\n|\r|\n/g, eol);

    rangeEdits.push({ start: startIdx, end: endIdx, newText, startLine, lineCount });
    if (lineCount > 0) replacedLines += lineCount; else insertedLines += (newText === '' ? 0 : (newText.split(eol).length));
  }

  // Detect overlapping ranges on the original snapshot
  const sorted = [...rangeEdits].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.start < prev.end) {
      return errorMsg(`reason=overlapping_ranges; path=${userPath}; atIndices=${i - 1},${i}`);
    }
  }

  // Apply in descending order of start to keep offsets stable
  const s = new MagicString(original);
  sorted
    .sort((a, b) => b.start - a.start || b.end - a.end)
    .forEach((r) => s.overwrite(r.start, r.end, r.newText));

  const out = s.toString();
  if (!args?.dryRun) {
    try {
      await fs.writeFile(abs, out, 'utf8');
    } catch (e: any) {
      return errorMsg(`reason=file_write_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
    }
  }
  return success(`action=edit_text_file_by_range; path=${userPath}; applied=${rangeEdits.length}; replacedLines=${replacedLines}; insertedLines=${insertedLines}; dryRun=${args?.dryRun ? 'true' : 'false'}`);
}
