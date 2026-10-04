/**
 * Hand-placed pixel art. Every icon and illustration in the app is drawn from
 * these grids so the whole interface shares one pixel style.
 *
 *  - Sprites use the palette below ('.' = transparent).
 *  - Glyphs are single-colour UI icons ('x' = filled) drawn with currentColor.
 *  - `mirror: 'x'` mirrors each row horizontally; `'xy'` mirrors a quadrant both ways.
 *  - `patch` applies [x, y, colour] fixes after mirroring (e.g. one-sided highlights).
 */
export const PALETTE: Record<string, string> = {
  k: '#2b2a33',
  w: '#fffaf0',
  c: '#f4e8d0',
  C: '#d6bf96',
  g: '#7fb685',
  G: '#4e8a5a',
  l: '#c4e3b8',
  b: '#7aa6c9',
  B: '#4a7aa0',
  y: '#f2c94c',
  Y: '#c99a2e',
  r: '#e07a5f',
  R: '#b2533b',
  p: '#f3b0a0',
  s: '#d4cec2',
  S: '#8f897d'
}

interface SpriteDef {
  rows: string[]
  mirror?: 'x' | 'xy'
  patch?: Array<[number, number, string]>
}

const reverse = (s: string) => s.split('').reverse().join('')

function expand(def: SpriteDef): string[] {
  let rows = def.rows
  if (def.mirror === 'x' || def.mirror === 'xy') rows = rows.map((r) => r + reverse(r))
  if (def.mirror === 'xy') rows = [...rows, ...[...rows].reverse()]
  if (def.patch?.length) {
    const grid = rows.map((r) => r.split(''))
    for (const [x, y, c] of def.patch) if (grid[y]) grid[y][x] = c
    rows = grid.map((r) => r.join(''))
  }
  return rows
}

/** Crescent moon, generated so the curve stays smooth. */
function crescent(): string[] {
  const size = 16
  const inside = (x: number, y: number) =>
    (x - 7.5) ** 2 + (y - 8) ** 2 <= 6.3 ** 2 && !((x - 11) ** 2 + (y - 5.5) ** 2 <= 5.4 ** 2)
  const rows: string[] = []
  for (let y = 0; y < size; y++) {
    let row = ''
    for (let x = 0; x < size; x++) {
      if (!inside(x, y)) {
        row += '.'
        continue
      }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      row += edge ? 'k' : y > 10 ? 'Y' : 'y'
    }
    rows.push(row)
  }
  // A little twinkle.
  const grid = rows.map((r) => r.split(''))
  for (const [x, y] of [[13, 1], [12, 2], [14, 2], [13, 3]] as const) grid[y][x] = 'y'
  return grid.map((r) => r.join(''))
}

const DEFS = {
  dumbbell: {
    mirror: 'x',
    rows: [
      '........',
      '........',
      '........',
      '.kkk....',
      'kbbbk...',
      'kbwbkkk.',
      'kbbbkBkk',
      'kbbbkBss',
      'kbbbkBSS',
      'kbbbkBkk',
      'kbbbkkk.',
      'kBBBk...',
      '.kkk....',
      '........',
      '........',
      '........'
    ],
    patch: [[13, 5, 'b']]
  },
  trophy: {
    mirror: 'x',
    rows: [
      '........',
      '..kkkkkk',
      'kkkyyyyy',
      'k.kywyyy',
      'k.kywyyy',
      'kkkyyyyy',
      '..kYyyyy',
      '...kYyyy',
      '....kkYy',
      '......kY',
      '......kY',
      '....kkkk',
      '...kYYYY',
      '...kkkkk',
      '........',
      '........'
    ],
    patch: [[11, 3, 'y'], [11, 4, 'y'], [12, 6, 'Y'], [11, 7, 'Y'], [10, 8, 'Y'], [9, 9, 'Y'], [9, 10, 'Y']]
  },
  calendar: {
    mirror: 'x',
    rows: [
      '........',
      '..k...k.',
      'kkkkkkkk',
      'kgkgggkg',
      'kggggggg',
      'kkkkkkkk',
      'kwwwwwww',
      'kwkwwkww',
      'kwwwwwww',
      'kwkwwkww',
      'kwwwwwww',
      'kwkwwkww',
      'kwwwwwww',
      'kkkkkkkk',
      '........',
      '........'
    ],
    patch: [[10, 9, 'r'], [10, 11, 'g'], [13, 11, 'g']]
  },
  clipboard: {
    mirror: 'x',
    rows: [
      '........',
      '........',
      '.....kkk',
      '.kkkkkss',
      '.kCCCkkk',
      '.kCwwwww',
      '.kCwgwkk',
      '.kCwwwww',
      '.kCwgwkk',
      '.kCwwwww',
      '.kCwgwkk',
      '.kCwwwww',
      '.kCCCCCC',
      '.kkkkkkk',
      '........',
      '........'
    ],
    patch: [
      [10, 6, 'k'], [11, 6, 'w'],
      [10, 8, 'k'], [11, 8, 'w'],
      [10, 10, 'k'], [11, 10, 'w']
    ]
  },
  book: {
    mirror: 'x',
    rows: [
      '........',
      '........',
      '.kkk....',
      'kwwwkk..',
      'kwwwwwkk',
      'kwkkkwwk',
      'kwwwwwwk',
      'kwkkkkwk',
      'kwwwwwwk',
      'kwkkkwwk',
      'kwwwwwwk',
      'kwwwwwwk',
      'kBBBBBBk',
      '.kkkkkkk',
      '........',
      '........'
    ]
  },
  chart: {
    rows: [
      '................',
      '................',
      '................',
      '...........kkkk.',
      '...........kyyk.',
      '...........kyyk.',
      '......kkkk.kyyk.',
      '......kbbk.kyyk.',
      '......kbbk.kyyk.',
      '.kkkk.kbbk.kyyk.',
      '.kggk.kbbk.kyyk.',
      '.kggk.kbbk.kyyk.',
      '.kGGk.kBBk.kYYk.',
      'kkkkkkkkkkkkkkkk',
      '................',
      '................'
    ]
  },
  gear: {
    mirror: 'xy',
    rows: ['......kk', '..kk.kss', '.ksskkss', '.kssssss', '..ksssSk', '.ksssSk.', 'kssssk..', 'kssssk..']
  },
  sun: {
    mirror: 'xy',
    rows: ['........', '.Y.....Y', '..Y....Y', '........', '.....kkk', '....kyyy', '...kyyyy', 'YY.kyyyy'],
    patch: [[5, 6, 'w'], [6, 5, 'w']]
  },
  heart: {
    mirror: 'x',
    rows: [
      '........',
      '........',
      '..kkk...',
      '.krrrk..',
      'krwrrrkk',
      'krrrrrrr',
      'krrrrrrr',
      '.krrrrrr',
      '..krrrrr',
      '...krrrr',
      '....krrr',
      '.....krr',
      '......kr',
      '.......k',
      '........',
      '........'
    ],
    patch: [[13, 4, 'r']]
  },
  scale: {
    mirror: 'x',
    rows: [
      '........',
      '........',
      '.kkkkkkk',
      'kbbbbbbb',
      'kbbkkkkk',
      'kbbkwwww',
      'kbbkwwwk',
      'kbbkkkkk',
      'kbbbbbbb',
      'kbbbbbbb',
      'kbbbbbbb',
      'kBBBBBBB',
      '.kkkkkkk',
      '.kk.....',
      '........',
      '........'
    ]
  },
  stopwatch: {
    mirror: 'x',
    rows: [
      '......kk',
      '......ky',
      '....kkkk',
      '..kkwwww',
      '.kwwwwww',
      '.kwwwwww',
      'kwwwwwwk',
      'kwwwwwwk',
      'kwwwwwwk',
      'kwwwwwww',
      'kwwwwwww',
      '.kwwwwww',
      '.kwwwwww',
      '..kkwwww',
      '....kkkk',
      '........'
    ]
  },
  star: {
    mirror: 'x',
    rows: [
      '.......k',
      '......ky',
      '......ky',
      '.....kyy',
      'kkkkkkyy',
      'kyyyyyyy',
      '.kyyyyyy',
      '..kyyyyy',
      '...kyyyy',
      '...kyyyy',
      '..kyyyyy',
      '..kyyykk',
      '.kyykk..',
      '.kkk....',
      '........',
      '........'
    ],
    patch: [[7, 2, 'w'], [7, 3, 'w']]
  },
  mascot: {
    mirror: 'x',
    rows: [
      '..........',
      '..........',
      '......kkkk',
      '....kkgggg',
      '...kgggggg',
      '..kbbbbbbb',
      '..kBBBBBBB',
      '.kgggggggg',
      '.kggggkggg',
      '.kggggkggg',
      '.kgpgggggg',
      '.kgggggkgg',
      '.kggggggkk',
      '.kgggggggg',
      '..kGgggggg',
      '...kGGGGGG',
      '....kkkkkk'
    ],
    patch: [
      [5, 3, 'l'], [6, 3, 'l'], [4, 4, 'l'], [5, 4, 'l'],
      [16, 10, 'p'], [17, 14, 'G'], [18, 6, 'k'], [19, 6, 'b'], [19, 7, 'B'], [19, 5, 'k'], [19, 8, 'k']
    ]
  }
} satisfies Record<string, SpriteDef>

export type SpriteName = keyof typeof DEFS | 'moon'

const cache = new Map<string, string[]>()

export function spriteRows(name: SpriteName): string[] {
  let rows = cache.get(name)
  if (!rows) {
    rows = name === 'moon' ? crescent() : expand(DEFS[name as keyof typeof DEFS])
    cache.set(name, rows)
  }
  return rows
}

// ---- glyphs -----------------------------------------------------------------

const GLYPHS = {
  plus: ['........', '...xx...', '...xx...', '.xxxxxx.', '.xxxxxx.', '...xx...', '...xx...', '........'],
  minus: ['........', '........', '........', '.xxxxxx.', '.xxxxxx.', '........', '........', '........'],
  check: ['........', '.......x', '......xx', 'x....xx.', 'xx..xx..', '.xxxx...', '..xx....', '........'],
  close: ['xx....xx', 'xxx..xxx', '.xxxxxx.', '..xxxx..', '..xxxx..', '.xxxxxx.', 'xxx..xxx', 'xx....xx'],
  trash: ['...xx...', 'xxxxxxxx', '........', '.xxxxxx.', '.x.xx.x.', '.x.xx.x.', '.x.xx.x.', '..xxxx..'],
  pencil: ['......xx', '.....x.x', '....x.x.', '...x.x..', '..x.x...', '.xxx....', 'xxx.....', 'x.......'],
  up: ['........', '........', '...xx...', '..xxxx..', '.xx..xx.', 'xx....xx', '........', '........'],
  down: ['........', '........', 'xx....xx', '.xx..xx.', '..xxxx..', '...xx...', '........', '........'],
  left: ['....xx..', '...xx...', '..xx....', '.xx.....', '.xx.....', '..xx....', '...xx...', '....xx..'],
  right: ['..xx....', '...xx...', '....xx..', '.....xx.', '.....xx.', '....xx..', '...xx...', '..xx....'],
  search: ['.xxxx...', 'xx..xx..', 'x....x..', 'x....x..', 'xx..xx..', '.xxxxxx.', '.....xxx', '......xx'],
  play: ['..x.....', '..xx....', '..xxx...', '..xxxx..', '..xxxx..', '..xxx...', '..xx....', '..x.....'],
  pause: ['........', '.xx..xx.', '.xx..xx.', '.xx..xx.', '.xx..xx.', '.xx..xx.', '.xx..xx.', '........'],
  reset: ['..xxxx.x', '.x....xx', 'x....xxx', 'x.......', 'x.......', 'x......x', '.x....x.', '..xxxx..'],
  copy: ['xxxxx...', 'x...x...', 'x.xxxxx.', 'x.x...x.', 'xxx...x.', '..x...x.', '..xxxxx.', '........'],
  export: ['...xx...', '..xxxx..', '.xxxxxx.', '...xx...', '...xx...', 'x..xx..x', 'x......x', 'xxxxxxxx'],
  import: ['...xx...', '...xx...', '...xx...', '.xxxxxx.', '..xxxx..', 'x..xx..x', 'x......x', 'xxxxxxxx'],
  clock: ['..xxxx..', '.x....x.', 'x..x...x', 'x..x...x', 'x..xxx.x', 'x......x', '.x....x.', '..xxxx..'],
  dot: ['........', '........', '..xxxx..', '..xxxx..', '..xxxx..', '..xxxx..', '........', '........'],
  note: ['xxxxxx..', 'x....xx.', 'x.xx..x.', 'x.....x.', 'x.xxx.x.', 'x.....x.', 'x.xx..x.', 'xxxxxxx.'],
  flag: ['xx......', 'xxxxxxx.', 'xxxxxxx.', 'xxxxxxx.', 'xx......', 'x.......', 'x.......', 'x.......']
} satisfies Record<string, string[]>

export type GlyphName = keyof typeof GLYPHS

export function glyphRows(name: GlyphName): string[] {
  return GLYPHS[name]
}

/** Merges horizontal runs of the same colour into rectangles for compact SVG. */
export function toRuns(rows: string[]): Array<{ x: number; y: number; w: number; c: string }> {
  const runs: Array<{ x: number; y: number; w: number; c: string }> = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      if (c === '.') {
        x++
        continue
      }
      let w = 1
      while (row[x + w] === c) w++
      runs.push({ x, y, w, c })
      x += w
    }
  })
  return runs
}
