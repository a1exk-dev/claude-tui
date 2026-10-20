// The version of ctui running.
// Claude Code installs a plugin from a marketplace into
// `plugins/cache/<marketplace>/<plugin>/<version>`, named by plugin.json's `version`;
// any other folder is one `--plugin-dir` loaded.
export const build = (root: string) => /[\\/]plugins[\\/]cache[\\/][^\\/]+[\\/][^\\/]+[\\/]([^\\/]+)$/.exec(root)?.[1] ?? 'local'
