import { promises as fs } from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import type { ToolResult } from './types';

const cwd = process.cwd();

const toAbs = (p: string): string => path.resolve(cwd, p);
const toRel = (abs: string): string => path.relative(cwd, abs) || '.';
const insideCwd = (abs: string): boolean => {
  const normCwd = path.resolve(cwd) + path.sep;
  const norm = path.resolve(abs) + (abs.endsWith(path.sep) ? '' : '');
  return (abs === path.resolve(cwd)) || norm.startsWith(normCwd);
};

const errorMsg = (kv: string): ToolResult => ({ content: [{ text: `Error: ${kv}` }] });
const success = (kv: string): ToolResult => ({ content: [{ text: `Success: ${kv}` }] });

export async function readTextFile(args: { path: string; head?: number; tail?: number }): Promise<ToolResult> {
  const userPath = args?.path ?? '';
  const abs = toAbs(userPath);
  if (!insideCwd(abs)) {
    return errorMsg(`reason=path_outside_cwd; path=${userPath}`);
  }
  if (args.head != null && args.tail != null) {
    return errorMsg(`reason=head_and_tail_conflict; path=${userPath}`);
  }
  try {
    const data = await fs.readFile(abs, 'utf8');
    if (typeof args.head === 'number' && args.head >= 0) {
      const lines = data.split(/\r?\n/).slice(0, args.head);
      return { content: [{ text: lines.join('\n') }] };
    }
    if (typeof args.tail === 'number' && args.tail >= 0) {
      const parts = data.split(/\r?\n/);
      const lines = parts.slice(Math.max(0, parts.length - args.tail));
      return { content: [{ text: lines.join('\n') }] };
    }
    return { content: [{ text: data }] };
  } catch (e: any) {
    return errorMsg(`reason=file_read_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
  }
}

export async function writeFileAll(args: { content: string; path: string }): Promise<ToolResult> {
  const userPath = args?.path ?? '';
  const abs = toAbs(userPath);
  if (!insideCwd(abs)) {
    return errorMsg(`reason=path_outside_cwd; path=${userPath}`);
  }
  const parent = path.dirname(abs);
  try {
    const st = await fs.stat(parent).catch(() => null);
    if (!st || !st.isDirectory()) {
      return errorMsg(`reason=parent_directory_missing; path=${userPath}; parent=${toRel(parent)}`);
    }
    await fs.writeFile(abs, args.content ?? '', 'utf8');
    return success(`action=write_file; path=${userPath}; bytes=${Buffer.byteLength(args.content ?? '', 'utf8')}`);
  } catch (e: any) {
    return errorMsg(`reason=file_write_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
  }
}

export async function createDirectory(args: { path: string }): Promise<ToolResult> {
  const userPath = args?.path ?? '';
  const abs = toAbs(userPath);
  if (!insideCwd(abs)) {
    return errorMsg(`reason=path_outside_cwd; path=${userPath}`);
  }
  try {
    await fs.mkdir(abs, { recursive: true });
    return success(`action=create_directory; path=${userPath}`);
  } catch (e: any) {
    return errorMsg(`reason=mkdir_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
  }
}

export async function listDirectory(args: { path: string }): Promise<ToolResult> {
  const userPath = args?.path ?? '';
  const abs = toAbs(userPath);
  if (!insideCwd(abs)) {
    return errorMsg(`reason=path_outside_cwd; path=${userPath}`);
  }
  try {
    const st = await fs.stat(abs);
    if (!st.isDirectory()) {
      return errorMsg(`reason=not_a_directory; path=${userPath}`);
    }
    const entries = await fs.readdir(abs, { withFileTypes: true });
    const items = entries
      .map((d) => ({ name: d.name, isDir: d.isDirectory() }))
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
      .map((e) => (e.isDir ? `[DIR] ${e.name}/` : `[FILE] ${e.name}`));
    return { content: [{ text: items.join('\n') }] };
  } catch (e: any) {
    return errorMsg(`reason=list_error; path=${userPath}; message=${JSON.stringify(e?.message ?? String(e))}`);
  }
}

export async function moveFile(args: { source: string; destination: string }): Promise<ToolResult> {
  const srcUser = args?.source ?? '';
  const dstUser = args?.destination ?? '';
  const srcAbs = toAbs(srcUser);
  const dstAbs = toAbs(dstUser);
  if (!insideCwd(srcAbs)) return errorMsg(`reason=path_outside_cwd; path=${srcUser}`);
  if (!insideCwd(dstAbs)) return errorMsg(`reason=path_outside_cwd; path=${dstUser}`);
  try {
    const dstExists = await fs.stat(dstAbs).then(() => true).catch(() => false);
    if (dstExists) {
      return errorMsg(`reason=destination_exists; destination=${dstUser}`);
    }
    await fs.rename(srcAbs, dstAbs);
    return success(`action=move_file; source=${srcUser}; destination=${dstUser}`);
  } catch (e: any) {
    return errorMsg(`reason=move_error; source=${srcUser}; destination=${dstUser}; message=${JSON.stringify(e?.message ?? String(e))}`);
  }
}

export async function searchFiles(args: { path: string; pattern: string; excludePatterns?: string[] }): Promise<ToolResult> {
  const userPath = args?.path ?? '';
  const abs = toAbs(userPath);
  if (!insideCwd(abs)) {
    return errorMsg(`reason=path_outside_cwd; path=${userPath}`);
  }
  const pattern = String(args?.pattern ?? '*');
  const excludes = Array.isArray(args?.excludePatterns) ? args.excludePatterns : [];
  const isMatch = picomatch(pattern, { nocase: true, dot: true });
  const isExcluded = excludes.length > 0 ? picomatch(excludes, { nocase: true, dot: true }) : null;

  const results: string[] = [];

  const walk = async (dirAbs: string, baseAbs: string) => {
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch (e: any) {
      // skip unreadable dirs
      return;
    }
    for (const ent of entries) {
      const childAbs = path.join(dirAbs, ent.name);
      const relFromBase = path.relative(baseAbs, childAbs).replace(/\\/g, '/');
      if (isExcluded && isExcluded(relFromBase)) continue;
      const matchTarget = relFromBase;
      if (isMatch(matchTarget)) {
        results.push(path.relative(cwd, childAbs));
      }
      if (ent.isDirectory()) {
        await walk(childAbs, baseAbs);
      }
    }
  };

  await walk(abs, abs);
  return { content: [{ text: results.join('\n') }] };
}
