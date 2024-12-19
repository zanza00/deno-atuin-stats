import { Database } from "jsr:@db/sqlite@0.11";

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

async function getAliases(): Promise<Record<string, string>> {
  const aliases: Record<string, string> = {};
  const process = Deno.run({
    cmd: ["sh", "-c", "alias"],
    stdout: "piped",
    stderr: "piped",
  });

  const output = await process.output();
  const decoder = new TextDecoder();
  const aliasOutput = decoder.decode(output);

  for (const line of aliasOutput.split("\n")) {
    const [alias, command] = line.split("=");
    if (alias && command) {
      aliases[alias.trim()] = command.replace(/['"]/g, "").trim();
    }
  }

  process.close();
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
    const query = db.prepare(
      "SELECT command, cwd, deleted_at, duration, exit, hostname, id, session, timestamp FROM history"
    );

    for (const row of query.all()) {
      stats.push({
        command: row.command,
        cwd: row.cwd,
        deleted_at: row.deleted_at,
        duration: row.duration,
        exit: row.exit,
        hostname: row.hostname,
        id: row.id,
        session: row.session,
        timestamp: row.timestamp,
      });
    }
    db.close();
    return stats;
  } catch (error) {
    console.error("Failed to read the database file:", error.message);
    console.log(error);
    return [];
  }
}

async function getTopCommands(dbFilePath: string, topN: number) {
  const aliases = await getAliases();
  const atuinStats = await getAtuinStats(dbFilePath);
  const allStats = [...atuinStats];
  const commandCount: Record<string, number> = {};

  allStats.forEach((stat) => {
    let firstWord = stat.command.split(" ")[0];
    if (aliases[firstWord]) {
      firstWord = aliases[firstWord].split(" ")[0];
    }
    if (commandCount[firstWord]) {
      commandCount[firstWord]++;
    } else {
      commandCount[firstWord] = 1;
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

const dbFilePath = "/Users/spicciani/.local/share/atuin/history.db";
const topN = 10;
console.log(`Reading stats from Atuin database in ${dbFilePath}`);
getTopCommands(dbFilePath, topN);
