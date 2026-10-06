# Can the Sidebar draw text larger than the transcript? (Claude Code 2.1.291)

Scope: issue #82, a research child of map #81 ("Sidebar ergonomics"). The human finds the Sidebar's text small next to the 13px HTML previews and asks whether ctui can draw it about 1px larger than the transcript. Every claim below cites a primary source. **Unverified** marks anything no source settles. Researched 2026-10-07.

**Source keys**

- **KTS**: kitty, "The text sizing protocol", `https://sw.kovidgoyal.net/kitty/text-sizing-protocol/` and its source `kovidgoyal/kitty` `docs/text-sizing-protocol.rst`.
- **DTS Ln**: `vendor/claude-code-types/claude-code/index.d.ts` (written by Claude Code 2.1.288; the mod element APIs cited read the same in 2.1.291, see `omarchy-theme-follow.md` on `research/omarchy-follow`).
- **BIN**: `strings` of the 2.1.291 binary (`~/.local/share/mise/installs/claude/2.1.291/claude`).
- **OM:x**: Omarchy 4.0.4 (`pacman -Q omarchy` = `4.0.4-1`) files under `/usr/share/omarchy/`.

## 1. Answers

| Question | Answer |
|---|---|
| Can a terminal size text per cell? | **Only kitty (0.40.0+)**, through OSC 66. Ghostty parses OSC 66 but ignores it. foot implements only the `w` (width) key. Alacritty declined it. |
| Can OSC 66 make text 1px larger? | **No, not in place.** Enlarging needs the integer scale `s ≥ 2`, which makes each run a block `s` rows tall and `s × w` columns wide. A fraction `n/d` (with `d > n`) can only shrink text inside that block. The nearest to "slightly larger" is `s=2` with a fraction such as `n=7:d=12` (≈1.17×). That doubles the rows and columns each line takes. |
| Can a ctui mod emit OSC 66 through Claude Code? | **No.** Claude Code refuses a drawing whose text child holds a control character: "a text child holds a control character (an escape sequence)" (BIN). `Text` has no size prop (DTS L11869-11887). No mod API writes raw bytes to the terminal. |
| Default terminal on Omarchy 4.0.4 | **foot** by Omarchy's preference list, falling back to the next installed terminal. This machine has no foot installed, so it resolves to **Ghostty 1.3.1**, at `font-size = 9` (§3). |
| Other ways to make the Sidebar read larger | `bold`, brighter colors (no `dimColor`), spacing, and glyph choice: all supported, all at the terminal's one font size. An `Image` of pre-rendered text can show any pixel size, in kitty and Ghostty only, at a high cost (§4). Raising the terminal's font size enlarges the transcript too. |

Bottom line: a terminal grid has one font size. No terminal on Omarchy's list can draw the Sidebar 1px larger than the transcript, and Claude Code 2.1.291 would block the escape sequence anyway.

## 2. Terminal support for per-cell text size

**kitty (OSC 66).** Syntax `ESC ] 66 ; metadata ; text BEL` (or `ESC \` terminator). Metadata is colon-separated `key=value` (KTS):

| Key | Range | Meaning |
|---|---|---|
| `s` | 1-7 | Scale. "The text will be rendered in a block of `s * w` by `s` cells." |
| `w` | 0-7 | Width in cells; 0 lets the terminal compute it. |
| `n`, `d` | 0-15 | Fractional scale. "The denominator must be > n when non-zero." The fraction "does not affect the number of cells the text occupies, instead, it just adjusts the rendered font size within those cells." |
| `v`, `h` | 0-2 | Alignment of fractionally scaled text in its block. |

- Fractional scaling "is applied on top of the main scale specified by s". KTS's own example `s=2:n=1:d=2` gives "Normal sized text but with half a line of blank space above and below", so the effective size is `s × n/d`. With `d > n` the fraction is always below 1, and any size above 1× needs `s ≥ 2`, meaning a 2-row block. Sizes are relative to the base font: "if the terminal emulator is using a base font size of 11pt, then s=2 will be rendered in approximately 22pt" (KTS).
- Added in kitty 0.40.0. Terminals without support ignore the sequence and print the text at normal size. Support is detected by comparing cursor-position reports (KTS).
- KTS says nothing about multiplexers. This session runs in tmux 3.7c (`TERM=tmux-256color`), and tmux has no OSC 66 handling of its own. **Unverified** whether it would pass through even with `allow-passthrough on`, which Omarchy's tmux config sets (OM:config/tmux/tmux.conf L75).

**Ghostty.** Its parser recognizes OSC 66 (`src/terminal/osc/parsers/kitty_text_sizing.zig`), but the stream handler logs it as `"unimplemented OSC callback"` (`src/terminal/stream.zig`, `ghostty-org/ghostty` main). The tracking issue ghostty-org/ghostty#10333, "Implement the Text Sizing Protocol (OSC 66)", is open. It notes that the parser landed in #10315 and that cell association and rendering remain to do. Its official "External Protocols" page (`https://ghostty.org/docs/vt/external`) lists only OSC 8 and OSC 21.

**foot.** CHANGELOG 1.21.0: "Support for kitty's text-sizing protocol (`w`, width, only), OSC-66" (`codeberg.org/dnkl/foot` `CHANGELOG.md`). It has no scaling.

**Alacritty.** alacritty/alacritty#8910, "Support Kitty's text sizing protocol", was closed by maintainer chrisduerr on 2026-04-14 with no linked change: "Anything that tries to get away from a grid of characters should be using a GUI instead."

## 3. Omarchy 4.0.4's default terminal

- `omarchy-launch-terminal` runs `xdg-terminal-exec` (OM:bin/omarchy-launch-terminal). Omarchy ships its preference list as `/usr/share/xdg-terminal-exec/hyprland-xdg-terminals.list` (package `omarchy-settings`), whose only entry is `foot.desktop` (OM:default/xdg-terminal-exec/hyprland-xdg-terminals.list). `foot` is in `install/omarchy-base.packages`.
- `omarchy-install-terminal` and `omarchy-default-terminal` accept `alacritty|foot|ghostty|kitty` and write `~/.config/xdg-terminals.list` (OM:bin/*). Omarchy also ships a Ghostty config to `/etc/skel/.config/ghostty/config` with `font-family = "JetBrainsMono Nerd Font"` and `font-size = 9`.
- On this machine `foot` is not installed and there is no user list, so `xdg-terminal-exec --print-id` returns `com.mitchellh.ghostty.desktop`. That is Ghostty 1.3.1-arch2, with `font-size = 9` in `~/.config/ghostty/config`.
- So of the four terminals Omarchy offers, only kitty can draw larger text. foot (Omarchy's default), Ghostty (this machine's) and Alacritty cannot.

## 4. What Claude Code 2.1.291 lets a mod draw

- **Text props.** `color`, `backgroundColor`, `dimColor`, `bold`, `italic`, `underline`, `strikethrough`, `inverse`, `wrap`, `hover` (DTS L11869-11887). There is no size or scale prop. `Box` sizes in cells only.
- **Escape sequences are refused.** The render validator returns `"a text child holds a control character (an escape sequence)"` for a string child that holds one (BIN). Other plugin-authored strings carry the same rule: pane `title` ("a control character is refused", DTS L6944-6946), `Code` and `Markdown` text ("tab and newline its only control characters", DTS L1449-1460, L5395). A refused tree is not drawn. No `$` API writes to the terminal directly. `$.process.run` captures a child's stdout and returns it (DTS L3293-3305), so a child process can't reach the screen either. *Not run live*: the refusal is read from the binary's validator, not seen in a spike.
- **`Raster`** is a cell grid of "one printable width-1 BMP character" per cell (DTS L8610-8640). It draws at the grid's size.
- **`Image`** is "pixels over a box of cells where the terminal can (kitty, Ghostty), the `alt` elsewhere", sized in `columns` × `rows`, from PNG or RGBA bytes, a file or shared memory (DTS L4990-5070). The binary emits kitty-graphics escapes (`a=T,U=1,q=…`) and wraps output for tmux as `\x1BPtmux;…` (BIN). **Unverified** whether `Image` itself goes through that wrapper inside tmux.

## 5. Other ways to make the Sidebar read larger, and their cost

| Option | Terminals | Cost |
|---|---|---|
| `bold` on Sidebar text, or on its labels and values | All | None to build: a prop. It changes weight, not size. Bold draws in the font's bold face at the same cell size. |
| Drop `dimColor` and use brighter theme keys for body text | All | None to build. It raises contrast, not size. It touches the "Sidebar colors inherit the Claude Code theme" decision only in which keys are chosen. |
| Spacing: a blank row between blocks, `paddingX`, fewer glyphs per row | All | Uses rows and columns of an already narrow dock. Size is unchanged. |
| Glyph choice: full-width glyphs, block-letter (figlet-style) headings in `Text` or `Raster` | All | Headings only. Each "large" letter takes several cells and rows, which doesn't fit body text in a ~36-column dock. |
| Raise the terminal's font size (Ghostty `font-size = 10`) | All | Grows the transcript and the Sidebar alike, so the ratio doesn't change. It is configuration for the person, not ctui. |
| Draw Sidebar text as an `Image` rendered at, say, 13px | kitty and Ghostty (`alt` text elsewhere, so not foot or Alacritty) | High. ctui has no dependencies (MEMORY.md, "Publish to Anthropic's plugin directory and to npm"), so it would need its own font rasterizer or a host tool. It loses text selection and theme-key colors (theme colors would have to be resolved into pixels). It redraws whole images on every tick. Behavior in tmux is unverified. |
| OSC 66 `s=2:n=7:d=12` | kitty only | Not possible from a mod (§4). Even where possible, each line takes two rows and double width. |

## 6. Options for the human

1. **Keep the terminal's one size, and make the Sidebar read stronger with `bold` and non-dim colors.** Works everywhere and costs a prop change.
2. **Option 1, plus a note in `docs/configuration`** that the Sidebar can't be sized apart from the transcript, and that raising the terminal's font size enlarges both.
3. **`Image`-rendered Sidebar text** (kitty and Ghostty only). It is the only route to a true pixel size, at high build and runtime cost, with a plain-text fallback elsewhere.
4. **Wait** for Claude Code to add a text-size prop or pass OSC 66 through, and for Ghostty and foot to implement scaling (ghostty-org/ghostty#10333 is open).
