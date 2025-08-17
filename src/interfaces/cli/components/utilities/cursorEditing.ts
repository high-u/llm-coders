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

export const moveUp = (text: string, pos: number): { pos: number } => {
  const lines = text.split('\n');
  
  // Calculate current line and column
  const before = sliceByGrapheme(text, 0, pos);
  const linesBefore = before.split('\n');
  const currentLine = linesBefore.length - 1;
  const currentColumn = graphemeCount(linesBefore[linesBefore.length - 1] ?? '');
  
  // If already at the first line, stay at the beginning
  if (currentLine <= 0) {
    return { pos: 0 };
  }
  
  // Move to the previous line
  const targetLine = currentLine - 1;
  const targetLineText = lines[targetLine] ?? '';
  const targetColumn = Math.min(currentColumn, graphemeCount(targetLineText));
  
  // Calculate the position in the target line
  let newPos = 0;
  for (let i = 0; i < targetLine; i++) {
    newPos += graphemeCount(lines[i] ?? '') + 1; // +1 for newline
  }
  newPos += targetColumn;
  
  return { pos: newPos };
};

export const moveDown = (text: string, pos: number): { pos: number } => {
  const lines = text.split('\n');
  
  // Calculate current line and column
  const before = sliceByGrapheme(text, 0, pos);
  const linesBefore = before.split('\n');
  const currentLine = linesBefore.length - 1;
  const currentColumn = graphemeCount(linesBefore[linesBefore.length - 1] ?? '');
  
  // If already at the last line, stay at the end
  if (currentLine >= lines.length - 1) {
    return { pos: graphemeCount(text) };
  }
  
  // Move to the next line
  const targetLine = currentLine + 1;
  const targetLineText = lines[targetLine] ?? '';
  const targetColumn = Math.min(currentColumn, graphemeCount(targetLineText));
  
  // Calculate the position in the target line
  let newPos = 0;
  for (let i = 0; i < targetLine; i++) {
    newPos += graphemeCount(lines[i] ?? '') + 1; // +1 for newline
  }
  newPos += targetColumn;
  
  return { pos: newPos };
};

