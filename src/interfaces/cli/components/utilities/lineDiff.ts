// Minimal Patience line-diff for UI preview
// - Line-based only (no intra-line/word diff)
// - Output format: each line prefixed with one of "  ", "+ ", "- "
// - No headers, no hunk markers, no trailing-newline annotations

const splitLines = (text: string): string[] => {
  // Split on CRLF/CR/LF, keep last line even if text does not end with newline
  if (text === '') return [''];
  return text.split(/\r\n|\n|\r/);
};

// Compute patience anchors: indices of unique lines that preserve order in both texts
const computeAnchors = (a: string[], b: string[]): Array<{ ai: number; bi: number }> => {
  const aCount = new Map<string, number>();
  const bCount = new Map<string, number>();
  for (const s of a) aCount.set(s, (aCount.get(s) ?? 0) + 1);
  for (const s of b) bCount.set(s, (bCount.get(s) ?? 0) + 1);

  // Collect positions of lines that are unique in both sequences
  const aPos = new Map<string, number>();
  const bPos = new Map<string, number>();
  for (let i = 0; i < a.length; i++) if ((aCount.get(a[i]) ?? 0) === 1) aPos.set(a[i], i);
  for (let j = 0; j < b.length; j++) if ((bCount.get(b[j]) ?? 0) === 1) bPos.set(b[j], j);

  const pairs: Array<{ ai: number; bi: number }> = [];
  for (const [line, ai] of aPos) {
    const bj = bPos.get(line);
    if (bj != null) pairs.push({ ai, bi: bj });
  }
  // Sort by ai (order in a)
  pairs.sort((p, q) => p.ai - q.ai);

  // Extract LIS on bi to preserve order in b
  const n = pairs.length;
  if (n === 0) return [];
  const tails: number[] = []; // indices into pairs
  const prev: number[] = new Array(n).fill(-1);
  const idxAtLen: number[] = []; // index of pair ending each LIS length

  for (let i = 0; i < n; i++) {
    const bi = pairs[i].bi;
    // binary search on tails values (bi)
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pairs[tails[mid]].bi < bi) lo = mid + 1; else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    if (lo === tails.length) tails.push(i); else tails[lo] = i;
    idxAtLen[lo] = i;
  }

  // Reconstruct LIS
  const anchors: Array<{ ai: number; bi: number }> = [];
  let k = tails.length > 0 ? tails[tails.length - 1] : -1;
  while (k >= 0) {
    anchors.push(pairs[k]);
    k = prev[k];
  }
  anchors.reverse();
  return anchors;
};

// Produce a simple diff block for unmatched ranges: all deletions then all additions
const naiveBlock = (a: string[], aStart: number, aEnd: number, b: string[], bStart: number, bEnd: number, out: string[]): void => {
  for (let i = aStart; i < aEnd; i++) out.push(`- ${a[i]}`);
  for (let j = bStart; j < bEnd; j++) out.push(`+ ${b[j]}`);
};

export const diffLinesPatience = (oldText: string, newText: string): string => {
  const a = splitLines(oldText ?? '');
  const b = splitLines(newText ?? '');

  const out: string[] = [];
  const anchors = computeAnchors(a, b);

  let aPrev = 0;
  let bPrev = 0;
  if (anchors.length === 0) {
    naiveBlock(a, 0, a.length, b, 0, b.length, out);
    return out.join('\n');
  }

  for (const { ai, bi } of anchors) {
    // Unmatched region before this anchor
    if (aPrev < ai || bPrev < bi) {
      naiveBlock(a, aPrev, ai, b, bPrev, bi, out);
    }
    // The anchor line itself (equal)
    out.push(`  ${a[ai]}`);
    aPrev = ai + 1;
    bPrev = bi + 1;
  }

  // Tail region after last anchor
  if (aPrev < a.length || bPrev < b.length) {
    naiveBlock(a, aPrev, a.length, b, bPrev, b.length, out);
  }

  return out.join('\n');
};

export default diffLinesPatience;

