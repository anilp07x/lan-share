import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'build')
mkdirSync(outDir, { recursive: true })

function loadPng(file) {
  const png = PNG.sync.read(readFileSync(file))
  return { width: png.width, height: png.height, data: png.data }
}

function boxScale(src, size) {
  const out = new Uint8Array(size * size * 4)
  const ratio = src.width / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      const x0 = Math.floor(x * ratio), x1 = Math.min(src.width, Math.ceil((x + 1) * ratio))
      const y0 = Math.floor(y * ratio), y1 = Math.min(src.height, Math.ceil((y + 1) * ratio))
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.width + sx) * 4
          const alpha = src.data[i + 3] / 255
          r += src.data[i] * alpha
          g += src.data[i + 1] * alpha
          b += src.data[i + 2] * alpha
          a += src.data[i + 3]
          n++
        }
      }
      const o = (y * size + x) * 4
      const w = n === 0 ? 0 : a / 255
      out[o] = w > 0 ? Math.round(r / w) : 0
      out[o + 1] = w > 0 ? Math.round(g / w) : 0
      out[o + 2] = w > 0 ? Math.round(b / w) : 0
      out[o + 3] = Math.round(a / n)
    }
  }
  return { width: size, height: size, data: out }
}

function pad(src, size, inset) {
  const out = new Uint8Array(size * size * 4)
  const inner = boxScale(src, size - inset * 2)
  for (let y = 0; y < inner.height; y++) {
    for (let x = 0; x < inner.width; x++) {
      const si = (y * inner.width + x) * 4
      const di = (y + inset) * size + (x + inset)
      out[di * 4] = inner.data[si]
      out[di * 4 + 1] = inner.data[si + 1]
      out[di * 4 + 2] = inner.data[si + 2]
      out[di * 4 + 3] = inner.data[si + 3]
    }
  }
  return { width: size, height: size, data: out }
}

function monochrome(src) {
  const out = new Uint8Array(src.width * src.height * 4)
  for (let i = 0; i < src.width * src.height; i++) {
    const a = src.data[i * 4 + 3]
    out[i * 4] = 255
    out[i * 4 + 1] = 255
    out[i * 4 + 2] = 255
    out[i * 4 + 3] = a
  }
  return { width: src.width, height: src.height, data: out }
}

function bmpEntry(img) {
  const { width, height, data } = img
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(width, 4)
  header.writeInt32LE(height * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  const xor = Buffer.alloc(width * height * 4)
  const and = Buffer.alloc(Math.ceil(width / 32) * 4 * height)
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width
    for (let x = 0; x < width; x++) {
      const si = (srcRow + x) * 4
      const di = (y * width + x) * 4
      xor[di] = data[si + 2]
      xor[di + 1] = data[si + 1]
      xor[di + 2] = data[si]
      xor[di + 3] = data[si + 3]
    }
  }
  return Buffer.concat([header, xor, and])
}

function ico(images) {
  const entries = images.map(bmpEntry)
  const dir = Buffer.alloc(6 + entries.length * 16)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(images.length, 4)
  let offset = dir.length
  images.forEach((img, i) => {
    const at = 6 + i * 16
    dir.writeUInt8(img.width >= 256 ? 0 : img.width, at)
    dir.writeUInt8(img.height >= 256 ? 0 : img.height, at + 1)
    dir.writeUInt8(0, at + 2)
    dir.writeUInt8(0, at + 3)
    dir.writeUInt16LE(1, at + 4)
    dir.writeUInt16LE(32, at + 6)
    dir.writeUInt32LE(entries[i].length, at + 8)
    dir.writeUInt32LE(offset, at + 12)
    offset += entries[i].length
  })
  return Buffer.concat([dir, ...entries])
}

const source = loadPng(join(root, 'client', 'public', 'icons', 'maskable-512.png'))
const appSizes = [16, 24, 32, 48, 64, 128, 256]
writeFileSync(join(outDir, 'icon.ico'), ico(appSizes.map((s) => boxScale(source, s))))
writeFileSync(join(outDir, 'icon.png'), PNG.sync.write(boxScale(source, 512)))

const traySource = monochrome(source)
writeFileSync(join(outDir, 'tray.ico'), ico([16, 24, 32, 48].map((s) => boxScale(traySource, s))))
writeFileSync(join(outDir, 'tray.png'), PNG.sync.write(boxScale(traySource, 32)))

console.log('icon.ico, icon.png, tray.ico, tray.png escritos em build/')