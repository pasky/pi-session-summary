# pi-session-summary

A pi extension that shows a one-line LLM-generated session summary below the editor.

## Features

- **Trigger**: `agent_end` event, debounced (default: every 120 seconds)
- **Model**: Configurable, defaults to `openai-codex/gpt-5.4-mini`
- **Hybrid display**: Shows `[compaction summary | last LLM summary] + N new turns since` between updates
- **Incremental updates**: Asks LLM to update previous summary only if material progress occurred
- **Full re-summarize**: Every ~40k tokens of new conversation, re-summarizes from scratch
- **Compact input**: Includes user+assistant text, skips tool I/O (shows only `[tool call: edit]` / `[tool result: 423 bytes]`)
- **Persistence**: Saves summary on shutdown, restores on session start/switch
- **Non-blocking**: LLM call runs asynchronously in background

## Install

```bash
pi install /path/to/pi-session-summary
```

Or add to `settings.json`:

```json
{
  "packages": ["/path/to/pi-session-summary"]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `/summary:settings` | Creates the global settings JSON file (`~/.pi/agent/session-summary.json`) with defaults if it doesn't exist, and shows instructions to edit it. Run `/reload` after editing. |
| `/summary:update` | Force an immediate summary update, bypassing the debounce timer. |
| `/summary:clear` | Reset the summary to the first line of the first user message, clearing all accumulated state. |
| `/summary:cost` | Show the summary model name, number of LLM calls, token usage, and cost breakdown for the current session. |

## Configuration

Create `~/.pi/agent/session-summary.json` (global) or `.pi/session-summary.json` (project override). Project settings are merged on top of global settings, which are merged on top of defaults. Config is reloaded on session start/switch and `/reload`.

All fields are optional — only specify what you want to override:

```json
{
  "provider": "openai-codex",
  "model": "gpt-5.4-mini",
  "debounceSeconds": 120,
  "maxTokens": 300,
  "resummarizeTokenThreshold": 40000
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `provider` | `"openai-codex"` | Model provider |
| `model` | `"gpt-5.4-mini"` | Model ID |
| `debounceSeconds` | `120` | Min seconds between LLM calls |
| `maxTokens` | `300` | Max tokens for LLM response |
| `resummarizeTokenThreshold` | `40000` | Token threshold for full re-summarize vs incremental update |
