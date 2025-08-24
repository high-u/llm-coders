export interface CommandEntry {
  command: string;
  output: string;
  isStreaming?: boolean;
  agentName: string;
}

export interface UiColorConfig {
  base: {
    foreground: string;
    hint: string;
    border: string;
    banner: string;
    separator: string;
  };
  selected: {
    foreground: string;
    background: string;
  };
  approval: {
    border: string;
    title: string;
    text: string;
    hint: string;
  };
  diff: {
    add: string;
    delete: string;
    context: string;
  };
}
