import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg  = readFileSync(join(root, 'public', 'icon-source.svg'))

// ── Render PNGs at all required sizes ────────────────────────────────────────

// Windows .ico sizes
const icoSizes = [256, 128, 64, 48, 32, 16]
const icoBuffers = icoSizes.map(size => {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  return Buffer.from(r.render().asPng())
})

// macOS .icns sizes (requires more sizes for retina displays)
const icnsSizes = [16, 32, 64, 128, 256, 512, 1024]
const icnsBuffers = icnsSizes.map(size => {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  return { size, buffer: Buffer.from(r.render().asPng()) }
})

// ── Write Windows .ico ───────────────────────────────────────────────────────

const ico = await pngToIco(icoBuffers)
mkdirSync(join(root, 'public'), { recursive: true })
writeFileSync(join(root, 'public', 'icon.ico'), ico)

// Also write a 256x256 PNG (handy for some packagers / the dev window icon)
writeFileSync(join(root, 'public', 'icon.png'), icoBuffers[0])

console.log('✓ Wrote public/icon.ico (' + ico.length + ' bytes) and public/icon.png')

// ── Write macOS .icns ────────────────────────────────────────────────────────

// For now, we'll create a basic .icns structure
// Note: A proper .icns requires a specific binary format with headers
// This is a simplified version that works with electron-builder

try {
  // Create iconset directory structure for macOS
  const iconsetDir = join(root, 'public', 'icon.iconset')
  mkdirSync(iconsetDir, { recursive: true })

  // Write icon files for iconset (standard naming convention)
  const iconsetFiles = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_512x512.png', size: 512 },
    // Retina versions
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ]

  for (const { name, size } of iconsetFiles) {
    const { buffer } = icnsBuffers.find(b => b.size === size) || icnsBuffers[0]
    writeFileSync(join(iconsetDir, name), buffer)
  }

  // Try to use iconutil if on macOS, otherwise create a placeholder
  if (process.platform === 'darwin') {
    const { execSync } = await import('node:child_process')
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${join(root, 'public', 'icon.icns')}"`, { stdio: 'inherit' })
      console.log('✓ Wrote public/icon.icns using iconutil')
    } catch (e) {
      console.log('⚠ iconutil failed, you may need to create .icns manually')
    }
  } else {
    console.log('⚠ Not on macOS - iconset created but .icns needs iconutil (run this script on a Mac)')
  }
} catch (e) {
  console.log('⚠ Could not create .icns:', e?.message ?? e)
}
