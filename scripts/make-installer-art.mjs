import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

// Generates the NSIS installer art (BMP) electron-builder uses:
//   build/installerSidebar.bmp  164×314  — big panel on the welcome/finish pages
//   build/installerHeader.bmp   150×57   — strip at the top of the inner pages
// Branded with the Leventia logo + wordmark to replace the plain default wizard.

const FONT = { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' }

// Logo (transparent) as a data URI so we can place it inside the composite SVGs.
function logoDataUri(px) {
  const svg = readFileSync('public/logo.svg')
  const png = Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: px }, background: 'rgba(0,0,0,0)', font: FONT }).render().asPng())
  return 'data:image/png;base64,' + png.toString('base64')
}

// RGBA (top-down, from resvg) → 24-bit BMP (bottom-up, BGR, 4-byte row padding),
// compositing any alpha over the given background colour.
function rgbaToBmp(pixels, width, height, bg = [10, 7, 22]) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4
  const imgSize = rowSize * height
  const buf = Buffer.alloc(54 + imgSize)
  buf.write('BM', 0)
  buf.writeUInt32LE(54 + imgSize, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(imgSize, 34)
  buf.writeInt32LE(2835, 38)
  buf.writeInt32LE(2835, 42)
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y
    let dst = 54 + y * rowSize
    for (let x = 0; x < width; x++) {
      const s = (srcY * width + x) * 4
      const a = pixels[s + 3] / 255
      buf[dst++] = Math.round(pixels[s + 2] * a + bg[2] * (1 - a)) // B
      buf[dst++] = Math.round(pixels[s + 1] * a + bg[1] * (1 - a)) // G
      buf[dst++] = Math.round(pixels[s + 0] * a + bg[0] * (1 - a)) // R
    }
  }
  return buf
}

function svgToBmp(svg, W, H, bg) {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: W }, background: 'rgba(0,0,0,0)', font: FONT }).render()
  return rgbaToBmp(Buffer.from(img.pixels), img.width, img.height, bg)
}

const sidebar = `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#160c2e"/><stop offset="0.55" stop-color="#0b0718"/><stop offset="1" stop-color="#07070e"/>
    </linearGradient>
    <linearGradient id="txt" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e9d5ff"/><stop offset="0.5" stop-color="#a78bfa"/><stop offset="1" stop-color="#67e8f9"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.30" r="0.55">
      <stop offset="0" stop-color="#7c3aed" stop-opacity="0.5"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="164" height="314" fill="url(#bg)"/>
  <circle cx="82" cy="96" r="78" fill="url(#glow)"/>
  <image x="54" y="56" width="56" height="56" href="${logoDataUri(112)}"/>
  <text x="82" y="156" text-anchor="middle" font-family="Segoe UI" font-size="23" font-weight="700" fill="url(#txt)">Leventia</text>
  <text x="82" y="176" text-anchor="middle" font-family="Segoe UI" font-size="9.5" letter-spacing="5" fill="#9b8bc8">ALTING</text>
  <rect x="34" y="192" width="96" height="1.4" rx="1" fill="#a78bfa" opacity="0.45"/>
  <text x="82" y="298" text-anchor="middle" font-family="Segoe UI" font-size="8" letter-spacing="1" fill="#5f5878">Multi-account manager</text>
</svg>`

const header = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57" viewBox="0 0 150 57">
  <rect width="150" height="57" fill="#ffffff"/>
  <image x="12" y="13" width="31" height="31" href="${logoDataUri(62)}"/>
  <text x="50" y="28" font-family="Segoe UI" font-size="14" font-weight="700" fill="#1a1030">Leventia</text>
  <text x="50" y="43" font-family="Segoe UI" font-size="8" letter-spacing="3.5" fill="#7c3aed">ALTING</text>
</svg>`

mkdirSync('build', { recursive: true })
writeFileSync('build/installerSidebar.bmp', svgToBmp(sidebar, 164, 314, [11, 7, 24]))
writeFileSync('build/installerHeader.bmp', svgToBmp(header, 150, 57, [255, 255, 255]))
console.log('✓ wrote build/installerSidebar.bmp (164×314) + build/installerHeader.bmp (150×57)')
