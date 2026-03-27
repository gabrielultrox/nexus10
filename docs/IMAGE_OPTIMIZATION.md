# Image Optimization

## Objetivo

Padronizar imagens do frontend para:

- priorizar `SVG` em icones e marcas vetoriais
- gerar variantes `AVIF` e `WebP` para imagens raster
- servir tamanhos responsivos via `srcset`
- evitar carregamento eager de imagens fora da viewport

## O que foi implementado

### Build step

- script de otimizacao em [scripts/optimize-images.mjs](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\scripts\optimize-images.mjs)
- hook de build em [vite.config.js](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\vite.config.js)
- geracao automatica de:
  - `AVIF`
  - `WebP`
  - fallback no formato original
  - multiplos tamanhos por imagem

Os artefatos gerados ficam em `public/optimized/` e o manifesto em `src/generated/image-manifest.json`.

### Runtime

- `ResponsiveImage` em [src/components/ui/ResponsiveImage.tsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\components\ui\ResponsiveImage.tsx)
- blur-up placeholder com transicao curta
- `loading="lazy"` por default
- `decoding="async"` por default

### Exemplo integrado

O preview de arquivos agora usa a camada de carregamento progressivo em:

- [src/components/ui/form/FileInput.tsx](C:\Users\User\Downloads\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\nexus10-seguro-copia-2026-03-09_2036\src\components\ui\form\FileInput.tsx)

## Como otimizar manualmente

```bash
npm run optimize:images
```

Esse comando:

- varre `public/**/*.png|jpg|jpeg`
- gera variantes responsivas
- avisa se a maior variante final passar de `100 KB`

## Exemplo de `<picture>` responsivo

Depois de rodar a otimizacao para `public/brand-bolt-red-512.png`, o markup recomendado fica assim:

```jsx
<picture className="hero-brand-mark">
  <source
    type="image/avif"
    srcSet="/optimized/brand-bolt-red-512-w192.avif 192w, /optimized/brand-bolt-red-512-w512.avif 512w"
    sizes="(max-width: 768px) 96px, 192px"
  />
  <source
    type="image/webp"
    srcSet="/optimized/brand-bolt-red-512-w192.webp 192w, /optimized/brand-bolt-red-512-w512.webp 512w"
    sizes="(max-width: 768px) 96px, 192px"
  />
  <img
    src="/optimized/brand-bolt-red-512-w512.png"
    srcSet="/optimized/brand-bolt-red-512-w192.png 192w, /optimized/brand-bolt-red-512-w512.png 512w"
    sizes="(max-width: 768px) 96px, 192px"
    alt="Marca Nexus"
    loading="lazy"
    decoding="async"
    width="192"
    height="192"
  />
</picture>
```

## Regra de uso por tipo

### Use `SVG`

- logos
- icones
- marcas simples
- ilutracoes vetoriais

### Use `AVIF/WebP` com fallback

- fotos
- screenshots
- banners raster
- thumbnails

## Como adicionar imagem corretamente

1. Se for icone ou logo, salve em `SVG` dentro de `public/`.
2. Se for raster, coloque o original em `public/`.
3. Rode `npm run optimize:images`.
4. Use `ResponsiveImage` ou `<picture>` com `AVIF` -> `WebP` -> fallback.
5. Defina `width`, `height` e `sizes`.
6. Use `loading="lazy"` fora do first viewport.

## Meta operacional

- nenhuma variante final principal acima de `100 KB`
- preferir `SVG` sempre que a imagem nao exigir raster
- priorizar `AVIF` e `WebP` no delivery

## Limite atual do projeto

Hoje o app quase nao usa imagens raster no runtime. O maior ganho desta rodada foi estrutural:

- pipeline pronto
- componente pronto
- guideline unica

O proximo ganho real aparece quando telas futuras passarem a usar banners, thumbnails, avatars ou prints operacionais.
