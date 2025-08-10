import React, {useState} from 'react';
import {Text, Box} from 'ink';
import {AutoCompleteInput} from './components/SelectItem';
import {NormalInput} from './components/NormalInput';
import { Agent } from '../../usecases/core/agentConfig';
import { convertToDisplayItems } from '../../usecases/core/agentConfig';
import { createChatUseCases } from '../../usecases/chat/chatUseCases';

const asciiArt = `
  ██████╗   ██████╗   ██████╗   ████████╗ ██████╗     ██████╗ 
██╔═════╝ ██╔═════██╗ ██╔═══██╗ ██╔═════╝ ██╔═══██╗ ██╔═════╝
██║       ██║     ██║ ██║   ██║ ██████║   ██████╔═╝ ████████╗
██║       ██║     ██║ ██║   ██║ ██╔═══╝   ██╔═══██╗ ╚═════██║
╚═██████╗ ╚═██████╔═╝ ██████╔═╝ ████████╗ ██║   ██║ ██████╔═╝
  ╚═════╝   ╚═════╝   ╚═════╝   ╚═══════╝ ╚═╝   ╚═╝ ╚═════╝
`;

interface CommandEntry {
	command: string;
	output: string;
	isStreaming?: boolean;
	agentName: string;
}

// usecases層で依存関係を組み立て
const chatUseCases = createChatUseCases();

export const CommandInterface = () => {
	const [input, setInput] = useState('');
	const [history, setHistory] = useState<CommandEntry[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	
	const agents: Agent[] = chatUseCases.getAgents();
	const [selectedAgentConfig, setSelectedAgentConfig] = useState<Agent>(agents[0]);

	// エージェントをAutoCompleteInput用に変換
	const agentItems = convertToDisplayItems(agents);

	// オートコンプリート判定
	const isAutoCompleting = input.startsWith('@') || input.startsWith('/');

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

	// エージェント選択
	const handleAgentSelect = (agent: Agent) => {
		chatUseCases.clearHistory(); // 履歴クリア
		setSelectedAgentConfig(agent);
		setInput(''); // 通常入力に戻る
	};

	// オートコンプリートキャンセル
	const handleAutoCompleteCancel = () => {
		setInput(''); // 通常入力に戻る
	};

	const callOllamaAPI = async (prompt: string) => {
		setIsProcessing(true);
		
		const commandIndex = history.length;
		setHistory(prev => [...prev, { command: prompt, output: '', isStreaming: true, agentName: selectedAgentConfig.name }]);

		let accumulatedOutput = '';

		// ChatUseCasesに処理を委譲
		await chatUseCases.chat(
			selectedAgentConfig,
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
			
			{isAutoCompleting ? (
				<AutoCompleteInput
					items={agentItems}
					triggerChar={input[0]} // '@' or '/'
					initialInput={input}
					agentConfig={selectedAgentConfig}
					onSelect={handleAgentSelect}
					onCancel={handleAutoCompleteCancel}
				/>
			) : (
				<NormalInput
					input={input}
					agentConfig={selectedAgentConfig}
					isProcessing={isProcessing}
					onInputChange={setInput}
					onSubmit={handleNormalSubmit}
					onAutoCompleteStart={handleAutoCompleteStart}
				/>
			)}
		</Box>
	);
};