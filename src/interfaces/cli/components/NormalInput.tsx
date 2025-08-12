import React from 'react';
import { Text } from 'ink';
import { Agent } from '../../../usecases/core/agentConfig';

export interface NormalInputProps {
  input: string;
  agentConfig: Agent;
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

  return (
    <Text color={agentConfig.color}>
      {`${agentConfig.name} > ${input}_`}
    </Text>
  );
};
