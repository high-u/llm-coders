import React, {useState} from 'react';
import {render, Text, Box} from 'ink';
import config from 'config';
import {AutoCompleteInput} from './components/SelectItem';
import {NormalInput} from './components/NormalInput';

const asciiArt = `
  █████╗   █████╗   █████╗   ███████╗ █████╗ 
██╔════╝ ██╔════██╗ ██╔══██╗ ██╔════╝ ██╔══██╗
██║      ██║    ██║ ██║  ██║ █████║   █████╔═╝
██║      ██║    ██║ ██║  ██║ ██╔══╝   ██╔══██╗
╚═█████╗ ╚═█████╔═╝ █████╔═╝ ███████╗ ██║  ██║
  ╚════╝   ╚════╝   ╚════╝   ╚══════╝ ╚═╝  ╚═╝
`;

interface CommandEntry {
	command: string;
	output: string;
	isStreaming?: boolean;
	agentName: string;
}

interface Agent {
	id: string;
	name: string;
	endpoint: string;
	model: string;
	color: string;
}

const CommandInterface = () => {
	const [input, setInput] = useState('');
	const [history, setHistory] = useState<CommandEntry[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	
	const agents: Agent[] = config.get('agents');
	const [selectedAgentConfig, setSelectedAgentConfig] = useState<Agent>(agents[0]);

	// エージェントをAutoCompleteInput用に変換
	const agentItems = agents.map(agent => ({
		...agent,
		id: agent.name
	}));

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

		try {
			const response = await fetch(`${selectedAgentConfig.endpoint}/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: selectedAgentConfig.model,
					messages: [{ role: 'user', content: prompt }],
					stream: true
				})
			});

			const reader = response.body?.getReader();
			if (!reader) return;

			let accumulatedOutput = '';
			
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = new TextDecoder().decode(value);
				const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

				for (const line of lines) {
					if (line === 'data: [DONE]') continue;
					
					try {
						const data = JSON.parse(line.slice(6));
						const content = data.choices?.[0]?.delta?.content;
						if (content) {
							accumulatedOutput += content;
							setHistory(prev => prev.map((entry, index) => 
								index === commandIndex 
									? { ...entry, output: accumulatedOutput }
									: entry
							));
						}
					} catch (e) {
						// Ignore parsing errors
					}
				}
			}

			setHistory(prev => prev.map((entry, index) => 
				index === commandIndex 
					? { ...entry, isStreaming: false }
					: entry
			));

		} catch (error) {
			setHistory(prev => prev.map((entry, index) => 
				index === commandIndex 
					? { ...entry, output: `Error: ${error}`, isStreaming: false }
					: entry
			));
		} finally {
			setIsProcessing(false);
		}
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

render(<CommandInterface />);
