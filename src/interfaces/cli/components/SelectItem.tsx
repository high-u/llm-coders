import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
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
  onSelect: (item: Agent) => void;
  onCancel: () => void;
}

export const AutoCompleteInput = ({
  items,
  triggerChar,
  initialInput,
  agentConfig,
  onSelect,
  onCancel
}: AutoCompleteInputProps) => {
  const [input, setInput] = useState(initialInput);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // フィルタリング（完全に内部で完結）
  const filteredItems = useMemo(() => {
    const filterText = input.slice(1); // triggerCharを除く
    if (!filterText) return items;
    return items.filter(item => 
      item.name.toLowerCase().startsWith(filterText.toLowerCase())
    );
  }, [input, items]);

  // 全てのキー入力をここで処理（main.tsxとの競合ゼロ）
  useInput((inputChar, key) => {
    if (key.upArrow && filteredItems.length > 0) {
      setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredItems.length - 1);
    } else if (key.downArrow && filteredItems.length > 0) {
      setSelectedIndex(prev => prev < filteredItems.length - 1 ? prev + 1 : 0);
    } else if (key.return && filteredItems.length > 0) {
      // エージェント選択
      onSelect(filteredItems[selectedIndex]);
    } else if (key.escape) {
      // キャンセル
      onCancel();
    } else if (key.backspace || key.delete) {
      // Backspace処理
      const newInput = input.slice(0, -1);
      if (newInput.length > 0) {
        setInput(newInput);
        setSelectedIndex(0); // フィルタ変更時リセット
      } else {
        onCancel(); // 全削除でキャンセル
      }
    } else if (inputChar && !key.ctrl) {
      // 文字入力処理
      const newInput = input + inputChar;
      setInput(newInput);
      setSelectedIndex(0); // フィルタ変更時リセット
    }
  });

  return (
    <Box flexDirection="column">
      {/* 入力表示 */}
      <Text color={agentConfig.color}>
        {`${agentConfig.name} > ${input}_`}
      </Text>
      
      {/* オートコンプリートリスト */}
      {filteredItems.length > 0 && (
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
          {filteredItems.map((item, index) => (
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