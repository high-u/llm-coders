import React, {useState} from 'react';
import {Text, Box} from 'ink';
import type { ChatUseCases, Coder } from '../../usecases/chat/types';
import { CommandInput } from './components/commandInput';
import type { CommandEntry, UiColorConfig } from './types';
import { PromptHeader } from './components/promptHeader';

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
  uiColors: UiColorConfig;
}

export const CommandInterface = ({ chatUseCases, uiColors }: CommandInterfaceProps) => {
  const [history, setHistory] = useState<CommandEntry[]>([]);
  const coders: Coder[] = chatUseCases.getCoders();
  const [selectedCoderConfig, setSelectedCoderConfig] = useState<Coder>(coders[0]);


	return (
		<Box flexDirection="column">
			<Text color={uiColors.base.banner}>{asciiArt}</Text>
			<Text color={uiColors.base.hint}>Type commands and press Enter. Press Ctrl+C to exit.</Text>
			<Box marginBottom={1}></Box>
			
			{history.map((entry, index) => {
				const agentColor = coders.find(c => c.name === entry.agentName)?.color ?? 'white';
				return (
					<Box key={index} flexDirection="column">
						<Text>
							<PromptHeader name={entry.agentName} color={agentColor} separatorColor={uiColors.base.separator} />
							<Text color={uiColors.base.foreground}>{entry.command}</Text>
						</Text>
						<Text color={uiColors.base.foreground}>{entry.output}</Text>
					</Box>
				);
			})}

			<CommandInput
				chatUseCases={chatUseCases}
				coders={coders}
				selectedCoder={selectedCoderConfig}
				onSelectCoder={setSelectedCoderConfig}
				history={history}
				setHistory={setHistory}
				uiColors={uiColors}
			/>
		</Box>
	);
};
