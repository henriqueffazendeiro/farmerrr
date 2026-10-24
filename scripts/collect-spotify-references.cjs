const fs = require('node:fs/promises')
const path = require('node:path')
const source = 'https://engineering.atspotify.com/2024/1/exploring-the-animation-landscape-of-2023-wrapped'
const dir = path.resolve('public/references/spotify-wrapped')
const labels = ['2020 · Caleidoscópio', '2021 · Fitas', '2022 · Formas', '2023 · Abertura', '2021 · Audio Aura', '2023 · Sound Town', '2023 · Introdução dos cartões', '2023 · Revelação do cartão', '2023 · Introdução dos géneros', '2023 · Géneros em camadas']
;(async () => {
  await fs.mkdir(dir, { recursive: true })
  const response = await fetch(source)
  if (!response.ok) throw Error(`Article: ${response.status}`)
  const html = await response.text()
  const items = [...html.matchAll(/<img[^>]+>/g)].map(m => m[0]).filter(t => t.includes('.gif')).map((t, i) => ({
    title: labels[i] || t.match(/alt="([^"]*)"/)?.[1],
    url: 'https:' + t.match(/src="([^"]*)"/)?.[1], file: `original-${i}.gif`,
  }))
  if (items.length !== 10) throw Error('Unexpected source structure; review labels')
  await Promise.all(items.map(async item => {
    const res = await fetch(item.url, { signal: AbortSignal.timeout(30000) })
    if (!res.ok || !res.headers.get('content-type')?.includes('image/gif')) throw Error(`Asset: ${item.url}`)
    const bytes = Buffer.from(await res.arrayBuffer())
    if (!bytes.subarray(0, 6).toString().startsWith('GIF8')) throw Error('Invalid GIF')
    await fs.writeFile(path.join(dir, item.file), bytes)
  }))
  await fs.writeFile(path.join(dir, 'sources.json'), JSON.stringify({ source, note: 'Original Spotify-published GIF demonstrations. Not the interactive personalized experience.', items }, null, 2))
  await fs.copyFile('files/spotify-wrapped-2023-original/stories.readable.js', path.join(dir, 'stories-code.txt'))
  const page = `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spotify Wrapped · Animações originais</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#101010;color:#f5f5f5;font:15px system-ui,sans-serif}header{padding:24px 32px;border-bottom:1px solid #333;display:flex;justify-content:space-between;gap:24px;align-items:center}h1{font-size:23px;letter-spacing:-.6px;margin:6px 0}p{color:#aaa;line-height:1.5;margin:8px 0}small{color:#1ed760;letter-spacing:2px}a{color:inherit}header a{white-space:nowrap}.layout{display:grid;grid-template-columns:280px 1fr;min-height:calc(100dvh - 145px)}nav{padding:24px 16px;border-right:1px solid #333;display:flex;flex-direction:column;gap:5px}button{font:inherit;cursor:pointer;color:inherit;border:1px solid transparent;background:transparent;padding:12px 14px;border-radius:8px;text-align:left}button:hover{background:#252525}button[aria-current=true]{background:#1ed760;color:#101010;font-weight:650}button:focus-visible,a:focus-visible{outline:2px solid white;outline-offset:3px}article{padding:20px 30px;min-width:0}.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1050px;margin:auto}.bar h2{font-size:18px}.bar button{border-color:#444}.screen{background:#080808;display:grid;place-items:center;height:min(65dvh,760px);max-width:1050px;margin:10px auto 16px;border:1px solid #292929;border-radius:10px;overflow:hidden}.screen:fullscreen{height:100%;max-width:none;border:0;border-radius:0}.screen img{display:block;max-width:100%;max-height:100%;width:100%;height:100%;min-height:0;object-fit:contain}.caption{max-width:1050px;margin:auto;font-size:13px}.caption a{margin-right:20px;color:#ddd}#status{color:#fbbf24} @media(max-width:760px){header{padding:18px;display:block}header a{display:inline-block;margin-top:10px}.layout{display:block}nav{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid #333;padding:12px}nav button{flex-shrink:0;font-size:13px}article{padding:14px}.screen{height:60dvh}.bar h2{font-size:15px}.bar button{font-size:12px}}
</style></head><body>
<header><div><small>ARQUIVO VISUAL / SPOTIFY</small><h1>As animações originais do Wrapped.</h1><p>Demonstrações em GIF publicadas pelo Spotify. Sem login e sem dados pessoais.</p></div><a href="stories-code.txt" target="_blank" rel="noopener">Ver código original de 2023 ↗</a></header>
<div class="layout"><nav aria-label="Escolher animação">${items.map((x, i) => `<button data-index="${i}" aria-current="${i === 3}">${x.title}</button>`).join('')}</nav>
<article><div class="bar"><h2 id="title">${items[3].title}</h2><button id="fullscreen">Ecrã inteiro ⛶</button></div>
<div class="screen" id="screen"><img id="animation" src="${items[3].file}" alt="${items[3].title}"></div>
<div class="caption"><p>Estas são gravações animadas da experiência original, não uma recuperação das histórias interativas. Os GIFs repetem automaticamente e não têm som.</p><p><a id="original" href="${items[3].url}" target="_blank" rel="noopener">Abrir ficheiro original ↗</a><a href="${source}" target="_blank" rel="noopener">Fonte: Spotify Engineering ↗</a></p><p id="status" role="status"></p></div></article></div>
<script>
const items=${JSON.stringify(items).replace(/</g, '\\u003c')};
const picture=document.getElementById('animation');
document.querySelectorAll('[data-index]').forEach(button=>button.addEventListener('click',()=>{
  const item=items[Number(button.dataset.index)];
  document.querySelectorAll('[data-index]').forEach(b=>b.setAttribute('aria-current',String(b===button)));
  picture.src=item.file;picture.alt=item.title;
  document.getElementById('title').textContent=item.title;
  document.getElementById('original').href=item.url;
  document.getElementById('status').textContent='';
}));
picture.addEventListener('error',()=>document.getElementById('status').textContent='Não foi possível carregar esta animação. Usa o link para o ficheiro original.');
document.getElementById('fullscreen').addEventListener('click',async()=>{try{await document.getElementById('screen').requestFullscreen()}catch{document.getElementById('status').textContent='Neste navegador, abre o ficheiro original para o veres ampliado.'}});
</script></body></html>`
  await fs.writeFile(path.join(dir, 'index.html'), page)
  console.log(`Saved ${items.length} original GIFs and viewer at /references/spotify-wrapped/index.html`)
})().catch(error => { console.error(error); process.exitCode = 1 })
