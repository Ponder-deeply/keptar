// Tiny argv helpers for the `payload run` scripts.
//
// `payload run` parses its own argv with minimist and forwards only positional
// arguments, so flags such as `--dry-run` would be swallowed. The package.json
// scripts therefore end with `--`: everything after it reaches the script as-is.

export type Args = {
  positional: string[]
  flags: Set<string>
  values: Map<string, string>
}

/** `valueFlags` lists flags that take a value (`--handle foo` or `--handle=foo`). */
export function parseArgs(argv: string[], valueFlags: string[] = []): Args {
  const args: Args = { positional: [], flags: new Set(), values: new Map() }
  for (let i = 0; i < argv.length; i++) {
    const arg = String(argv[i])
    if (arg === '--') continue
    if (!arg.startsWith('--')) {
      args.positional.push(arg)
      continue
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s, 2)
    if (valueFlags.includes(name)) {
      const value = inline ?? argv[++i]
      if (value === undefined) throw new Error(`--${name} needs a value`)
      args.values.set(name, String(value))
    } else {
      args.flags.add(name)
    }
  }
  return args
}
