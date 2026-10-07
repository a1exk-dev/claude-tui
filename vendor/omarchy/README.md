# Omarchy 4.0.4 theme sources

Copied unchanged from [Omarchy](https://github.com/basecamp/omarchy) 4.0.4 (tag `v4.0.4`, commit `c668141e9c42b13c80c9ca4ea108e11708c5e8a5`), at the same paths:

- `themes/<slug>/colors.toml`: the palettes of Omarchy's 22 built-in themes.
- `default/themed/claude.json.tpl`: Omarchy's Claude Code theme template.

Omarchy is MIT-licensed, copyright David Heinemeier Hansson; its license is in `LICENSE`.

`node scripts/themes.ts` reads these files and writes ctui's Themes, `ctui/themes/<slug>.json`, and the Theme table in `docs/configuration.md`. ctui never reads Omarchy's files at runtime, and this folder doesn't ship in the npm package.

To move to a newer Omarchy, replace these files from its tag, update the version here and in `ctui/LICENSE`, and rerun the generator.
