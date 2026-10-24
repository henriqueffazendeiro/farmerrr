const { chromium } = require('playwright')
const { pathToFileURL } = require('node:url')
const path = require('node:path')

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
    await page.goto(pathToFileURL(path.resolve('public/brand/wordmark.html')).href)
    await page.locator('img').evaluate(img => img.decode())
    await page.screenshot({ path: 'public/brand/farmerrr-wordmark-preview.png' })
    await page.addStyleTag({ content: 'html,body{background:transparent}main{min-height:0;padding:0;display:block}img{width:2200px;max-width:none}' })
    await page.setViewportSize({ width: 2200, height: 500 })
    await page.locator('img').screenshot({ path: 'public/brand/farmerrr-wordmark-transparent.png', omitBackground: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    const bounds = await page.locator('img').boundingBox()
    if (!bounds || bounds.x < 0 || bounds.x + bounds.width > 390) throw new Error('Mobile preview overflows')
    console.log('Exported large preview and transparent PNG; mobile preview fits.')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exit(1) })
