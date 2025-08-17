import React, { useState, useRef, useReducer } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ChatUseCases, Coder } from '../../../usecases/chat/types';
import { AutoCompleteInput } from './SelectItem';
import { NormalInput } from './NormalInput';
import { createChunkNormalizer } from './utilities/inputNormalization';
import type { CommandEntry } from '../types';
import { applyBackspace, applyInsert, applyNewline, moveLeft, moveRight } from './utilities/cursorEditing';

export interface CommandInputProps {
  chatUseCases: ChatUseCases;
  coders: Coder[];
  selectedCoder: Coder;
  onSelectCoder: (coder: Coder) => void;
  history: CommandEntry[];
  setHistory: React.Dispatch<React.SetStateAction<CommandEntry[]>>;
}

export const CommandInput = ({
  chatUseCases,
  coders,
  selectedCoder,
  onSelectCoder,
  history,
  setHistory
}: CommandInputProps) => {
  // reducerで入力テキストとカーソル位置（書記素インデックス）を一元管理
  type EditState = { text: string; pos: number };
  type Action =
    | { type: 'insert'; chunk: string }
    | { type: 'backspace' }
    | { type: 'newline' }
    | { type: 'moveLeft' }
    | { type: 'moveRight' }
    | { type: 'reset' };

  const reducer = (state: EditState, action: Action): EditState => {
    switch (action.type) {
      case 'insert': {
        const { text, pos } = applyInsert(state.text, state.pos, action.chunk);
        return { text, pos };
      }
      case 'backspace': {
        const { text, pos } = applyBackspace(state.text, state.pos);
        return { text, pos };
      }
      case 'newline': {
        const { text, pos } = applyNewline(state.text, state.pos);
        return { text, pos };
      }
      case 'moveLeft': {
        const { pos } = moveLeft(state.text, state.pos);
        return { ...state, pos };
      }
      case 'moveRight': {
        const { pos } = moveRight(state.text, state.pos);
        return { ...state, pos };
      }
      case 'reset':
        return { text: '', pos: 0 };
    }
  };

  const [state, dispatch] = useReducer(reducer, { text: '', pos: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const normalizerRef = useRef(createChunkNormalizer());

  // Approval dialog state
  const [pendingApproval, setPendingApproval] = useState<null | { name: string; args: Record<string, any> }>(null);
  const approvalResolverRef = useRef<null | ((ok: boolean) => void)>(null);

  // autocomplete helpers
  const isAutoCompleting = state.text.startsWith('@') || state.text.startsWith('/');
  const filteredItems = isAutoCompleting
    ? coders.filter(item => {
        const filterText = state.text.slice(1);
        if (!filterText) return true;
        return item.name.toLowerCase().startsWith(filterText.toLowerCase());
      })
    : [];

  const handleAutoCompleteStart = (triggerChar: string) => {
    dispatch({ type: 'reset' });
    dispatch({ type: 'insert', chunk: triggerChar });
  };
  const handleAutoCompleteCancel = () => {
    dispatch({ type: 'reset' });
    setSelectedIndex(0);
  };
  const handleCoderSelect = (coder: Coder) => {
    chatUseCases.clearHistory();
    onSelectCoder(coder);
    dispatch({ type: 'reset' });
    setSelectedIndex(0);
  };

  const handleNormalSubmit = (text: string) => {
    if (text.trim() && !isProcessing) {
      callChat(text);
      dispatch({ type: 'reset' });
    }
  };

  useInput((inputChar, key) => {
    // Ctrl+C should always terminate, even during approval
    if (key.ctrl && inputChar === 'c') {
      process.exit(0);
      return;
    }

    // approval dialog: only y/n/esc accepted
    if (pendingApproval) {
      if (inputChar?.toLowerCase?.() === 'y') {
        approvalResolverRef.current?.(true);
        approvalResolverRef.current = null;
        setPendingApproval(null);
        return;
      }
      if (inputChar?.toLowerCase?.() === 'n' || key.escape) {
        approvalResolverRef.current?.(false);
        approvalResolverRef.current = null;
        setPendingApproval(null);
        return;
      }
      return;
    }

    // Processing中は編集系操作を受け付けない（Ctrl+Cは先で処理済み）
    if (isProcessing) {
      return;
    }

    let chunk = inputChar;
    if (chunk && !key.ctrl) {
      // 貼り付けの場合（複数文字）はローカルnormalizerを使用
      if (chunk.length > 1) {
        const localNormalizer = createChunkNormalizer();
        chunk = localNormalizer.normalize(chunk);
      } else {
        chunk = normalizerRef.current.normalize(chunk);
      }
    }

    if (isAutoCompleting) {
      if (key.upArrow && filteredItems.length > 0) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (key.downArrow && filteredItems.length > 0) {
        setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (key.return && filteredItems.length > 0) {
        handleCoderSelect(filteredItems[selectedIndex]);
      } else if (key.escape) {
        handleAutoCompleteCancel();
      } else if (key.backspace || key.delete) {
        if (state.text.length > 1) {
          const next = state.text.slice(0, -1);
          dispatch({ type: 'reset' });
          if (next) dispatch({ type: 'insert', chunk: next });
          setSelectedIndex(0);
        } else {
          handleAutoCompleteCancel();
        }
      } else if (inputChar && !key.ctrl) {
        if (chunk) {
          dispatch({ type: 'insert', chunk });
          setSelectedIndex(0);
        }
      }
      return;
    }

    // normal input mode
    if (key.leftArrow) {
      dispatch({ type: 'moveLeft' });
    } else if (key.rightArrow) {
      dispatch({ type: 'moveRight' });
    } else if (key.ctrl && inputChar === 'j') {
      dispatch({ type: 'newline' });
    } else if (key.return) {
      if (state.text.trim() && !isProcessing) handleNormalSubmit(state.text);
    } else if (key.backspace || key.delete) {
      dispatch({ type: 'backspace' });
    } else if ((inputChar === '@' || inputChar === '/') && state.text === '') {
      handleAutoCompleteStart(inputChar);
    } else if (inputChar && !key.ctrl && !isProcessing) {
      if (chunk) {
        dispatch({ type: 'insert', chunk });
      }
    }
  });

  const callChat = async (prompt: string) => {
    setIsProcessing(true);
    const commandIndex = history.length;
    setHistory(prev => [...prev, { command: prompt, output: '', isStreaming: true, agentName: selectedCoder.name }]);

    let accumulatedOutput = '';

    await chatUseCases.chat(
      selectedCoder,
      prompt,
      (event) => {
        switch (event.type) {
          case 'chunk':
            if (event.data) {
              accumulatedOutput += event.data;
              setHistory(prev => prev.map((entry, index) => index === commandIndex ? { ...entry, output: accumulatedOutput } : entry));
            }
            break;
          case 'tool_call_start': {
            const toolName = event.tool_call?.function?.name || 'unknown';
            const line = `\n[Tool] Executing tool: ${toolName} ...\n`;
            accumulatedOutput += line;
            setHistory(prev => prev.map((entry, index) => index === commandIndex ? { ...entry, output: accumulatedOutput } : entry));
            break;
          }
          case 'tool_call_result': {
            const line = `\n[Tool] Completed tool execution.\n`;
            accumulatedOutput += line;
            setHistory(prev => prev.map((entry, index) => index === commandIndex ? { ...entry, output: accumulatedOutput } : entry));
            break;
          }
          case 'tool_call_error': {
            const err = event.error || 'Unknown error';
            const line = `\n[Tool] Tool execution failed: ${err}\n`;
            accumulatedOutput += line;
            setHistory(prev => prev.map((entry, index) => index === commandIndex ? { ...entry, output: accumulatedOutput } : entry));
            break;
          }
          case 'tool_approval_request': {
            const name = event.approval?.name || event.tool_call?.function?.name || 'unknown';
            const args = event.approval?.args ?? {};
            const argsText = JSON.stringify(args).slice(0, 300);
            const line = `\n[Tool] Confirm execution? ${name} ${argsText}\nPress y to allow, n to deny.`;
            accumulatedOutput += `\n${line}\n`;
            setHistory(prev => prev.map((entry, index) => index === commandIndex ? { ...entry, output: accumulatedOutput } : entry));
            setPendingApproval({ name, args });
            break;
          }
          case 'tool_approval_result': {
            const approved = !!event.approval?.approved;
            const line = approved ? `\n[Tool] Approval: accepted.` : `\n[Tool] Approval: denied.`;
            accumulatedOutput += `${line}\n`;
            setHistory(prev => prev.map((entry, index) => index === commandIndex ? { ...entry, output: accumulatedOutput } : entry));
            break;
          }
          case 'complete':
            setHistory(prev => prev.map((entry, index) => index === commandIndex ? { ...entry, isStreaming: false } : entry));
            setIsProcessing(false);
            break;
          case 'error':
            setHistory(prev => prev.map((entry, index) => index === commandIndex ? { ...entry, output: `Error: ${event.error}`, isStreaming: false } : entry));
            setIsProcessing(false);
            break;
        }
      },
      ({ name, args }) => new Promise<boolean>((resolve) => {
        approvalResolverRef.current = resolve;
        setPendingApproval({ name, args });
      })
    );
  };

  return (
    <Box flexDirection="column">
      {pendingApproval ? (
        <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text color="yellow">Approve tool execution?</Text>
          <Text color="white">{`name=${pendingApproval.name}`}</Text>
          <Text color="gray">{`args=${JSON.stringify(pendingApproval.args).slice(0, 300)}`}</Text>
          <Text color="gray">Press y to allow, n to deny</Text>
        </Box>
      ) : isAutoCompleting ? (
        <AutoCompleteInput
          items={filteredItems}
          triggerChar={state.text[0]}
          initialInput={state.text}
          agentConfig={selectedCoder}
          selectedIndex={selectedIndex}
        />
      ) : (
        <NormalInput
          input={state.text}
          agentConfig={selectedCoder}
          isProcessing={isProcessing}
          cursorPosition={state.pos}
        />
      )}
    </Box>
  );
};
