import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'public', 'icons')
mkdirSync(publicDir, { recursive: true })

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4)
    raw[row] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, row + 1)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))])
}

function makeCanvas(size) {
  return { width: size, height: size, data: new Uint8Array(size * size * 4) }
}

function fillRect(c, x0, y0, x1, y1, [r, g, b, a] = [255, 255, 255, 255]) {
  const ix0 = Math.max(0, Math.floor(x0))
  const iy0 = Math.max(0, Math.floor(y0))
  const ix1 = Math.min(c.width, Math.ceil(x1))
  const iy1 = Math.min(c.height, Math.ceil(y1))
  for (let y = iy0; y < iy1; y++) {
    for (let x = ix0; x < ix1; x++) {
      const i = (y * c.width + x) * 4
      c.data[i] = r
      c.data[i + 1] = g
      c.data[i + 2] = b
      c.data[i + 3] = a
    }
  }
}

function fillRoundedRect(c, x0, y0, x1, y1, rad, color) {
  const ix0 = Math.max(0, Math.floor(x0))
  const iy0 = Math.max(0, Math.floor(y0))
  const ix1 = Math.min(c.width, Math.ceil(x1))
  const iy1 = Math.min(c.height, Math.ceil(y1))
  for (let y = iy0; y < iy1; y++) {
    for (let x = ix0; x < ix1; x++) {
      let inside = true
      if (x < x0 + rad && y < y0 + rad) {
        inside = (x - (x0 + rad)) ** 2 + (y - (y0 + rad)) ** 2 <= rad * rad
      } else if (x > x1 - rad && y < y0 + rad) {
        inside = (x - (x1 - rad)) ** 2 + (y - (y0 + rad)) ** 2 <= rad * rad
      } else if (x < x0 + rad && y > y1 - rad) {
        inside = (x - (x0 + rad)) ** 2 + (y - (y1 - rad)) ** 2 <= rad * rad
      } else if (x > x1 - rad && y > y1 - rad) {
        inside = (x - (x1 - rad)) ** 2 + (y - (y1 - rad)) ** 2 <= rad * rad
      }
      if (inside) {
        const i = (y * c.width + x) * 4
        c.data[i] = color[0]
        c.data[i + 1] = color[1]
        c.data[i + 2] = color[2]
        c.data[i + 3] = color[3] ?? 255
      }
    }
  }
}

function fillTriangle(c, cx, yTop, halfBase, yBase, color) {
  const iyTop = Math.max(0, Math.floor(yTop))
  const iyBase = Math.min(c.height, Math.ceil(yBase))
  for (let y = iyTop; y < iyBase; y++) {
    const t = (y - yTop) / (yBase - yTop)
    const hw = halfBase * t
    const x0 = Math.max(0, Math.floor(cx - hw))
    const x1 = Math.min(c.width, Math.ceil(cx + hw))
    for (let x = x0; x < x1; x++) {
      const i = (y * c.width + x) * 4
      c.data[i] = color[0]
      c.data[i + 1] = color[1]
      c.data[i + 2] = color[2]
      c.data[i + 3] = color[3] ?? 255
    }
  }
}

const RED = [214, 69, 69, 255]
const WHITE = [255, 255, 255, 255]

// "Partilhar" = bandeja + haste + seta. f = coordenadas 0..1; scale encolhe para a safe area.
function drawShare(c, scale = 1) {
  const cx = c.width / 2
  const f = (fp) => c.width * (0.5 + (fp - 0.5) * scale)
  fillRoundedRect(c, f(0.23), f(0.23), f(0.77), f(0.77), c.width * 0.09 * scale, RED)
  fillRoundedRect(c, f(0.32), f(0.63), f(0.68), f(0.74), c.width * 0.02 * scale, WHITE)
  fillRect(c, cx - c.width * 0.042 * scale, f(0.36), cx + c.width * 0.042 * scale, f(0.655), WHITE)
  fillTriangle(c, cx, f(0.21), c.width * 0.17 * scale, f(0.38), WHITE)
}

const sizes = [
  { size: 512, file: 'icon-512.png', scale: 1 },
  { size: 192, file: 'icon-192.png', scale: 1 },
  { size: 512, file: 'maskable-512.png', scale: 0.84 },
  { size: 180, file: 'apple-touch-icon.png', scale: 1 },
]

for (const { size, file, scale } of sizes) {
  const c = makeCanvas(size)
  drawShare(c, scale)
  writeFileSync(join(publicDir, file), encodePng(c.width, c.height, c.data))
  console.log('icon:', file)
}