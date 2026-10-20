// The call log (mcp-calls.jsonl): one JSON line per tool call or refused request, for the site's «Журнал вызовов».
// Never holds the token, a name or a phone; a failed write is only reported and never breaks a tool.
import fs from 'node:fs/promises';

const MAX_BYTES = 1 << 20;   // past 1 MB the log keeps its last KEEP lines
const KEEP = 1000;

// book_viewing carries a name and a phone: only the apartment and the time go to the log. Pure.
export function safeArgs(tool, args = {}) {
  if (tool !== 'book_viewing') return args;
  const { no, datetime } = args;
  return { no, datetime };
}

// One queue per file: appends never interleave, the trim never races a write.
const queues = new Map();

export function logEvent(file, event) {
  if (!file) return Promise.resolve();
  const run = (queues.get(file) || Promise.resolve()).then(async () => {
    await fs.appendFile(file, JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
    const { size } = await fs.stat(file);
    if (size > MAX_BYTES) {
      const lines = (await fs.readFile(file, 'utf8')).trim().split('\n').slice(-KEEP);
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, lines.join('\n') + '\n');
      await fs.rename(tmp, file);
    }
  }).catch(e => console.error('call log write failed:', e.code || e.name));
  queues.set(file, run);
  return run;
}
