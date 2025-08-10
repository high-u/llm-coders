import React from 'react';
import { Text, useInput } from 'ink';
import { Agent } from '../../../usecases/core/agentConfig';

export interface NormalInputProps {
  input: string;
  agentConfig: Agent;
  isProcessing: boolean;
  onInputChange: (input: string) => void;
  onSubmit: (input: string) => void;
  onAutoCompleteStart: (triggerChar: string) => void;
}

export const NormalInput = ({
  input,
  agentConfig,
  isProcessing,
  onInputChange,
  onSubmit,
  onAutoCompleteStart
}: NormalInputProps) => {

  // 通常入力の処理
  useInput((inputChar, key) => {
    if (key.return) {
      // Enter で送信
      if (input.trim() && !isProcessing) {
        onSubmit(input);
      }
    } else if (key.backspace || key.delete) {
      // Backspace処理
      const newInput = input.slice(0, -1);
      onInputChange(newInput);
    } else if (key.ctrl && inputChar === 'c') {
      // Ctrl+C で終了
      process.exit();
    } else if ((inputChar === '@' || inputChar === '/') && input === '') {
      // オートコンプリート開始
      onAutoCompleteStart(inputChar);
    } else if (inputChar && !key.ctrl && !isProcessing) {
      // 通常の文字入力
      const newInput = input + inputChar;
      onInputChange(newInput);
    }
  });

  // 入力表示
  if (isProcessing) {
    return null; // 処理中は表示しない
  }

  return (
    <Text color={agentConfig.color}>
      {`${agentConfig.name} > ${input}_`}
    </Text>
  );
};