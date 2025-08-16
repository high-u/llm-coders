import React, {useState} from 'react';
import {Text, Box} from 'ink';
import type { ChatUseCases, Coder } from '../../usecases/chat/types';
import { CommandInput } from './components/commandInput';
import type { CommandEntry } from './types';

const asciiArt = `
  ██████┐   ██████┐   ██████┐   ████████┐ ██████┐     ██████┐ 
██┌─────┘ ██┌─────██┐ ██┌───██┐ ██┌─────┘ ██┌───██┐ ██┌─────┘
██│       ██│     ██│ ██│   ██│ ██████│   ██████┌─┘ ████████┐
██│       ██│     ██│ ██│   ██│ ██┌───┘   ██┌───██┐ └─────██│
└─██████┐ └─██████┌─┘ ██████┌─┘ ████████┐ ██│   ██│ ██████┌─┘
  └─────┘   └─────┘   └─────┘   └───────┘ └─┘   └─┘ └─────┘
`;

export interface CommandInterfaceProps {
  chatUseCases: ChatUseCases;
}

export const CommandInterface = ({ chatUseCases }: CommandInterfaceProps) => {
  const [history, setHistory] = useState<CommandEntry[]>([]);
  const coders: Coder[] = chatUseCases.getCoders();
  const [selectedCoderConfig, setSelectedCoderConfig] = useState<Coder>(coders[0]);


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

			<CommandInput
				chatUseCases={chatUseCases}
				coders={coders}
				selectedCoder={selectedCoderConfig}
				onSelectCoder={setSelectedCoderConfig}
				history={history}
				setHistory={setHistory}
			/>
		</Box>
	);
};
