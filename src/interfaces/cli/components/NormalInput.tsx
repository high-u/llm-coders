import React from 'react';
import { Text, Box } from 'ink';
import type { Coder } from '../../../usecases/chat/types';
import { splitGraphemes, graphemeCount, sliceByGrapheme } from './utilities/graphemes';

export interface NormalInputProps {
  input: string;
  agentConfig: Coder;
  isProcessing: boolean;
  cursorPosition: number;
}

export const NormalInput = ({
  input,
  agentConfig,
  isProcessing,
  cursorPosition
}: NormalInputProps) => {

  // 入力表示
  if (isProcessing) {
    return null; // 処理中は表示しない
  }

  // レンダー時のデバッグ出力は削除
  
  // const newInputText = input.replace(/(\r\n)|(\r)/, "\n");
  // onInputChange(newInputText);

  // 入力文字列を行に分割
  const lines = input.split('\n');

  // カーソル位置（書記素インデックス）を行・列に変換
  const getCursorLineAndColumn = (text: string, graphemePos: number) => {
    const before = sliceByGrapheme(text, 0, graphemePos);
    const linesBefore = before.split('\n');
    const lineIndex = linesBefore.length - 1;
    const columnGraphemes = linesBefore[linesBefore.length - 1] ?? '';
    return {
      line: lineIndex,
      column: graphemeCount(columnGraphemes)
    };
  };

  const { line: cursorLine, column: cursorColumn } = getCursorLineAndColumn(input, cursorPosition);
  
  return (
    <Box flexDirection="column">
      {lines.map((line, lineIndex) => {
        const graphemes = splitGraphemes(line);
        const isCursorOnThisLine = lineIndex === cursorLine;
        const atLineEnd = isCursorOnThisLine && cursorColumn === graphemes.length;
        return (
          <Text key={lineIndex} color={agentConfig.color}>
            {lineIndex === 0 && `${agentConfig.name} > `}
            {graphemes.map((g, charIndex) => {
              const isAtCursor = isCursorOnThisLine && charIndex === cursorColumn;
              return (
                <Text
                  key={`${lineIndex}-${charIndex}`}
                  backgroundColor={isAtCursor ? 'white' : undefined}
                  color={isAtCursor ? 'black' : undefined}
                >
                  {g}
                </Text>
              );
            })}
            {atLineEnd && (
              <Text backgroundColor="white" color="black"> </Text>
            )}
          </Text>
        );
      })}
    </Box>
  );
};
