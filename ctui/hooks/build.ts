// The build of ctui running.
// Claude Code installs an unversioned plugin from a marketplace into
// `plugins/cache/<marketplace>/<plugin>/<12-char commit>`, the id `/plugin` shows
// (measured on 2.1.300); any other folder is one `--plugin-dir` loaded.
export const build = (root: string) => /[\\/]plugins[\\/]cache[\\/][^\\/]+[\\/][^\\/]+[\\/]([^\\/]+)$/.exec(root)?.[1] ?? 'local'
