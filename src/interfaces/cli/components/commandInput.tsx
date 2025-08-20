import React, { useState, useRef, useReducer } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ChatUseCases, Coder } from '../../../usecases/chat/types';
import { AutoCompleteInput } from './SelectItem';
import { NormalInput } from './NormalInput';
import { createChunkNormalizer } from './utilities/inputNormalization';
import type { CommandEntry } from '../types';
import { applyBackspace, applyDelete, applyInsert, applyNewline, moveLeft, moveRight, moveUp, moveDown } from './utilities/cursorEditing';
import { diffLinesPatience } from './utilities/lineDiff';

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
    | { type: 'delete' }
    | { type: 'newline' }
    | { type: 'moveLeft' }
    | { type: 'moveRight' }
    | { type: 'moveUp' }
    | { type: 'moveDown' }
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
      case 'delete': {
        const { text, pos } = applyDelete(state.text, state.pos);
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
      case 'moveUp': {
        const { pos } = moveUp(state.text, state.pos);
        return { ...state, pos };
      }
      case 'moveDown': {
        const { pos } = moveDown(state.text, state.pos);
        return { ...state, pos };
      }
      case 'reset':
        return { text: '', pos: 0 };
    }
  };

  const [state, dispatch] = useReducer(reducer, { text: '', pos: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // approval dialog list selection (0: Yes, 1: No)
  const [approvalSelectedIndex, setApprovalSelectedIndex] = useState(0);
  const normalizerRef = useRef(createChunkNormalizer());

  // Approval dialog state
  const [pendingApproval, setPendingApproval] = useState<null | { name: string; args: Record<string, any>; diffPreview?: string }>(null);
  const approvalResolverRef = useRef<null | ((decision: 'yes' | 'no' | 'escape') => void)>(null);

  // cancel / exit controls
  const cancelRequestedRef = useRef(false);
  const lastCtrlCTsRef = useRef<number | null>(null);
  const currentCommandIndexRef = useRef<number | null>(null);

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
    // Global cancel & exit handling
    if (key.ctrl && inputChar === 'c') {
      const now = Date.now();
      if (lastCtrlCTsRef.current && now - lastCtrlCTsRef.current <= 2000) {
        // second Ctrl+C within 2s -> exit
        process.exit(0);
        return;
      }
      // first Ctrl+C -> cancel to prompt
      lastCtrlCTsRef.current = now;
      cancelRequestedRef.current = true;
      // close approval if any (escape semantics)
      if (pendingApproval) {
        approvalResolverRef.current?.('escape');
        approvalResolverRef.current = null;
        setPendingApproval(null);
      }
      // stop processing UI
      if (isProcessing) {
        setIsProcessing(false);
        if (currentCommandIndexRef.current != null) {
          const idx = currentCommandIndexRef.current;
          setHistory(prev => prev.map((e, i) => i === idx ? { ...e, isStreaming: false } : e));
        }
      }
      // return focus to normal input
      dispatch({ type: 'reset' });
      return;
    }
    if (key.escape) {
      // Escape behaves like first Ctrl+C (cancel to prompt)
      cancelRequestedRef.current = true;
      if (pendingApproval) {
        approvalResolverRef.current?.('escape');
        approvalResolverRef.current = null;
        setPendingApproval(null);
      }
      if (isProcessing) {
        setIsProcessing(false);
        if (currentCommandIndexRef.current != null) {
          const idx = currentCommandIndexRef.current;
          setHistory(prev => prev.map((e, i) => i === idx ? { ...e, isStreaming: false } : e));
        }
      }
      dispatch({ type: 'reset' });
      return;
    }

    // approval dialog: list selection (Yes/No) with arrow/enter and shortcuts (y/n select only)
    if (pendingApproval) {
      if (key.upArrow || key.downArrow) {
        setApprovalSelectedIndex(prev => (prev === 0 ? 1 : 0));
        return;
      }
      if (key.return) {
        const decision: 'yes' | 'no' = approvalSelectedIndex === 0 ? 'yes' : 'no';
        approvalResolverRef.current?.(decision);
        approvalResolverRef.current = null;
        setPendingApproval(null);
        return;
      }
      if (inputChar?.toLowerCase?.() === 'y') {
        setApprovalSelectedIndex(0); // select Yes
        return;
      }
      if (inputChar?.toLowerCase?.() === 'n') {
        setApprovalSelectedIndex(1); // select No
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
    } else if (key.upArrow) {
      dispatch({ type: 'moveUp' });
    } else if (key.downArrow) {
      dispatch({ type: 'moveDown' });
    } else if (key.ctrl && inputChar === 'j') {
      dispatch({ type: 'newline' });
    } else if (key.return) {
      if (state.text.trim() && !isProcessing) handleNormalSubmit(state.text);
    } else if (key.backspace || key.delete) {
      dispatch({ type: 'backspace' });
    } else if (key.ctrl && inputChar === 'd') {
      dispatch({ type: 'delete' });
    } else if ((inputChar === '@' || inputChar === '/') && state.text === '') {
      handleAutoCompleteStart(inputChar);
    } else if (inputChar && !key.ctrl && !isProcessing) {
      if (chunk) {
        dispatch({ type: 'insert', chunk });
      }
    }
  });

  const callChat = async (prompt: string) => {
    cancelRequestedRef.current = false;
    setIsProcessing(true);
    const commandIndex = history.length;
    currentCommandIndexRef.current = commandIndex;
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
            const line = `\n[Tool] Confirm execution? ${name} ${argsText}\nUse ↑↓ to navigate, Enter to confirm. Shortcuts: y (select Yes), n (select No).`;
            accumulatedOutput += `\n${line}\n`;
            setHistory(prev => prev.map((entry, index) => index === commandIndex ? { ...entry, output: accumulatedOutput } : entry));
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
      ({ name, args }) => new Promise<'yes' | 'no' | 'escape'>((resolve) => {
        approvalResolverRef.current = resolve;
        // confirm 側でのみ承諾ダイアログを起動し、ここで diff を作成（行単位・Patience）
        let diffPreview: string | undefined = undefined;
        if (name === 'edit_text_file') {
          const path = String(args?.path ?? '');
          const edits = Array.isArray(args?.edits) ? args.edits : [];
          const chunks: string[] = [];
          for (let i = 0; i < edits.length; i++) {
            const e = edits[i] || {};
            const oldText = String(e?.oldText ?? '');
            const newText = String(e?.newText ?? '');
            const diff = diffLinesPatience(oldText, newText);
            chunks.push(diff);
          }
          diffPreview = chunks.join('\n\n');
        }
        setPendingApproval({ name, args, diffPreview });
        setApprovalSelectedIndex(0);
      }),
      () => !cancelRequestedRef.current
    );
  };

  return (
    <Box flexDirection="column">
      {pendingApproval ? (
        <Box flexDirection="column" borderStyle="single" borderColor="white" paddingX={1}>
          <Text color="yellow">Approve tool execution?</Text>
          <Text color="white">{`name=${pendingApproval.name}`}</Text>
          <Text color="gray">{`args=${JSON.stringify(pendingApproval.args).slice(0, 300)}`}</Text>
          {pendingApproval.diffPreview ? (
            <Box marginTop={1} flexDirection="column">
              <Text color="gray">Diff preview:</Text>
              <Box flexDirection="column">
                {pendingApproval.diffPreview.split(/\r?\n/).map((line, idx) => {
                  const color = line.startsWith('+') ? 'green' : line.startsWith('-') ? 'red' : 'white';
                  return (
                    <Text key={idx} color={color}>
                      {line}
                    </Text>
                  );
                })}
              </Box>
            </Box>
          ) : null}
          <Box marginTop={1} flexDirection="column">
            {['Yes (y)', 'No (n)'].map((label, idx) => (
              <Text
                key={label}
                color={idx === approvalSelectedIndex ? 'yellow' : 'white'}
                backgroundColor={idx === approvalSelectedIndex ? 'blue' : undefined}
              >
                {`${idx === approvalSelectedIndex ? '> ' : '  '}${label}`}
              </Text>
            ))}
            <Box marginTop={1}>
              <Text color="gray">Use ↑↓ to navigate, Enter to select. Shortcuts: y, n</Text>
            </Box>
          </Box>
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
