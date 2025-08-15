import type { OpenAITool } from './toolTypes';

// 7つの内蔵ツールを OpenAI 互換の function tool として公開（純粋関数）
export const getBuiltinTools = (): OpenAITool[] => {
  const tools: OpenAITool[] = [
    {
      type: 'function',
      function: {
        name: 'read_text_file',
        description: 'Read a text file (UTF-8) from the current working directory. Properties: path=CWD-relative file path; head=return first N lines (do not combine with tail); tail=return last N lines (do not combine with head). Returns the file content or a Notice message when constraints are violated.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'CWD-relative path to the file to read.' },
            head: { type: 'number', description: 'Return only the first N lines. Cannot be used with tail.' },
            tail: { type: 'number', description: 'Return only the last N lines. Cannot be used with head.' }
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
        description: 'Write text content (UTF-8) to a file, overwriting if it exists. Parent directory must already exist. Properties: content=text to write; path=CWD-relative file path.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Text content to write (UTF-8).' },
            path: { type: 'string', description: 'CWD-relative target file path. Parent directory must already exist.' }
          },
          required: ['content', 'path'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'edit_text_file',
        description: 'Apply exact-match, all-occurrence text replacements to a file (UTF-8). If any oldText is not found, no changes are written and an Error is returned. Properties: path=CWD-relative file path; edits=list of {oldText,newText} applied in order; dryRun=simulate without writing.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'CWD-relative path of the file to edit.' },
            edits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  oldText: { type: 'string', description: 'Exact text to find (full-text match, all occurrences). No regex.' },
                  newText: { type: 'string', description: 'Replacement text for each occurrence of oldText.' }
                },
                required: ['oldText', 'newText'],
                additionalProperties: false
              },
              minItems: 1
            },
            dryRun: { type: 'boolean', description: 'If true, do not write changes; only report status.' }
          },
          required: ['path', 'edits'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'edit_text_file_by_range',
        description: 'Edit a text file by line ranges on a snapshot. Each edit defines startLine (1-based), lineCount (>=0) and newText. lineCount>0 replaces that many lines; lineCount=0 inserts newText before startLine. Multiple edits are applied together; overlapping ranges are an error.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'CWD-relative path of the file to edit.' },
            edits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  startLine: { type: 'integer', description: '1-based line number where the change starts. totalLines+1 with lineCount=0 appends at EOF.' },
                  lineCount: { type: 'integer', description: 'Number of lines to replace (>=0). 0 means insert.' },
                  newText: { type: 'string', description: 'Text to insert or to replace with. EOLs will be normalized to the file\'s style.' }
                },
                required: ['startLine', 'lineCount', 'newText'],
                additionalProperties: false
              },
              minItems: 1
            },
            dryRun: { type: 'boolean', description: 'If true, do not write changes; only report status.' }
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
        description: 'Create a directory (recursive). Succeeds if it already exists. Properties: path=CWD-relative directory path to create.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'CWD-relative directory path to create (recursive).' }
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
        description: 'List direct children of a directory (no recursion), marking entries as [DIR] name/ or [FILE] name. Includes dotfiles; excludes \'./\' and \'../\'. Properties: path=CWD-relative directory path to list.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'CWD-relative directory path whose direct children are listed.' }
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
        description: 'Move or rename a file/directory. Fails if destination exists. Properties: source=CWD-relative source path; destination=CWD-relative destination path (must not exist).',
        parameters: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'CWD-relative source file or directory path.' },
            destination: { type: 'string', description: 'CWD-relative destination path. Must not already exist.' }
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
        description: 'Recursively search starting at a path using a glob pattern (case-insensitive, dotfiles included). Properties: path=start directory (CWD-relative); pattern=glob to match against paths relative to start; excludePatterns=optional glob(s) to skip matches.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'CWD-relative start directory for the search.' },
            pattern: { type: 'string', description: 'Case-insensitive glob pattern matched against each item\'s relative path from start.' },
            excludePatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional case-insensitive glob pattern(s) to exclude.'
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
