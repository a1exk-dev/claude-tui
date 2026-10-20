// Draws ctui's directory listing icon: `node scripts/icon.ts`.
// The human's pick in #413, Tally · cells: Todo's three marks, each with a text bar, on a grid of
// terminal cells. `node scripts/check.ts` fails when rerunning this would change the committed file.
import { writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

export const ICON = 'ctui/.claude-plugin/icon.png'

const SIZE = 1024
const N = 25
const PITCH = 35
const GAP = 4
const RADIUS = 5
const OFFSET = (SIZE - N * PITCH + GAP) / 2
// Samples per pixel side, to antialias the rounded corners.
const SS = 4

// The design renders' colours (docs/design/sidebar.html), each mark keeping its role from ctui/plugins/marks.tsx.
const panel = '#141414'
const unlit = '#1b1b1b'
const green = '#7fd88f'
const orange = '#f5a742'
const faint = '#484848'
const muted = '#808080'
const main = '#eeeeee'

const marks = [
  { colour: green, bar: muted, length: 10, rows: ['..###..', '.#####.', '#.###.#', '##.#.##', '###.###', '.#####.', '..###..'] },
  { colour: orange, bar: main, length: 14, rows: ['..###..', '.#...#.', '#...#.#', '#..##.#', '#.###.#', '.#...#.', '..###..'] },
  { colour: faint, bar: muted, length: 8, rows: ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..###..'] },
]

// Each cell's colour, row-major: the marks in columns 1–7, their bars on the middle row from column 10.
const cells = () => {
  const grid: string[] = Array(N * N).fill(unlit)
  marks.forEach(({ colour, bar, length, rows }, i) => {
    const top = 1 + 8 * i
    rows.forEach((row, y) => [...row].forEach((c, x) => c === '#' && (grid[(top + y) * N + 1 + x] = colour)))
    for (let x = 10; x < 10 + length; x++) grid[(top + 3) * N + x] = bar
  })
  return grid
}

// The cell a point falls in, or -1 in a gap or outside a rounded corner.
const cellAt = (px: number, py: number) => {
  const gx = Math.floor((px - OFFSET) / PITCH)
  const gy = Math.floor((py - OFFSET) / PITCH)
  if (gx < 0 || gy < 0 || gx >= N || gy >= N) return -1
  const side = PITCH - GAP
  const x = px - OFFSET - gx * PITCH
  const y = py - OFFSET - gy * PITCH
  if (x >= side || y >= side) return -1
  const dx = Math.max(RADIUS - x, x - (side - RADIUS), 0)
  const dy = Math.max(RADIUS - y, y - (side - RADIUS), 0)
  return dx * dx + dy * dy <= RADIUS * RADIUS ? gy * N + gx : -1
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

const pixels = () => {
  const grid = cells().map(channels)
  const background = channels(panel)
  const rgb = Buffer.alloc(SIZE * SIZE * 3)
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const sum = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const cell = cellAt(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS)
          const colour = cell < 0 ? background : grid[cell]!
          for (let c = 0; c < 3; c++) sum[c]! += colour[c]!
        }
      }
      for (let c = 0; c < 3; c++) rgb[(py * SIZE + px) * 3 + c] = Math.round(sum[c]! / (SS * SS))
    }
  }
  return rgb
}

const chunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

// The icon's PNG bytes: an opaque 1024×1024 8-bit RGB image, every scanline unfiltered.
export const png = () => {
  const rgb = pixels()
  const rows = Buffer.alloc(SIZE * (SIZE * 3 + 1))
  for (let y = 0; y < SIZE; y++) rgb.copy(rows, y * (SIZE * 3 + 1) + 1, y * SIZE * 3, (y + 1) * SIZE * 3)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

if (import.meta.main) writeFileSync(new URL(`../${ICON}`, import.meta.url), png())
