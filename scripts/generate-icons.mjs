import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'

const svg = readFileSync('public/icon.svg')

mkdirSync('public/icons', { recursive: true })

for (const size of [16, 48, 128]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/icon${size}.png`)
  console.log(`Generated icon${size}.png`)
}
