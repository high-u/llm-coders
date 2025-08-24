import React from 'react';
import { Text } from 'ink';

export interface PromptHeaderProps {
  name: string;
  color: string; // coder color (dynamic)
  separator?: string; // default ' > '
  separatorColor: string;
}

export const PromptHeader = ({ name, color, separator = ' > ', separatorColor }: PromptHeaderProps) => {
  return (
    <Text>
      <Text color={color}>{name}</Text>
      <Text color={separatorColor}>{separator}</Text>
    </Text>
  );
};

