import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { log } from '@clack/prompts';
import pc from 'picocolors';

type WindowsDesktopPathDeps = {
  localAppData: string;
  appData: string;
  exists: (path: string) => boolean;
  findClaudePackage: (packagesDir: string) => string | undefined;
};

export const resolveWindowsDesktopConfigPath = (deps: WindowsDesktopPathDeps) => {
  const { localAppData, appData, exists, findClaudePackage } = deps;
  const standardPath = join(appData, 'Claude', 'claude_desktop_config.json');
  const packagesDir = join(localAppData, 'Packages');
  const claudePkg = exists(packagesDir) ? findClaudePackage(packagesDir) : undefined;
  const storePath = claudePkg
    ? join(packagesDir, claudePkg, 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json')
    : undefined;

  if (storePath && exists(storePath)) {
    return storePath;
  }
  if (exists(standardPath)) {
    return standardPath;
  }
  return storePath ?? standardPath;
};

const getClaudeConfigPath = () => {
  if (process.platform === 'darwin') {
    return join(
      homedir(),
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json',
    );
  }
  if (process.platform === 'win32') {
    return resolveWindowsDesktopConfigPath({
      localAppData: process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
      appData: process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
      exists: existsSync,
      findClaudePackage: (packagesDir) => {
        try {
          return readdirSync(packagesDir).find((name) => name.startsWith('Claude_'));
        } catch {
          return undefined;
        }
      },
    });
  }
  return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
};

const getClaudeCodeConfigPath = () => join(homedir(), '.claude.json');

export const upsertMcpServer = (configPath: string, name: string, entry: unknown) => {
  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, 'utf-8'));
  } else {
    mkdirSync(dirname(configPath), { recursive: true });
  }

  const mcpServers = (config.mcpServers as Record<string, unknown>) ?? {};
  mcpServers[name] = entry;
  config.mcpServers = mcpServers;

  const tmpPath = `${configPath}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`);
  renameSync(tmpPath, configPath);
};

type McpBin = { command: string; mcpPath: string };

/**
 * Locate the bundled skope-mcp entry. The CLI build copies the MCP bundle to dist/mcp.js next to the
 * CLI, and also exposes a `skope-mcp` bin. Try the co-located bundle first, then PATH, then a sibling.
 */
const getMcpBinPath = (): McpBin | null => {
  const execDir = dirname(process.execPath);
  const bundledMcp = join(execDir, 'dist', 'mcp.js');
  if (existsSync(bundledMcp)) {
    return { command: process.execPath, mcpPath: bundledMcp };
  }

  try {
    const cmd = process.platform === 'win32' ? 'where skope-mcp' : 'which skope-mcp';
    const p = execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim()
      .split('\n')[0]
      .trim();
    if (p) {
      return { command: 'node', mcpPath: p };
    }
  } catch {}

  const skopeBin = process.argv[1];
  if (skopeBin) {
    const candidate = join(skopeBin, '..', 'skope-mcp');
    if (existsSync(candidate)) {
      return { command: 'node', mcpPath: candidate };
    }
  }

  return null;
};

export const mcpInstallCommand = () => {
  const mcpBin = getMcpBinPath();
  if (!mcpBin) {
    log.error(
      'skope-mcp binary not found. Install skope globally first: npm install -g @evan-moon/skope',
    );
    process.exit(1);
  }

  const targets = [
    {
      label: 'Claude Desktop',
      path: getClaudeConfigPath(),
      entry: { command: mcpBin.command, args: [mcpBin.mcpPath] },
    },
    {
      label: 'Claude Code',
      path: getClaudeCodeConfigPath(),
      entry: { type: 'stdio', command: mcpBin.command, args: [mcpBin.mcpPath] },
    },
  ];

  let installed = false;
  for (const target of targets) {
    try {
      upsertMcpServer(target.path, 'skope', target.entry);
      log.success(`${target.label}  ${pc.dim(target.path)}`);
      installed = true;
    } catch {
      log.warn(`${target.label}: failed to update ${pc.dim(target.path)} — skipped`);
    }
  }

  if (!installed) {
    log.error('No config could be updated');
    process.exit(1);
  }

  log.info(`Binary: ${pc.dim(mcpBin.mcpPath)}`);
  log.message(
    pc.yellow('Restart Claude Desktop to activate. Claude Code picks it up on the next session.'),
  );
  log.message(
    pc.dim(
      '★ Like skope? Star us at https://github.com/evan-moon/skope — it helps others find it.',
    ),
  );
};
