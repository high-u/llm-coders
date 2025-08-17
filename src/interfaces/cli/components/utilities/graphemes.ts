// Utilities for grapheme-aware string operations using Intl.Segmenter.
// Falls back to Array.from when Segmenter is unavailable.

const getGraphemeSegmenter = () => {
  try {
    // Use any to avoid requiring TS lib for Intl.Segmenter
    const Seg = (Intl as any)?.Segmenter;
    if (!Seg) return null;
    return new Seg('en', { granularity: 'grapheme' });
  } catch {
    return null;
  }
};

const segmenter = getGraphemeSegmenter();

export const splitGraphemes = (s: string): string[] => {
  if (!s) return [];
  if (!segmenter) return Array.from(s);
  const iter = (segmenter as any).segment(s);
  const out: string[] = [];
  for (const seg of iter) {
    out.push(seg.segment);
  }
  return out;
};

export const graphemeCount = (s: string): number => splitGraphemes(s).length;

export const sliceByGrapheme = (s: string, start: number, end?: number): string => {
  const parts = splitGraphemes(s);
  const from = Math.max(0, Math.min(start, parts.length));
  const to = end === undefined ? parts.length : Math.max(0, Math.min(end, parts.length));
  if (to <= from) return '';
  return parts.slice(from, to).join('');
};

