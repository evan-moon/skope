#!/usr/bin/env node
import { openDb, schema } from '@skope/db';
import { coldStart } from '@skope/profile';
import { Command } from 'commander';
import pc from 'picocolors';
import { readConfig, writeConfig } from './config.ts';

const program = new Command();

program
  .name('skope')
  .description('Personalized news lens — a safety-net CLI. Analysis lives in the MCP server.')
  .version('0.1.0');

const config = program.command('config').description('Manage local config (~/.skope/config.json)');
config
  .command('set')
  .argument('<key>', 'tavily-key')
  .argument('<value>')
  .description('Set a config value (e.g. tavily-key)')
  .action((key: string, value: string) => {
    if (key === 'tavily-key') {
      writeConfig({ tavily_api_key: value });
      console.log(pc.green('✓ Tavily key saved.'));
      return;
    }
    console.error(pc.red(`Unknown config key: ${key}`));
    process.exitCode = 1;
  });
config
  .command('show')
  .description('Show current config (key redacted)')
  .action(() => {
    const c = readConfig();
    console.log(JSON.stringify({ tavily_api_key: c.tavily_api_key ? '••••set' : null }, null, 2));
  });

program
  .command('init')
  .description('Create a cold-start profile (no MCP integrations required)')
  .requiredOption('--location <location>', 'e.g. "Seoul, Korea"')
  .option('--languages <langs>', 'comma-separated, e.g. ko,en', 'en')
  .action((opts: { location: string; languages: string }) => {
    const db = openDb();
    const profile = coldStart({
      location: opts.location,
      languages: opts.languages.split(',').map((s) => s.trim()),
    });
    db.delete(schema.profileAxes).run();
    for (const a of profile.axes) {
      db.insert(schema.profileAxes)
        .values({
          id: a.id,
          label: a.label,
          weight: a.weight,
          keywords: JSON.stringify(a.keywords),
          source: null,
        })
        .run();
    }
    db.insert(schema.profileMeta)
      .values({ key: 'user_context', value: JSON.stringify(profile.userContext) })
      .onConflictDoUpdate({
        target: schema.profileMeta.key,
        set: { value: JSON.stringify(profile.userContext) },
      })
      .run();
    console.log(
      pc.green(`✓ Profile seeded for ${opts.location}. Edit axes via the MCP update_profile tool.`),
    );
  });

program
  .command('profile')
  .description('Show the current interest profile (read-only)')
  .action(() => {
    const db = openDb();
    const axes = db.select().from(schema.profileAxes).all();
    if (axes.length === 0) {
      console.log(pc.yellow('No profile yet. Run: skope init --location "City, Country"'));
      return;
    }
    for (const a of axes) {
      const pct = Math.round(a.weight * 100);
      console.log(`${pc.cyan(a.id.padEnd(12))} ${String(pct).padStart(3)}%  ${a.label}`);
    }
  });

program.parseAsync();
