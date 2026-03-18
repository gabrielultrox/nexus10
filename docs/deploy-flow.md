# Deploy Flow

## Canonical Flow

O fluxo canonico de producao do NEXUS-10 e:

1. validar localmente com `npm run lint` e `npm run build`
2. fazer `git push origin main`
3. deixar a Vercel publicar automaticamente a partir do GitHub

URL principal de producao:

- [https://nexus10-seguro-copia-2026-03-092036.vercel.app](https://nexus10-seguro-copia-2026-03-092036.vercel.app)

## Quando usar deploy manual

Deploy manual deve ser usado so em dois casos:

- preview pontual antes de subir no `main`
- emergencia quando o auto deploy precisar ser contornado

Comandos:

```bash
npm run deploy:preview
npm run deploy:prod:manual
```

## Como confirmar se o auto deploy funcionou

No log da Vercel, o deploy automatico precisa mostrar algo neste formato:

```text
Cloning github.com/gabrielultrox/nexus10 (Branch: main, Commit: <sha>)
```

Se aparecer upload direto de arquivos locais, foi deploy manual via CLI.

## Regra operacional

- preferir `push no main`
- evitar `vercel --prod` como fluxo padrao
- usar preview manual para revisar UI ou emergencia de publicacao
