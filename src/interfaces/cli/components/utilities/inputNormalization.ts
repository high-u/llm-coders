export interface ChunkNormalizer {
  normalize: (chunk: string) => string;
  reset: () => void;
}

// Factory that returns a normalizer which:
// - Removes bracketed paste markers (\x1b[200~ / \x1b[201~)
// - Absorbs CRLF splits across chunks (prev ends with \r and next starts with \n)
// - Converts remaining CR to LF
export const createChunkNormalizer = (): ChunkNormalizer => {
  let lastEndedWithCR = false;

  return {
    normalize: (raw: string): string => {
      let chunk = raw;
      // Strip bracketed paste markers if present
      chunk = chunk.replace(/\x1b\[200~|\x1b\[201~/g, '');
      // Collapse CRLF within the same chunk to a single LF
      chunk = chunk.replace(/\r\n/g, '\n');

      // If previous chunk ended with CR and this starts with LF, drop leading LF
      if (lastEndedWithCR && chunk.startsWith('\n')) {
        chunk = chunk.slice(1);
      }

      // Track CR at end before replacement
      const endsWithCR = chunk.endsWith('\r');
      // Normalize CR -> LF
      chunk = chunk.replace(/\r/g, '\n');

      // Update state for next call
      lastEndedWithCR = endsWithCR;
      return chunk;
    },
    reset: () => {
      lastEndedWithCR = false;
    }
  };
};
