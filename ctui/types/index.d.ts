// ctui's $.state contract. Fold state lives here so it survives a reload.
export type Folded = Record<string, boolean>

declare module 'claude-code' {
  interface PluginState {
    ctui: { folded: Folded }
  }
}
