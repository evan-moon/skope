import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

interface SkopeConfig {
  tavily_api_key?: string;
}

function configPath(): string {
  return join(homedir(), '.skope', 'config.json');
}

export function readConfig(): SkopeConfig {
  const path = configPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SkopeConfig;
  } catch {
    return {};
  }
}

export function writeConfig(next: SkopeConfig): void {
  const path = configPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify({ ...readConfig(), ...next }, null, 2));
}
