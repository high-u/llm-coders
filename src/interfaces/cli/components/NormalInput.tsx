import React, { useRef } from 'react';
import { Text, useInput } from 'ink';
import { Agent } from '../../../usecases/core/agentConfig';
import { createChunkNormalizer } from './utilities/inputNormalization';

export interface NormalInputProps {
  input: string;
  agentConfig: Agent;
  isProcessing: boolean;
  onInputChange: React.Dispatch<React.SetStateAction<string>>;
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

  // 共有の入力正規化ユーティリティ
  const normalizerRef = useRef(createChunkNormalizer());

  // 通常入力の処理
  useInput((inputChar, key) => {
    let chunk = inputChar;
    if (chunk && !key.ctrl) {
      // タイプ/ペーストのチャンクを正規化
      chunk = normalizerRef.current.normalize(chunk);
    }

    if (key.ctrl && inputChar === 'j') {
      // Ctrl+J で改行
      onInputChange(prev => prev + '\n');
    } else if (key.return) {
      // Enter で送信
      if (input.trim() && !isProcessing) {
        onSubmit(input);
      }
    } else if (key.backspace || key.delete) {
      // Backspace処理
      onInputChange(prev => prev.slice(0, -1));
    } else if (key.ctrl && inputChar === 'c') {
      // Ctrl+C で終了
      process.exit();
    } else if ((inputChar === '@' || inputChar === '/') && input === '') {
      // オートコンプリート開始
      onAutoCompleteStart(inputChar);
    } else if (inputChar && !key.ctrl && !isProcessing) {
      // 通常の文字入力
      onInputChange(prev => prev + chunk);
    }
  });

  // 入力表示
  if (isProcessing) {
    return null; // 処理中は表示しない
  }

  // レンダー時のデバッグ出力は削除
  
  // const newInputText = input.replace(/(\r\n)|(\r)/, "\n");
  // onInputChange(newInputText);

  return (
    <Text color={agentConfig.color}>
      {`${agentConfig.name} > ${input}_`}
    </Text>
  );
};
