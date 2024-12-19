# Terminal Stats

A Deno script that analyzes your shell command usage using the Atuin database.

## Requirements

- [Deno](https://deno.land/) installed
- [Atuin](https://github.com/atuinsh/atuin) installed and configured

## Usage

Basic usage:
```bash
deno run -A stats.ts
```

For better results with alias resolution:
```bash
alias | deno run -A stats.ts
```

### Options

- `--db`: Specify a custom path to the Atuin database
  ```bash
  deno run -A stats.ts --db /path/to/atuin/history.db
  ```

### Database Location

The script will try to find the Atuin database in the following order:
1. `--db` command line argument
2. `ATUIN_DB_PATH` environment variable
3. Common locations:
   - `~/.local/share/atuin/history.db`
   - `~/Library/Application Support/atuin/history.db` (macOS)
   - `~/.config/atuin/history.db`

## Features

- Shows top 10 most used commands
- Resolves aliases to their actual commands
- Handles subcommands (e.g., `git commit`, `docker run`)
- Supports reading aliases from stdin for better command resolution

## Output Example

```
Reading stats from Atuin database in /Users/username/.local/share/atuin/history.db
Top 10 commands:
git commit: 150 times
ls: 120 times
cd: 100 times
git push: 80 times
npm run: 75 times
docker run: 50 times
vim: 45 times
cat: 40 times
grep: 35 times
rm: 30 times
```
