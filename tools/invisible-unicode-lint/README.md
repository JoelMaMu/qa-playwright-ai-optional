# invisible-unicode-lint

Finds invisible Unicode characters in the files your AI assistant reads and
interprets.

## The problem

**An agent definition file is executable code.**

`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.github/*.prompt.md`, a system prompt:
these are loaded and interpreted on every session, on every workstation, without
anyone running anything. They look like documentation. They behave like a startup
script.

Instructions can be hidden in them using zero-width characters (U+200B to U+200F),
bidirectional overrides (U+202A to U+202E) or plane 14 tags (U+E0000 to U+E007F).
The result is invisible in a GitHub diff, invisible in an editor, invisible to a
careful reviewer, and perfectly readable by the model.

A human PR review cannot structurally catch this. That is why the check has to be
automatic.

## Usage

```bash
node bin/cli.mjs                    # text and assistant-read files, from cwd
node bin/cli.mjs --all              # every file, whatever its extension
node bin/cli.mjs .github/ ai/       # specific paths
npm run lint:unicode
```

Exit codes: `0` clean, `1` findings, `2` execution error.

No dependencies: it must run in a pre-commit hook and in a minimal CI job, even
when `npm ci` has failed.

## What it detects

| Range | Nature | Severity |
|---|---|---|
| U+200B to U+200F | zero-width, directional marks | high |
| U+202A to U+202E | bidi override (Trojan Source) | critical |
| U+2060 to U+2064 | invisible joiners | high |
| U+2066 to U+2069 | directional isolates | critical |
| U+180E | Mongolian vowel separator | high |
| U+FEFF | BOM in inner position | medium |
| U+E0000 to U+E007F | Unicode tags (plane 14) | critical |

Findings in assistant-read files are marked `[READ BY AN ASSISTANT]` and sorted
first: those are the ones that execute.

## Two design choices

**No self-exemption.** The tool lints itself and passes. Its character ranges are
declared as code points and the redaction used in reports is derived from that same
table, so this repository contains no invisible literal anywhere. A security tool
that has to exclude itself from its own check is a tool that eventually gets
disabled, and the day it is disabled is the day it would have mattered.

**No auto-fix.** It reports, it does not clean. An invisible character in an
instruction file is a security event: it calls for an investigation into where it
came from, not a `--fix` that erases the evidence.

## Declared limits

- It detects **concealment, not intent**. A hostile instruction written in visible
  ASCII is not in scope; human review handles that one.
- It does not cover **homoglyphs**, visually identical characters. That is a
  neighbouring but distinct problem with a much higher false-positive rate.
- The default scope targets assistant filenames known in 2026. A new convention
  must be added to `AGENT_FILES` in `bin/cli.mjs`.
