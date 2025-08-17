import { graphemeCount, sliceByGrapheme } from './graphemes';

export interface EditResult {
  text: string;
  pos: number; // grapheme index
}

export const applyInsert = (text: string, pos: number, insert: string): EditResult => {
  if (!insert) return { text, pos };
  const head = sliceByGrapheme(text, 0, pos);
  const tail = sliceByGrapheme(text, pos);
  const newText = head + insert + tail;
  const newPos = pos + graphemeCount(insert);
  return { text: newText, pos: newPos };
};

export const applyBackspace = (text: string, pos: number): EditResult => {
  if (pos <= 0) return { text, pos };
  const head = sliceByGrapheme(text, 0, pos - 1);
  const tail = sliceByGrapheme(text, pos);
  return { text: head + tail, pos: pos - 1 };
};

export const applyNewline = (text: string, pos: number): EditResult => {
  return applyInsert(text, pos, '\n');
};

export const moveLeft = (text: string, pos: number): { pos: number } => {
  return { pos: Math.max(0, pos - 1) };
};

export const moveRight = (text: string, pos: number): { pos: number } => {
  return { pos: Math.min(graphemeCount(text), pos + 1) };
};

