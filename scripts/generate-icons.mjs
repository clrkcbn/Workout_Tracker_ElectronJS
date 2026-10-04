// Generates the app icon (build/icon.png + build/icon.ico) from a 16×16 pixel
// design, scaled with nearest-neighbour so every size stays crisp.
// Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const PALETTE = {
  k: [0x2b, 0x2a, 0x33],
  w: [0xff, 0xfa, 0xf0],
  y: [0xf2, 0xc9, 0x4c],
  g: [0x7f, 0xb6, 0x85],
  G: [0x4e, 0x8a, 0x5a],
  s: [0xd4, 0xce, 0xc2],
  S: [0x8f, 0x89, 0x7d]
}

// Left half; mirrored to 16 columns. A cream dumbbell on a leaf-green tile.
const HALF = [
  '.kkkkkkk',
  'kggggggg',
  'kggggggg',
  'kggggggg',
  'kggkkkgg',
  'kgkwwwkg',
  'kgkwwwkk',
  'kgkwwwks',
  'kgkwwwkS',
  'kgkwwwkk',
  'kgkyyykg',
  'kggkkkgg',
  'kggggggg',
  'kggggggg',
  'kGGGGGGG',
  '.kkkkkkk'
]
const ART = HALF.map((row) => row + [...row].reverse().join(''))

function rgba(size) {
  const scale = size / 16
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = ART[Math.floor(y / scale)][Math.floor(x / scale)]
      const i = (y * size + x) * 4
      if (c === '.') continue
      const [r, g, b] = PALETTE[c]
      buf[i] = r
      buf[i + 1] = g
      buf[i + 2] = b
      buf[i + 3] = 255
    }
  }
  return buf
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td) >>> 0)
  return Buffer.concat([len, td, crc])
}

function png(size) {
  const pixels = rgba(size)
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function ico(sizes) {
  const images = sizes.map((s) => png(s))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = 6 + 16 * sizes.length
  const entries = sizes.map((size, i) => {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(images[i].length, 8)
    e.writeUInt32LE(offset, 12)
    offset += images[i].length
    return e
  })
  return Buffer.concat([header, ...entries, ...images])
}

mkdirSync(join(root, 'build'), { recursive: true })
writeFileSync(join(root, 'build', 'icon.png'), png(256))
writeFileSync(join(root, 'build', 'icon.ico'), ico([16, 32, 48, 64, 128, 256]))
mkdirSync(join(root, 'src', 'renderer', 'public'), { recursive: true })
writeFileSync(join(root, 'src', 'renderer', 'public', 'favicon.png'), png(64))
console.log('Wrote build/icon.png, build/icon.ico and src/renderer/public/favicon.png')
