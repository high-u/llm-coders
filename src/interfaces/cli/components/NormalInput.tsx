import React from 'react';
import { Text, Box, Newline } from 'ink';
import type { Coder } from '../../../usecases/chat/types';
import { splitGraphemes, graphemeCount, sliceByGrapheme } from './utilities/graphemes';
import { PromptHeader } from './promptHeader';
import type { UiColorConfig } from '../types';

export interface NormalInputProps {
  input: string;
  agentConfig: Coder;
  isProcessing: boolean;
  cursorPosition: number;
  uiColors: UiColorConfig;
}

export const NormalInput = ({
  input,
  agentConfig,
  isProcessing,
  cursorPosition,
  uiColors
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
        const isEmpty = graphemes.length === 0;
        const bom = '\uFEFF';
        
        return (
          <Text key={lineIndex} color={uiColors.base.foreground}>
            {lineIndex === 0 && (
              <PromptHeader name={agentConfig.name} color={agentConfig.color} separatorColor={uiColors.base.separator} />
            )}
            {isEmpty ? (
              // 空行の場合は半角スペースを挿入
              bom
            ) : (
              graphemes.map((g, charIndex) => {
                const isAtCursor = isCursorOnThisLine && charIndex === cursorColumn;
                
                // \nまたは\r文字の場合はNewlineコンポーネントを返す
                if (g === '\n' || g === '\r') {
                  return <Newline key={`${lineIndex}-${charIndex}`} />;
                }
                
                return (
                  <Text
                    key={`${lineIndex}-${charIndex}`}
                    backgroundColor={isAtCursor ? uiColors.selected.background : undefined}
                    color={isAtCursor ? uiColors.selected.foreground : undefined}
                  >
                    {g}
                  </Text>
                );
              })
            )}
            {atLineEnd && (
              <Text backgroundColor={uiColors.selected.background} color={uiColors.selected.foreground}> </Text>
            )}
          </Text>
        );
      })}
    </Box>
  );
};
