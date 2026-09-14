import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

const summaryFile = new URL('../index.ts', import.meta.url);
// Load the extension factory with an isolated Pi/context harness. No credentials,
// real filesystem writes, network requests, or session mutations are used.
const model = { id: 'gpt-5.4-mini', provider: 'github-copilot', baseUrl: 'https://api.individual.githubcopilot.com' };
const history = [
  { type: 'message', message: { role: 'user', content: 'Fix Copilot summary routing' } },
  { type: 'message', message: { role: 'assistant', content: 'Use the authenticated Business endpoint.' } },
];
const response = (text = 'Fixed Copilot routing') => ({ stopReason: 'stop', content: [{ type: 'text', text }] });
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

function harness(file, { entries = history, complete = async () => response(), models = [model], name = '', crlf = false } = {}) {
  const calls = [], widgets = [], notifications = [], statuses = [], titles = [], persisted = [], names = [], logs = [];
  const events = {}, commands = {};
  const config = { showWidget: true, debounceSeconds: 30 };
  let source = readFileSync(file, 'utf8');
  if (crlf) source = source.replace(/\r?\n/g, '\r\n');
  source = source.replace(/^import .*;\r?\n/gm, '').replace(/export default function(?: \w+)?\s*\(/, 'function extensionFactory(');
  source = stripTypeScriptTypes(source) + '\nglobalThis.factory = extensionFactory;';
  const sandbox = {
    existsSync: () => true, readFileSync: () => JSON.stringify(config),
    mkdirSync: () => {}, writeFileSync: () => { throw new Error('Unexpected write'); },
    dirname: p => p, join: (...parts) => parts.join('/'), getAgentDir: () => '/test-agent',
    truncateToWidth, process: { env: { HOME: '/test-home' }, stdout: { columns: 80 } },
    Date, TextEncoder, AbortSignal, AbortController,
    console: { warn: text => logs.push(text), error: text => logs.push(text) },
    complete: () => { throw new Error('Legacy complete must not be used'); },
  };
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  const pi = {
    on: (event, fn) => events[event] = fn,
    registerCommand: (key, command) => commands[key] = command,
    getSessionName: () => name,
    setSessionName: value => { name = value; names.push(value); },
    appendEntry: (key, data) => persisted.push({ key, data }),
  };
  const registry = {
    getAvailable: () => models,
    find: () => models[0],
    getApiKeyAndHeaders: () => { throw new Error('Manual auth resolution must not be used'); },
    complete: (...args) => { calls.push(args); return complete(...args); },
  };
  const ctx = {
    hasUI: true, cwd: '/test-project', modelRegistry: registry, model,
    sessionManager: { getBranch: () => entries },
    ui: {
      setWidget: (_key, lines) => widgets.push(lines),
      notify: (...args) => notifications.push(args),
      setTitle: title => titles.push(title),
      setStatus: (_key, value) => statuses.push(value),
      theme: { fg: (_color, text) => text, bold: text => text, italic: text => text },
    },
  };
  sandbox.factory(pi);
  return { ctx, events, commands, calls, names, widgets, notifications, statuses, titles, persisted, logs,
    start: () => events.session_start({}, ctx),
    update: () => commands['summary:update'].handler('', ctx),
    widget: () => widgets.at(-1)?.join(' ') ?? '',
  };
}

test('summary: existing conversation does not pretend to await first message', async () => {
  const h = harness(summaryFile); await h.start();
  assert.match(h.widget(), /summary:update/);
  assert.doesNotMatch(h.widget(), /Waiting for first message/);
  assert.equal(h.calls.length, 0);
});

test('summary: factory harness handles Windows CRLF checkouts', async () => {
  const h = harness(summaryFile, { crlf: true }); await h.start(); await h.update(); await flush();
  assert.equal(h.names.at(-1), 'Fixed Copilot routing');
});

test('summary: empty session explains reply-end trigger', async () => {
  const h = harness(summaryFile, { entries: [] }); await h.start();
  assert.match(h.widget(), /first reply to finish/);
});

test('summary: runtime call generates name and keeps existing token budget', async () => {
  const h = harness(summaryFile); await h.start(); await h.update(); await flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], model);
  assert.equal(h.calls[0][2].maxTokens, 300);
  assert.ok(h.calls[0][2].signal instanceof AbortSignal);
  assert.equal(h.calls[0][2].apiKey, undefined);
  assert.equal(h.names.at(-1), 'Fixed Copilot routing');
  assert.equal(h.widget(), 'Fixed Copilot routing');
});

test('summary: pending indicator and duplicate request protection', async () => {
  const d = deferred(); const h = harness(summaryFile, { complete: () => d.promise });
  await h.start(); const update = h.update(); await flush();
  assert.match(h.widget(), /Generating summary/);
  await h.update(); assert.equal(h.calls.length, 1);
  d.resolve(response()); await update; await flush();
  assert.doesNotMatch(h.widget(), /Generating/);
});

test('summary: first auth rejection is visible, not hidden by waiting text', async () => {
  const h = harness(summaryFile, { complete: async () => { throw new Error('AUTH_DENIED'); } });
  await h.start(); await h.update(); await flush();
  assert.match(h.widget(), /AUTH_DENIED/);
  assert.doesNotMatch(h.widget(), /Waiting/);
});

test('summary: provider 421 is visible on one bounded line', async () => {
  const h = harness(summaryFile, { complete: async () => ({ stopReason: 'error', content: [], errorMessage: 'OpenAI API error (421): 421 Misdirected Request\n\n' }) });
  await h.start(); await h.update(); await flush();
  assert.match(h.widget(), /421/);
  assert.doesNotMatch(h.widget(), /[\r\n]/);
  assert.ok(visibleWidth(h.widget()) <= 78);
});

test('summary: long Chinese summary respects terminal cell width', async () => {
  const h = harness(summaryFile, { complete: async () => response('修复摘要接口地址兼容性'.repeat(20)) });
  await h.start(); await h.update(); await flush();
  assert.ok(h.names.at(-1).length > 78);
  assert.ok(visibleWidth(h.widget()) <= 78);
});

test('summary: missing model and empty response are reported', async () => {
  const missing = harness(summaryFile, { models: [] }); await missing.start();
  assert.match(missing.widget(), /No summary model/);
  const empty = harness(summaryFile, { complete: async () => response('') });
  await empty.start(); await empty.update(); await flush();
  assert.match(empty.widget(), /EMPTY_RESPONSE/);
});

test('summary: automatic debounce retained; manual update bypasses it', async () => {
  const h = harness(summaryFile); await h.start(); await h.update(); await flush();
  await h.events.agent_end({}, h.ctx); await flush(); assert.equal(h.calls.length, 1);
  await h.update(); await flush(); assert.equal(h.calls.length, 2);
});

test('summary: clearing cancels and discards an old pending result', async () => {
  const d = deferred(); const h = harness(summaryFile, { complete: () => d.promise });
  await h.start(); const pending = h.update(); await flush();
  await h.commands['summary:clear'].handler('', h.ctx);
  assert.equal(h.calls[0][2].signal.aborted, true);
  d.resolve(response('Must not restore this name')); await pending; await flush();
  assert.equal(h.names.at(-1), '');
  assert.doesNotMatch(h.widget(), /Must not/);
});

test('summary: shutdown cancels pending work and ignores late results', async () => {
  const d = deferred(); const h = harness(summaryFile, { complete: () => d.promise });
  await h.start(); const pending = h.update(); await flush();
  await h.events.session_shutdown({}, h.ctx);
  assert.equal(h.calls[0][2].signal.aborted, true);
  d.resolve(response('Old session')); await pending; await flush();
  assert.equal(h.names.length, 0);
});

