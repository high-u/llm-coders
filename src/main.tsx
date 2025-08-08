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
}

const CommandInterface = () => {
	const [input, setInput] = useState('');
	const [history, setHistory] = useState<CommandEntry[]>([]);

	useInput((inputChar, key) => {
		if (key.return) {
			// Enter key pressed - execute command and show output
			if (input.trim()) {
				const output = input; // Echo the input as output
				setHistory(prev => [...prev, { command: input, output }]);
				setInput('');
			}
		} else if (key.backspace || key.delete) {
			// Backspace pressed
			setInput(prev => prev.slice(0, -1));
		} else if (key.ctrl && inputChar === 'c') {
			// Ctrl+C pressed - exit
			process.exit();
		} else if (inputChar) {
			// Regular character input
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
			
			<Text color="yellow">
				{'> ' + input + (Date.now() % 1000 < 500 ? '_' : ' ')}
			</Text>
		</Box>
	);
};

render(<CommandInterface />);
