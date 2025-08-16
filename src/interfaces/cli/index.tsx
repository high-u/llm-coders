import React, {useState, useRef} from 'react';
import {Text, Box, useInput} from 'ink';
import {AutoCompleteInput} from './components/SelectItem';
import {NormalInput} from './components/NormalInput';
import { Coder } from '../../usecases/core/agentConfig';
import { convertToDisplayItems } from '../../usecases/core/agentConfig';
import { ChatUseCases } from '../../usecases/chat/chatUseCases';
import { createChunkNormalizer } from './components/utilities/inputNormalization';

const asciiArt = `
  ██████┐   ██████┐   ██████┐   ████████┐ ██████┐     ██████┐ 
██┌─────┘ ██┌─────██┐ ██┌───██┐ ██┌─────┘ ██┌───██┐ ██┌─────┘
██│       ██│     ██│ ██│   ██│ ██████│   ██████┌─┘ ████████┐
██│       ██│     ██│ ██│   ██│ ██┌───┘   ██┌───██┐ └─────██│
└─██████┐ └─██████┌─┘ ██████┌─┘ ████████┐ ██│   ██│ ██████┌─┘
  └─────┘   └─────┘   └─────┘   └───────┘ └─┘   └─┘ └─────┘
`;

interface CommandEntry {
	command: string;
	output: string;
	isStreaming?: boolean;
	agentName: string;
}

export interface CommandInterfaceProps {
  chatUseCases: ChatUseCases;
}

export const CommandInterface = ({ chatUseCases }: CommandInterfaceProps) => {
	const [input, setInput] = useState('');
	const [history, setHistory] = useState<CommandEntry[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const normalizerRef = useRef(createChunkNormalizer());

  // 承諾ダイアログ状態
  const [pendingApproval, setPendingApproval] = useState<null | { name: string; args: Record<string, any> }>(null);
  const approvalResolverRef = useRef<null | ((ok: boolean) => void)>(null);
	
	const coders: Coder[] = chatUseCases.getCoders();
	const [selectedCoderConfig, setSelectedCoderConfig] = useState<Coder>(coders[0]);

	// コーダーをAutoCompleteInput用に変換
	const coderItems = convertToDisplayItems(coders);

	// オートコンプリート判定
	const isAutoCompleting = input.startsWith('@') || input.startsWith('/');
	
	// フィルタリングされたアイテム（オートコンプリート時のみ）
	const filteredItems = isAutoCompleting
		? coderItems.filter(item => {
				const filterText = input.slice(1);
				if (!filterText) return true;
				return item.name.toLowerCase().startsWith(filterText.toLowerCase());
			})
		: [];

	// 通常入力の送信処理
	const handleNormalSubmit = (text: string) => {
		if (text.trim() && !isProcessing) {
			callOllamaAPI(text);
			setInput('');
		}
	};

	// オートコンプリート開始
	const handleAutoCompleteStart = (triggerChar: string) => {
		setInput(triggerChar);
	};

	// コーダー選択
	const handleCoderSelect = (coder: Coder) => {
		chatUseCases.clearHistory(); // 履歴クリア
		setSelectedCoderConfig(coder);
		setInput(''); // 通常入力に戻る
		setSelectedIndex(0); // インデックスリセット
	};

	// オートコンプリートキャンセル
	const handleAutoCompleteCancel = () => {
		setInput(''); // 通常入力に戻る
		setSelectedIndex(0); // インデックスリセット
	};

	// 共通キー入力処理
	useInput((inputChar, key) => {
		// 承諾ダイアログ中は y/n のみ受け付け
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
			return; // 他入力は無視
		}
		let chunk = inputChar;
		if (chunk && !key.ctrl) {
			chunk = normalizerRef.current.normalize(chunk);
		}

		// 共通のCtrl+C処理
		if (key.ctrl && inputChar === 'c') {
			process.exit(0);
		} else if (isAutoCompleting) {
			// オートコンプリート時の処理
			if (key.upArrow && filteredItems.length > 0) {
				setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredItems.length - 1);
			} else if (key.downArrow && filteredItems.length > 0) {
				setSelectedIndex(prev => prev < filteredItems.length - 1 ? prev + 1 : 0);
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
		} else {
			// 通常入力時の処理
			if (key.ctrl && inputChar === 'j') {
				setInput(prev => prev + '\n');
			} else if (key.return) {
				if (input.trim() && !isProcessing) {
					handleNormalSubmit(input);
				}
			} else if (key.backspace || key.delete) {
				setInput(prev => prev.slice(0, -1));
			} else if ((inputChar === '@' || inputChar === '/') && input === '') {
				handleAutoCompleteStart(inputChar);
			} else if (inputChar && !key.ctrl && !isProcessing) {
				if (chunk) {
					setInput(prev => prev + chunk);
				}
			}
		}
	});

	const callOllamaAPI = async (prompt: string) => {
		setIsProcessing(true);
		
		const commandIndex = history.length;
		setHistory(prev => [...prev, { command: prompt, output: '', isStreaming: true, agentName: selectedCoderConfig.name }]);

		let accumulatedOutput = '';

		// ChatUseCasesに処理を委譲
		await chatUseCases.chat(
			selectedCoderConfig,
			prompt,
			(event) => {
				// 既存のUI更新ロジックはそのまま
				switch (event.type) {
					case 'chunk':
						if (event.data) {
							accumulatedOutput += event.data;
							setHistory(prev => prev.map((entry, index) => 
								index === commandIndex 
									? { ...entry, output: accumulatedOutput }
									: entry
							));
						}
						break;

					case 'tool_call_start':
						{
							const toolName = event.tool_call?.function?.name || 'unknown';
							const line = `\n[Tool] Executing tool: ${toolName} ...\n`;
							accumulatedOutput += line;
							setHistory(prev => prev.map((entry, index) => 
								index === commandIndex 
									? { ...entry, output: accumulatedOutput }
									: entry
							));
						}
						break;

					case 'tool_call_result':
						{
							const line = `\n[Tool] Completed tool execution.\n`;
							accumulatedOutput += line;
							setHistory(prev => prev.map((entry, index) => 
								index === commandIndex 
									? { ...entry, output: accumulatedOutput }
									: entry
							));
						}
						break;

					case 'tool_call_error':
						{
							const err = event.error || 'Unknown error';
							const line = `\n[Tool] Tool execution failed: ${err}\n`;
							accumulatedOutput += line;
							setHistory(prev => prev.map((entry, index) => 
								index === commandIndex 
									? { ...entry, output: accumulatedOutput }
									: entry
							));
						}
						break;

					case 'tool_approval_request':
						{
							const name = event.approval?.name || event.tool_call?.function?.name || 'unknown';
							const args = event.approval?.args ?? {};
							const argsText = JSON.stringify(args).slice(0, 300);
							const line = `\n[Tool] Confirm execution? ${name} ${argsText}\nPress y to allow, n to deny.`;
							accumulatedOutput += `\n${line}\n`;
							setHistory(prev => prev.map((entry, index) => 
								index === commandIndex 
									? { ...entry, output: accumulatedOutput }
									: entry
							));
							setPendingApproval({ name, args });
						}
						break;

					case 'tool_approval_result':
						{
							const approved = !!event.approval?.approved;
							const line = approved ? `\n[Tool] Approval: accepted.` : `\n[Tool] Approval: denied.`;
							accumulatedOutput += `${line}\n`;
							setHistory(prev => prev.map((entry, index) => 
								index === commandIndex 
									? { ...entry, output: accumulatedOutput }
									: entry
							));
						}
						break;
					
					case 'complete':
						setHistory(prev => prev.map((entry, index) => 
							index === commandIndex 
								? { ...entry, isStreaming: false }
								: entry
						));
						setIsProcessing(false);
						break;
					
					case 'error':
						setHistory(prev => prev.map((entry, index) => 
							index === commandIndex 
								? { ...entry, output: `Error: ${event.error}`, isStreaming: false }
								: entry
						));
						setIsProcessing(false);
						break;
				}
			}
		,
		// confirmToolExecution: UI での y/n 入力を Promise で返す
		({ name, args }) => new Promise<boolean>((resolve) => {
			approvalResolverRef.current = resolve;
			setPendingApproval({ name, args });
		})
		);
	};


	return (
		<Box flexDirection="column">
			<Text color="white">{asciiArt}</Text>
			<Text color="gray">Type commands and press Enter. Press Ctrl+C to exit.</Text>
			<Box marginBottom={1}></Box>
			
			{history.map((entry, index) => (
				<Box key={index} flexDirection="column">
					<Text color="white">{`${entry.agentName} > ${entry.command}`}</Text>
					<Text color="green">{entry.output}</Text>
				</Box>
			))}
			
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
					triggerChar={input[0]} // '@' or '/'
					initialInput={input}
					agentConfig={selectedCoderConfig}
					selectedIndex={selectedIndex}
				/>
			) : (
				<NormalInput
					input={input}
					agentConfig={selectedCoderConfig}
					isProcessing={isProcessing}
				/>
			)}
		</Box>
	);
};
