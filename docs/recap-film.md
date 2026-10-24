# Primeiro corte: Uma história que fica

Abrir `/luisferreira/recap/filme`. O recap anterior continua em `/luisferreira/recap`.

90 segundos, 30 fps. O player escolhe 1920×1080 ou 1080×1920 pela orientação da janela.
Os capítulos usam o snapshot mensal existente; a comunidade de demonstração é identificada no player.
Esta primeira narrativa é sobre a comunidade, porque os dados disponíveis são agregados por comunidade.
As imagens de clips são animadas; não são reproduções dos vídeos originais.

A composição é determinística por frame e é partilhada pelo player e pelo exportador Remotion.
Os controlos permitem pausa, procura, volume e ecrã inteiro. Os capítulos permitem rever partes.
A faixa instrumental original é sintetizada por `node scripts/generate-recap-score.cjs`.

Exportar o template com os dados fictícios de `demoFilm`:

```
npx remotion render src/remotion/index.tsx RecapHorizontal out/recap-horizontal.mp4
npx remotion render src/remotion/index.tsx RecapVertical out/recap-vertical.mp4
```

Para exportar dados reais, fornecer `--props=ficheiro.json` com `{ "data": { ... }, "sound": true }`,
seguindo o tipo FilmData. Não há ainda botão de exportação nem serviço de renderização na aplicação.
