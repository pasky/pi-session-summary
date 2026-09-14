# pi-session-summary

A pi extension that dynamically maintains a one-line LLM-generated session summary, set as the session name so it appears in pi's status bar and `/resume` session list.

![Session summaries in pi's status bar and session list](screenshot.png)

Model is auto-detected from available cheap models (gpt-5.4-nano, gpt-5.4-mini, gemini-3-flash, claude-4-5-haiku), or can be configured explicitly.

## Install

Requires Pi 0.85.1 or later in the 0.85 release series and Node.js 22.19 or later.
Model requests go through Pi's model runtime, which handles OAuth credentials,
provider headers, and account-specific endpoints (including GitHub Copilot Business).

```bash
pi install npm:pi-session-summary
```

Or add to `settings.json`:

```json
{
  "packages": ["pi-session-summary"]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `/summary:settings` | Creates the global settings JSON file (`~/.pi/agent/session-summary.json`) with defaults if it doesn't exist, and shows instructions to edit it. Run `/reload` after editing. |
| `/summary:update` | Force an immediate summary update, bypassing the debounce timer. |
| `/summary:clear` | Clear the summary/session name and accumulated state, cancelling any pending summary request. |
| `/summary:cost` | Show the summary model name, number of LLM calls, token usage, and cost breakdown for the current session. |

## Configuration

Create `~/.pi/agent/session-summary.json` (global) or `.pi/session-summary.json` (project override). Project settings are merged on top of global settings, which are merged on top of defaults. Config is reloaded on session start/switch and `/reload`.

All fields are optional — only specify what you want to override:

```json
{
  "provider": "openai-codex",
  "model": "gpt-5.4-mini",
  "debounceSeconds": 60,
  "maxTokens": 300,
  "resummarizeTokenThreshold": 40000,
  "showWidget": false,
  "verbose": false
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `provider` | *(auto-detect)* | Model provider |
| `model` | *(auto-detect)* | Model ID |
| `debounceSeconds` | `60` | Min seconds between LLM calls |
| `maxTokens` | `300` | Max tokens for LLM response |
| `resummarizeTokenThreshold` | `40000` | Token threshold for full re-summarize vs incremental update |
| `showWidget` | `false` | Show a belowEditor widget with summary, staleness, and compaction info |
| `verbose` | `false` | Show a notification whenever the summary changes |

## Update timing and errors

Automatic generation runs after an agent response finishes. `debounceSeconds` is
an interval limit, not a polling timer. Reloading/restoring a conversation does not
make a model request; use `/summary:update` to summarize its existing history.

With `showWidget: true`, the widget distinguishes waiting for a reply, generating,
and request errors. Errors are shown even before the first successful summary.
Requests have a 30-second deadline; clearing the summary or shutting down/reloading
the extension cancels pending work and discards late results.

## Tests

After installing the package's peer dependencies, run `npm test` (Node.js 22.19+).
The tests use an isolated context and mock model runtime, with no credentials,
network requests, or writes to real sessions.
