# Move logs to and from a Claude chat (TRCK-SYNC v1)

Two commands on the laptop work on your backup file. In TRCK open Plan, tap Download backup, and save it in this folder as `my-data.json` (it is gitignored). Pass `--file <path>` to use another file.

- `npm run sync:export -- --days 3` prints the last 3 days (default 2), oldest first, in one text block to copy into the chat.
- `npm run sync:import` asks you to paste the chat's TRCK-SYNC text, then an empty line. `--in pasted.txt` reads it from a file instead, and `--dry-run` only shows what would happen.

To see an import in the app: Plan, Restore or import, choose the file. With sync on, the changed days carry a new edit time, so they win over the older copies.

## The format
The first line is `TRCK-SYNC v1`. Then one line per date, `key=value` pairs joined by ` | `. Fields with no data are left out. An export ends each line with `missing: <keys>` for the fields TRCK tracks that have no value that day. Import skips that note and any ``` lines.

| Key | In TRCK | Notes |
|---|---|---|
| date | the day key | YYYY-MM-DD. The day turns over at 5 am. Future dates are refused |
| weight_kg | `wt` | 20 to 300 |
| sleep_hrs | `sleep` | 0 to 24 |
| protein_g, kcal | total of the day's foods | An import onto a day with no food adds one food called "Logged in chat" (or named after `meals`). A higher total tops up that one entry. It never lowers or removes foods logged in the app |
| meals | food names, like "Egg x3, Rice" | Only set from chat on a day with no foods logged in the app |
| session | worked out from the lifts: main muscles, legs grouped, `rest` on a day with data and no training | A label from chat, like badminton, is kept and wins |
| top_sets | `lift` sets | `pulldown 45x10,10,9; row 40x10,42.5x8`. The weight is written when it changes. Use the lift id or its name from your routine. Each lift is compared on its own, and lifts not named are left alone |
| notes | `note` | Line breaks and `|` become ` / ` |
| sleep_in, sleep_out, sleep_q, steps, gummy, energy, hunger, gut | not tracked by the app | Kept in a new optional `chat` field on the day so they export again. No screen shows them yet |

Numbers take at most 2 decimals. The 1 to 5 scales and steps are whole numbers. Times are HH:MM.

## What an import does
1. Checks every line. Any unknown key, bad date or value out of range stops the import with a list of problems, and nothing is written.
2. Shows a dry run: new days, values it will add, and every value that differs from TRCK.
3. For each difference asks t (keep TRCK, the default) or p (use pasted). A blank never clears a stored value.
4. Asks you to type y, then copies the old file to `trck-backups/` next to it and writes.

Importing text TRCK already has changes nothing and writes nothing.

Nutrition numbers here are rough logs, not medical advice.
