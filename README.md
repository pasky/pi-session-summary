# pi-session-summary

A pi extension that dynamically maintains a one-line LLM-generated session summary, set as the session name so it appears in pi's status bar and `/resume` session list.

![Session summaries in pi's status bar and session list](screenshot.png)

Model is auto-detected from available cheap models, in this order:

1. `openai-codex/gpt-5.6-luna` — if you're logged into ChatGPT/Codex: covered by the subscription, no per-token cost
2. `gpt-5.4-nano`, `gpt-5.4-mini` (direct OpenAI key, or via openrouter)
3. `gemini-3.1-flash-lite`, `gemini-3-flash-preview`
4. `claude-haiku-4-5`

Other `openai-codex` models are never auto-selected: the ChatGPT-OAuth backend rejects generic small models such as `gpt-5.4-mini`. If an auto-detected model fails with a provider error, it's skipped for the rest of the session and the next candidate is used (which may be a paid one — pin `provider`/`model` if you want to prevent that). A failure is reported once via a notification, even with the widget off.

Or configure the model explicitly (see below).

## Install

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
| `/summary:clear` | Reset the summary to the first line of the first user message, clearing all accumulated state. |
| `/summary:cost` | Show the summary model name, number of LLM calls, token usage, and cost breakdown for the current session. |

## Configuration

Create `~/.pi/agent/session-summary.json` (global) or `.pi/session-summary.json` (project override). Project settings are merged on top of global settings, which are merged on top of defaults. Config is reloaded on session start/switch and `/reload`.

All fields are optional — only specify what you want to override:

```json
{
  "provider": "openai-codex",
  "model": "gpt-5.6-luna",
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
| `maxTokens` | `300` | Max tokens for LLM response (not enforced by the `openai-codex` API; the prompt's single-line instruction is the effective cap there) |
| `resummarizeTokenThreshold` | `40000` | Token threshold for full re-summarize vs incremental update |
| `showWidget` | `false` | Show a belowEditor widget with summary, staleness, and compaction info |
| `verbose` | `false` | Show a notification whenever the summary changes |

> **Upgrading from ≤1.0.2:** if `/summary:settings` previously materialized `"provider": "openai-codex", "model": "gpt-5.4-mini"` into your settings file, that model is no longer accepted by Codex — change it to `gpt-5.6-luna` or remove both keys to re-enable auto-detection.
