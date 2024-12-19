import { Database } from "jsr:@db/sqlite@0.11";
import { parse } from "jsr:@std/flags@0.215.0";

interface Stat {
  command: string;
  cwd: string;
  deleted_at: string | null;
  duration: number;
  exit: number;
  hostname: string;
  id: string;
  session: string;
  timestamp: number;
}

async function readStdin(): Promise<string | null> {
  if (Deno.stdin.isTerminal()) {
    return null;
  }

  const buffer = new Uint8Array(1024);
  let result = '';
  
  while (true) {
    const n = await Deno.stdin.read(buffer);
    if (n === null) break;
    result += new TextDecoder().decode(buffer.subarray(0, n));
  }
  return result;
}

async function getAliases(): Promise<Record<string, string>> {
  const aliases: Record<string, string> = {};
  
  try {
    const input = await readStdin();
    if (!input) {
      console.log("No aliases provided. Run the script with: `alias | deno run -A stats.ts` for better results.");
      return aliases;
    }

    const lines = input.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const [alias, cmd] = line.split('=');
      if (alias && cmd) {
        aliases[alias.trim()] = cmd.replace(/['"]/g, '').trim();
      }
    }
  } catch (error) {
    console.error("Failed to read aliases from stdin:", error);
  }

  return aliases;
}

async function getAtuinStats(dbFilePath: string): Promise<Stat[]> {
  try {
    const fileInfo = await Deno.stat(dbFilePath);

    if (!fileInfo.isFile) {
      throw new Error("The specified path is not a file.");
    }

    const db = new Database(dbFilePath);
    const stats: Stat[] = [];
    const query = db.prepare(`
      SELECT command, cwd, deleted_at, duration, exit, hostname, id, session, timestamp 
      FROM history
    `);

    for (const row of query.all()) {
      stats.push(row as Stat);
    }

    db.close();
    return stats;
  } catch (error) {
    console.error("Failed to read the database file:", error.message);
    console.log(error);
    return [];
  }
}

function processCommand(command: string, aliases: Record<string, string>): string {
  const words = command.split(" ");
  let processedCommand = words[0];
  
  // Check if the first word is an alias
  if (aliases[words[0]]) {
    const aliasedCommand = aliases[words[0]].split(" ");
    processedCommand = aliasedCommand[0];
    
    // If the alias is a compound command (e.g., "git status"), include the subcommand
    if (aliasedCommand.length > 1) {
      processedCommand += " " + aliasedCommand[1];
    }
  }
  
  // Add the subcommand if present in the original command
  if (words.length > 1) {
    processedCommand += " " + words[1];
  }
  
  return processedCommand;
}

async function getTopCommands(dbFilePath: string, topN: number) {
  const aliases = await getAliases();
  const atuinStats = await getAtuinStats(dbFilePath);
  const allStats = [...atuinStats];
  const commandCount: Record<string, number> = {};

  allStats.forEach((stat) => {
    const processedCommand = processCommand(stat.command, aliases);
    if (commandCount[processedCommand]) {
      commandCount[processedCommand]++;
    } else {
      commandCount[processedCommand] = 1;
    }
  });

  const sortedCommands = Object.entries(commandCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  console.log(`Top ${topN} commands:`);
  sortedCommands.forEach(([command, count]) => {
    console.log(`${command}: ${count} times`);
  });
}

async function findDatabasePath(): Promise<string> {
  // Check command line arguments
  const args = parse(Deno.args);
  if (args.db) {
    return args.db;
  }

  // Check environment variable
  const envPath = Deno.env.get("ATUIN_DB_PATH");
  if (envPath) {
    return envPath;
  }

  // Check common locations
  const home = Deno.env.get("HOME");
  const commonPaths = [
    `${home}/.local/share/atuin/history.db`,
    `${home}/Library/Application Support/atuin/history.db`, // macOS
    `${home}/.config/atuin/history.db`,
  ];

  for (const path of commonPaths) {
    try {
      const fileInfo = await Deno.stat(path);
      if (fileInfo.isFile) {
        return path;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Could not find Atuin database. Please specify with --db flag or ATUIN_DB_PATH environment variable");
}

try {
  const dbFilePath = await findDatabasePath();
  const topN = 10;
  console.log(`Reading stats from Atuin database in ${dbFilePath}`);
  await getTopCommands(dbFilePath, topN);
} catch (error) {
  console.error(error.message);
  Deno.exit(1);
}
