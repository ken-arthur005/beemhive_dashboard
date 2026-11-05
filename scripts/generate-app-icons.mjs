// Reproducible favicon assets derived from the supplied artwork, not a replacement illustration.
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const source = await readFile(new URL('../public/logo.png', import.meta.url))
// Keep the bee and NFC waves, omit the wordmark that is illegible at tab size.
const bee = await sharp(source).extract({ left: 0, top: 0, width: 270, height: 266 }).png().toBuffer()
const icon = size => sharp(bee).resize(size, size, { fit: 'contain', background: '#fffaf0' }).png().toBuffer()
await writeFile(new URL('../src/app/icon.png', import.meta.url), await icon(192))
await writeFile(new URL('../src/app/apple-icon.png', import.meta.url), await icon(180))

// ICO supports embedded PNG images, preserving transparency at each browser-tab size.
const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map(icon))
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
images.forEach((image, i) => {
  const entry = 6 + 16 * i
  header[entry] = sizes[i]
  header[entry + 1] = sizes[i]
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(image.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += image.length
})
await writeFile(new URL('../src/app/favicon.ico', import.meta.url), Buffer.concat([header, ...images]))
