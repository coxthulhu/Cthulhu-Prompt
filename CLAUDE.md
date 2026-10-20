@AGENTS.md

## Claude Code Notes

`AGENTS.md` is written for Codex tooling. Translate its Codex-specific instructions as follows:

- `sandbox_permissions="require_escalated"` → set `dangerouslyDisableSandbox: true` on the Bash call. Use it for the `./scripts/wsl-*.sh` wrappers, for Git commands that write to `.git`, and for Git commands that contact a remote.
- `fork_turns: "none"` → do not use the `fork` subagent type. Use a fresh subagent and give it the context it needs in the prompt.
- "Commentary channel" → your next message to the user.
- Give the `./scripts/wsl-*.sh` wrappers a 300000 ms timeout.
- If Git needs interactive auth, suggest that the user run the command with the `!` prefix.

## Commits

- Commit or push only when the user asks.
- Write plain commit messages. Never add a `Co-Authored-By` trailer or any model-credit line.
