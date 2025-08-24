import React from 'react';
import { Box, Text } from 'ink';
import type { Coder } from '../../../usecases/chat/types';
import { PromptHeader } from './promptHeader';
import type { UiColorConfig } from '../types';

export interface AutoCompleteItem {
  id: string;
  name: string;
  [key: string]: any;
}

export interface AutoCompleteInputProps {
  items: Coder[];
  triggerChar: string;
  initialInput: string;
  agentConfig: Coder;
  selectedIndex: number;
  uiColors: UiColorConfig;
}

export const AutoCompleteInput = ({
  items,
  triggerChar,
  initialInput,
  agentConfig,
  selectedIndex,
  uiColors
}: AutoCompleteInputProps) => {

  return (
    <Box flexDirection="column">
      {/* 入力表示 */}
      <Text>
        <PromptHeader name={agentConfig.name} color={agentConfig.color} separatorColor={uiColors.base.separator} />
        <Text color={uiColors.base.foreground}>{`${initialInput}_`}</Text>
      </Text>
      
      {/* オートコンプリートリスト */}
      {items.length > 0 && (
        <Box 
          flexDirection="column"
          borderStyle="single"
          borderColor={uiColors.base.border}
          paddingLeft={1}
          marginTop={0}
        >
          <Box marginBottom={1}>
            <Text color={uiColors.base.foreground}>Select a coder:</Text>
          </Box>
          {items.map((item, index) => (
            <Text
              key={item.id}
              color={index === selectedIndex ? uiColors.selected.foreground : uiColors.base.foreground}
              backgroundColor={index === selectedIndex ? uiColors.selected.background : undefined}
            >
              {`${index === selectedIndex ? '> ' : '  '}${item.name}`}
            </Text>
          ))}
          <Box marginTop={1}>
            <Text color={uiColors.base.hint}>Use ↑↓ to navigate, Enter to select, Esc to cancel</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
