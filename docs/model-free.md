# Free model selection (`--model free` / `--model 3`)

`--model free` forces OpenRouter and only tries `openrouter/...:free` models (in order), falling back on any request error.

## Requirements

- `OPENROUTER_API_KEY` must be set.

## Config

Default config file: `~/.summarize/config.json`

```json
{
  "model": {
    "mode": "free",
    "rules": [
      {
        "candidates": [
          "openrouter/allenai/olmo-3.1-32b-think:free",
          "openrouter/meta-llama/llama-3.3-70b-instruct:free"
        ]
      }
    ]
  }
}
```

Minimal shorthand:

```json
{
  "model": "free"
}
```
