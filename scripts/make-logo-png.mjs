import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync('public/logo.svg')
// Render the transparent logo at high res
for (const size of [512, 1024]) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' })
  const png = Buffer.from(r.render().asPng())
  writeFileSync(`C:/Users/birk/Desktop/leventia-logo-${size}.png`, png)
  console.log(`wrote leventia-logo-${size}.png (${png.length} bytes)`)
}