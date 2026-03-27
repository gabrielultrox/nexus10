# Backend TypeScript migration plan

## Goal

Migrate the backend incrementally without blocking delivery or forcing a full rewrite.

## Phase 1

- add dedicated backend TypeScript config
- move the backend entrypoint to TypeScript
- create core domain types:
  - auth context
  - merchant
  - order
- type one production route end to end
- keep the rest of the backend in JavaScript through `allowJs`

## Phase 2

- convert shared infrastructure modules:
  - `middleware/requireAuth`
  - `middleware/validateRequest`
  - `logging/logger`
  - `config/env`
- add stricter request/response types per module
- add backend-only `type-check` to CI

## Phase 3

- convert `orders`, `sales`, `finance`, `stock`
- replace untyped repository payloads with domain interfaces
- remove `allowJs` from converted folders

## Phase 4

- convert integrations (`ifood`, assistant, admin)
- add runtime-safe DTO mapping layers
- make `strict` errors blocking in CI

## Exit criteria

- backend compiles from TypeScript sources into `dist-backend`
- `ts-node` is only used in local dev
- runtime code stops importing `.js` sources from non-converted backend modules
- `allowJs` can be removed
