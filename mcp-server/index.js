// MCP server «Новостройка» over Streamable HTTP: http://127.0.0.1:3001/mcp.
// Every request needs `Authorization: Bearer <MCP_TOKEN>` (MCP_TOKEN from ../.env); otherwise 401.
// Run: node index.js
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools, FILES } from './tools.js';
import { logEvent } from './calllog.js';

const MAX_BODY = 1 << 20;   // 1 MB of JSON-RPC is plenty
export const MIN_TOKEN = 32;

// Bearer token, compared in constant time. Pure.
export function checkToken(header, token) {
  const got = Buffer.from(String(header || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(token);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

const send = (res, code, body, headers = {}) =>
  res.writeHead(code, { 'Content-Type': 'application/json', ...headers }).end(JSON.stringify(body));

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    if ((size += c.length) > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(c);
  }
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined; } catch {
    throw Object.assign(new Error('bad json'), { status: 400 });
  }
}

// Stateless: a fresh MCP server and transport per request, plain JSON answers (no SSE stream to keep open).
// files — { apartments, bookings, calls } paths (tests pass temporary ones) and optional statuses() — the manager's statuses.
export function createHttpServer({ token, files = FILES }) {
  if (!token || token.length < MIN_TOKEN) throw new Error(`MCP_TOKEN is missing or shorter than ${MIN_TOKEN} characters (see .env)`);
  return http.createServer((req, res) => handle(req, res, token, files).catch(e => {
    // never let one request bring the process down
    console.error('mcp request failed:', e.code || e.message);
    if (!res.headersSent) send(res, 500, { error: 'internal' }); else res.destroy();
  }));
}

async function handle(req, res, token, files) {
  if (req.url.split('?')[0] !== '/mcp') return send(res, 404, { error: 'not_found' });
  if (!checkToken(req.headers.authorization, token)) {
    await logEvent(files.calls, { type: 'denied', reason: req.headers.authorization ? 'bad_token' : 'no_token' });
    return send(res, 401, { error: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
  let body;
  try { body = await readBody(req); } catch (e) {
    if (!e.status) return res.destroy();   // the client went away mid-body
    return send(res, e.status, { error: e.status === 413 ? 'too_large' : 'bad_json' });
  }
  const server = new McpServer({ name: 'novostroyka', version: '0.1.0' });
  const seen = { logged: false };
  registerTools(server, files, seen);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  const t0 = Date.now();
  await transport.handleRequest(req, res, body);
  // A tools/call the SDK refused before any tool ran (bad or unknown arguments, unknown tool) is logged too, with
  // field names only — never values; stamped with the request's start, so the log page keeps the real order.
  if (body?.method === 'tools/call' && !seen.logged) {
    const { name, arguments: a } = body.params || {};
    await logEvent(files.calls, { at: new Date(t0).toISOString(), type: 'call', tool: String(name).slice(0, 60), ok: false, ms: Date.now() - t0,
      args: { fields: Object.keys(a && typeof a === 'object' ? a : {}).slice(0, 20) }, msg: 'Неверные параметры: вызов отклонён до инструмента' });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); } catch { /* no .env: real environment variables only */ }
  // the manager's apartment statuses from the site's storage: Postgres with DATABASE_URL, data/building-status.json otherwise
  const { createDb } = createRequire(import.meta.url)('../server/db.js');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const db = createDb({ root, dataDir: process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url)) });
  const port = Number(process.env.MCP_PORT) || 3001;
  const host = '127.0.0.1';
  createHttpServer({ token: process.env.MCP_TOKEN, files: { ...FILES, statuses: () => db.statuses() } }).listen(port, host, () => console.log(`MCP «Новостройка»: http://${host}:${port}/mcp`));
}
