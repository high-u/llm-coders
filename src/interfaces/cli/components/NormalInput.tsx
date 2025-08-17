import React from 'react';
import { Text, Box } from 'ink';
import type { Coder } from '../../../usecases/chat/types';

export interface NormalInputProps {
  input: string;
  agentConfig: Coder;
  isProcessing: boolean;
}

export const NormalInput = ({
  input,
  agentConfig,
  isProcessing
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
  
  return (
    <Box flexDirection="column">
      {lines.map((line, lineIndex) => (
        <Text key={lineIndex} color={agentConfig.color}>
          {lineIndex === 0 && `${agentConfig.name} > `}
          {Array.from(line).map((char, charIndex) => (
            <Text key={`${lineIndex}-${charIndex}`}>{char}</Text>
          ))}
          {lineIndex === lines.length - 1 && <Text>_</Text>}
        </Text>
      ))}
    </Box>
  );
};
