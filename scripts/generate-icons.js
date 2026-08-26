// Gera public/icon-192.png e public/icon-512.png (fundo verde + rosto de panda simplificado)
// usando pngjs (pure JS, sem dependencias nativas).
import { PNG } from 'pngjs'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public')
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

const GREEN = [0x5d, 0xd6, 0x2c]
const WHITE = [0xf8, 0xf8, 0xf8]
const DARK = [0x1a, 0x1a, 0x1a]

function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2)
}

function circle(png, cx, cy, r, color, size) {
  const [cr, cg, cb] = color
  const x0 = Math.max(0, Math.floor(cx - r))
  const x1 = Math.min(size - 1, Math.ceil(cx + r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const y1 = Math.min(size - 1, Math.ceil(cy + r))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (dist(x, y, cx, cy) <= r) {
        const idx = (size * y + x) << 2
        png.data[idx] = cr
        png.data[idx + 1] = cg
        png.data[idx + 2] = cb
        png.data[idx + 3] = 255
      }
    }
  }
}

function ellipse(png, cx, cy, rx, ry, color, size) {
  const [cr, cg, cb] = color
  const x0 = Math.max(0, Math.floor(cx - rx))
  const x1 = Math.min(size - 1, Math.ceil(cx + rx))
  const y0 = Math.max(0, Math.floor(cy - ry))
  const y1 = Math.min(size - 1, Math.ceil(cy + ry))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      if (nx * nx + ny * ny <= 1) {
        const idx = (size * y + x) << 2
        png.data[idx] = cr
        png.data[idx + 1] = cg
        png.data[idx + 2] = cb
        png.data[idx + 3] = 255
      }
    }
  }
}

function drawIcon(size) {
  const png = new PNG({ width: size, height: size })

  // fundo verde solido
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      png.data[idx] = GREEN[0]
      png.data[idx + 1] = GREEN[1]
      png.data[idx + 2] = GREEN[2]
      png.data[idx + 3] = 255
    }
  }

  const c = size / 2
  // orelhas
  circle(png, c - size * 0.28, c - size * 0.28, size * 0.14, DARK, size)
  circle(png, c + size * 0.28, c - size * 0.28, size * 0.14, DARK, size)
  // rosto
  ellipse(png, c, c + size * 0.02, size * 0.32, size * 0.28, WHITE, size)
  // manchas dos olhos
  ellipse(png, c - size * 0.14, c - size * 0.02, size * 0.1, size * 0.13, DARK, size)
  ellipse(png, c + size * 0.14, c - size * 0.02, size * 0.1, size * 0.13, DARK, size)
  // olhos
  circle(png, c - size * 0.14, c, size * 0.035, WHITE, size)
  circle(png, c + size * 0.14, c, size * 0.035, WHITE, size)
  // nariz
  ellipse(png, c, c + size * 0.14, size * 0.045, size * 0.03, DARK, size)

  return PNG.sync.write(png)
}

writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192))
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512))
console.log('Icons generated in public/')
