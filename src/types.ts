export interface InitialTool {
  name: string;
  url: string;
  description: string;
}

export interface CompleteTool extends InitialTool {
  types: string[];
  state: "Public";
  apiServices: "Fully" | "Partially" | "Unofficial" | "Not Provided";
  isPaid: ("Pay as you Go" | "Monthly" | "Freemium" | "Open Source")[];
}

export interface AirtableTool {
  id: string;
  name: string;
  types: string[];
  description: string;
  state: string;
  apiServices: string;
  isPaid: string[];
}

export class CommandParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandParseError';
  }
}

export function parseSaveToolCommand(text: string): InitialTool {
  const parts = text.trim().split(' ');
  
  if (parts[0] !== '/savetool') {
    throw new CommandParseError('Invalid command. Use /savetool');
  }
  
  if (parts.length < 4) {
    throw new CommandParseError('Usage: /savetool [name] [url] [description]');
  }

  const [, name, url, ...descriptionParts] = parts;
  
  try {
    new URL(url); // URL validation
  } catch {
    throw new CommandParseError('Invalid URL format');
  }

  return {
    name,
    url,
    description: descriptionParts.join(' ')
  };
}

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  error: (message: string | Error, ...args: any[]) => {
    console.error(`[ERROR] ${message instanceof Error ? message.message : message}`, ...args);
  }
}; 