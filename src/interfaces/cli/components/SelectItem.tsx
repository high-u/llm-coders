import React from 'react';
import { Box, Text } from 'ink';
import { Agent } from '../../../usecases/core/agentConfig';

export interface AutoCompleteItem {
  id: string;
  name: string;
  [key: string]: any;
}

export interface AutoCompleteInputProps {
  items: Agent[];
  triggerChar: string;
  initialInput: string;
  agentConfig: Agent;
  selectedIndex: number;
}

export const AutoCompleteInput = ({
  items,
  triggerChar,
  initialInput,
  agentConfig,
  selectedIndex
}: AutoCompleteInputProps) => {

  return (
    <Box flexDirection="column">
      {/* 入力表示 */}
      <Text color={agentConfig.color}>
        {`${agentConfig.name} > ${initialInput}_`}
      </Text>
      
      {/* オートコンプリートリスト */}
      {items.length > 0 && (
        <Box 
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingLeft={1}
          marginTop={0}
        >
          <Box marginBottom={1}>
            <Text color="white">Select an agent:</Text>
          </Box>
          {items.map((item, index) => (
            <Text
              key={item.id}
              color={index === selectedIndex ? 'yellow' : 'white'}
              backgroundColor={index === selectedIndex ? 'blue' : undefined}
            >
              {`${index === selectedIndex ? '> ' : '  '}${item.name}`}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text color="gray">Use ↑↓ to navigate, Enter to select, Esc to cancel</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
