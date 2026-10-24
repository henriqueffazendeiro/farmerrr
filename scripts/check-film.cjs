const { chromium } = require('@playwright/test')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const errors = []
  try {
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } })
      page.on('pageerror', e => errors.push(e.message))
      await page.goto('http://localhost:3000/luisferreira/recap/filme', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Ver filme com som', exact: true }).click()
      await page.waitForTimeout(900)
      assert.ok(await page.locator('audio').count() >= 1)
      for (const chapter of ['Quem guardou', 'O alcance', 'O momento', 'A comunidade', 'O topo', 'O que fica']) {
        await page.getByRole('button', { name: chapter, exact: true }).click()
        await page.waitForTimeout(800)
        const failedImages = await page.locator('img').evaluateAll(imgs => imgs.filter(i => !i.complete || i.naturalWidth === 0).length)
        assert.equal(failedImages, 0, `${name}: images load in ${chapter}`)
      }
      await page.screenshot({ path: `.next/film-${name}-end.png` })
      await page.getByRole('button', { name: 'O momento', exact: true }).click()
      await page.waitForTimeout(1300)
      await page.screenshot({ path: `.next/film-${name}-moment.png` })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      console.log(`${name}: chapters, audio, images and viewport checked`)
      await page.close()
    }
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })

