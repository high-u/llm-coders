import React from 'react';
import { Text, Box } from 'ink';
import type { Coder } from '../../../usecases/chat/types';

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
  
  // カーソル位置を行・列に変換
  const getCursorLineAndColumn = (input: string, cursorPos: number) => {
    const beforeCursor = input.slice(0, cursorPos);
    const lines = beforeCursor.split('\n');
    return {
      line: lines.length - 1,
      column: lines[lines.length - 1].length
    };
  };
  
  const { line: cursorLine, column: cursorColumn } = getCursorLineAndColumn(input, cursorPosition);
  
  return (
    <Box flexDirection="column">
      {lines.map((line, lineIndex) => (
        <Text key={lineIndex} color={agentConfig.color}>
          {lineIndex === 0 && `${agentConfig.name} > `}
          {Array.from(line).map((char, charIndex) => {
            const isAtCursor = lineIndex === cursorLine && charIndex === cursorColumn;
            return (
              <Text 
                key={`${lineIndex}-${charIndex}`}
                backgroundColor={isAtCursor ? 'white' : undefined}
                color={isAtCursor ? 'black' : undefined}
              >
                {char}
              </Text>
            );
          })}
          {/* 行末カーソル処理 */}
          {lineIndex === cursorLine && cursorColumn === line.length && (
            <Text backgroundColor="white" color="black"> </Text>
          )}
        </Text>
      ))}
    </Box>
  );
};
