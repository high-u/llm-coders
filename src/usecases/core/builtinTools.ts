import type { OpenAITool } from './toolTypes';

// 7つの内蔵ツールを OpenAI 互換の function tool として公開（純粋関数）
export const getBuiltinTools = (): OpenAITool[] => {
  const tools: OpenAITool[] = [
    {
      type: 'function',
      function: {
        name: 'read_text_file',
        description: 'Read a text file by relative path. Use head or tail to limit lines.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            head: { type: 'number' },
            tail: { type: 'number' }
          },
          required: ['path'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write text content to a file, overwriting if it exists. Parent directory must exist.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            path: { type: 'string' }
          },
          required: ['content', 'path'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'edit_file',
        description: 'Apply full-match, all-occurrence text replacements. Fails if any oldText not found.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            edits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  oldText: { type: 'string' },
                  newText: { type: 'string' }
                },
                required: ['oldText', 'newText'],
                additionalProperties: false
              },
              minItems: 1
            },
            dryRun: { type: 'boolean' }
          },
          required: ['path', 'edits'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_directory',
        description: 'Create a directory (recursive). Succeeds if it already exists.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_directory',
        description: 'List direct children of a directory, marking [DIR]/[FILE].',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'move_file',
        description: 'Move or rename a file/directory. Fails if destination exists.',
        parameters: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            destination: { type: 'string' }
          },
          required: ['source', 'destination'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_files',
        description: 'Recursively search with glob pattern (case-insensitive). Returns CWD-relative paths.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            pattern: { type: 'string' },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['path', 'pattern'],
          additionalProperties: false
        }
      }
    }
  ];
  return tools;
};

