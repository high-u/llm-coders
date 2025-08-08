import React, {useState} from 'react';
import {render, Text, Box, useInput} from 'ink';

const asciiArt = `
  █████    ████    █████    ███████  █████  
██       ██    ██  ██   ██  ██       ██   ██ 
██       ██    ██  ██   ██  █████    █████  
██       ██    ██  ██   ██  ██       ██   ██ 
  █████    ████    █████    ███████  ██   ██ 
`;

interface CommandEntry {
	command: string;
	output: string;
	isStreaming?: boolean;
}

const CommandInterface = () => {
	const [input, setInput] = useState('');
	const [history, setHistory] = useState<CommandEntry[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);

	const callOllamaAPI = async (prompt: string) => {
		setIsProcessing(true);
		
		const commandIndex = history.length;
		setHistory(prev => [...prev, { command: prompt, output: '', isStreaming: true }]);

		try {
			const response = await fetch('http://localhost:11434/v1/chat/completions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'hf.co/Menlo/Jan-nano-gguf:Q8_0',
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

	useInput((inputChar, key) => {
		if (key.return) {
			if (input.trim() && !isProcessing) {
				callOllamaAPI(input);
				setInput('');
			}
		} else if (key.backspace || key.delete) {
			setInput(prev => prev.slice(0, -1));
		} else if (key.ctrl && inputChar === 'c') {
			process.exit();
		} else if (inputChar && !isProcessing) {
			setInput(prev => prev + inputChar);
		}
	});

	return (
		<Box flexDirection="column">
			<Text color="cyan">{asciiArt}</Text>
			<Text color="gray">Type commands and press Enter. Press Ctrl+C to exit.</Text>
			<Text></Text>
			
			{history.map((entry, index) => (
				<Box key={index} flexDirection="column">
					<Text color="white">{'> ' + entry.command}</Text>
					<Text color="green">{entry.output}</Text>
				</Box>
			))}
			
			{!isProcessing && (
				<Text color="yellow">
					{'> ' + input + '_'}
				</Text>
			)}
		</Box>
	);
};

render(<CommandInterface />);
