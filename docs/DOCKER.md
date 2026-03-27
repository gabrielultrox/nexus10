# Docker

Arquivos principais:

- `Dockerfile.frontend`
- `Dockerfile.backend`
- `docker-compose.yml`
- `nginx.conf`
- `Dockerfile.frontend.dockerignore`
- `Dockerfile.backend.dockerignore`
- `.env.docker.example`

## Stack

O compose sobe:

- frontend em `http://localhost:3000`
- backend em `http://localhost:3001`
- Redis em `localhost:6379`
- Firebase Emulator UI em `http://localhost:4000`
- Firestore emulator em `localhost:8080`

O frontend usa `nginx` e faz proxy de:

- `/api/*` -> backend
- `/api-docs` -> backend
- `/api-docs.json` -> backend

Tambem usa fallback SPA com `try_files ... /index.html`.

## Rodando localmente

### Passo 1

Copie o arquivo de ambiente:

```bash
cp .env.docker.example .env.docker
```

No Windows PowerShell:

```powershell
Copy-Item .env.docker.example .env.docker
```

### Passo 2

Suba a stack:

```bash
docker compose --env-file .env.docker up --build
```

Se quiser usar apenas defaults do compose:

```bash
docker compose up --build
```

### Passo 3

Teste:

```bash
curl http://localhost:3000
curl http://localhost:3001/api/health -H "x-forwarded-proto: https"
```

## Build manual

### Frontend

```bash
docker build -f Dockerfile.frontend -t nexus10/frontend:local .
```

### Backend

```bash
docker build -f Dockerfile.backend -t nexus10/backend:local .
```

## Push para registry

Exemplo com Docker Hub:

```bash
docker login
docker tag nexus10/frontend:local seu-usuario/nexus10-frontend:latest
docker tag nexus10/backend:local seu-usuario/nexus10-backend:latest
docker push seu-usuario/nexus10-frontend:latest
docker push seu-usuario/nexus10-backend:latest
```

Exemplo com GHCR:

```bash
docker login ghcr.io
docker tag nexus10/frontend:local ghcr.io/seu-usuario/nexus10-frontend:latest
docker tag nexus10/backend:local ghcr.io/seu-usuario/nexus10-backend:latest
docker push ghcr.io/seu-usuario/nexus10-frontend:latest
docker push ghcr.io/seu-usuario/nexus10-backend:latest
```

## Observacoes

- o backend runtime usa `node:18-alpine`
- o frontend runtime usa `nginx:alpine`
- o backend expõe health check interno em `/api/health`
- o health check do container backend envia `x-forwarded-proto: https` porque o app exige HTTPS em producao
- a stack local foi desenhada para desenvolvimento com Redis e Firebase Emulator

## Limites conhecidos

- eu nao validei `docker compose up` neste ambiente porque o Docker CLI/daemon pode nao estar disponivel aqui
- a configuracao foi preparada para esse fluxo e o compose foi escrito para rodar com `docker compose up --build`
