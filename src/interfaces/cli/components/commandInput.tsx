import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ChatUseCases, Coder } from '../../../usecases/chat/types';
import { AutoCompleteInput } from './SelectItem';
import { NormalInput } from './NormalInput';
import { createChunkNormalizer } from './utilities/inputNormalization';
import type { CommandEntry } from '../types';

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
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const normalizerRef = useRef(createChunkNormalizer());

  // Approval dialog state
  const [pendingApproval, setPendingApproval] = useState<null | { name: string; args: Record<string, any> }>(null);
  const approvalResolverRef = useRef<null | ((ok: boolean) => void)>(null);

  // autocomplete helpers
  const isAutoCompleting = input.startsWith('@') || input.startsWith('/');
  const filteredItems = isAutoCompleting
    ? coders.filter(item => {
        const filterText = input.slice(1);
        if (!filterText) return true;
        return item.name.toLowerCase().startsWith(filterText.toLowerCase());
      })
    : [];

  const handleAutoCompleteStart = (triggerChar: string) => setInput(triggerChar);
  const handleAutoCompleteCancel = () => {
    setInput('');
    setSelectedIndex(0);
  };
  const handleCoderSelect = (coder: Coder) => {
    chatUseCases.clearHistory();
    onSelectCoder(coder);
    setInput('');
    setSelectedIndex(0);
  };

  const handleNormalSubmit = (text: string) => {
    if (text.trim() && !isProcessing) {
      callChat(text);
      setInput('');
    }
  };

  useInput((inputChar, key) => {
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

    let chunk = inputChar;
    if (chunk && !key.ctrl) {
      chunk = normalizerRef.current.normalize(chunk);
    }

    if (key.ctrl && inputChar === 'c') {
      process.exit(0);
      return;
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
        if (input.length > 1) {
          setInput(prev => prev.slice(0, -1));
          setSelectedIndex(0);
        } else {
          handleAutoCompleteCancel();
        }
      } else if (inputChar && !key.ctrl) {
        if (chunk) {
          setInput(prev => prev + chunk);
          setSelectedIndex(0);
        }
      }
      return;
    }

    // normal input mode
    if (key.ctrl && inputChar === 'j') {
      setInput(prev => prev + '\n');
    } else if (key.return) {
      if (input.trim() && !isProcessing) handleNormalSubmit(input);
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if ((inputChar === '@' || inputChar === '/') && input === '') {
      handleAutoCompleteStart(inputChar);
    } else if (inputChar && !key.ctrl && !isProcessing) {
      if (chunk) setInput(prev => prev + chunk);
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
          triggerChar={input[0]}
          initialInput={input}
          agentConfig={selectedCoder}
          selectedIndex={selectedIndex}
        />
      ) : (
        <NormalInput
          input={input}
          agentConfig={selectedCoder}
          isProcessing={isProcessing}
        />
      )}
    </Box>
  );
};

