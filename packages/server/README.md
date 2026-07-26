# `@probe/server`

The server package owns Probe's backend application layers:

```text
tRPC routers -> services -> repositories -> @probe/db
```

- Routers validate shared API schemas and call services from the request context.
- Services own orchestration, transactions, and cross-feature workflows.
- Repositories own persistence queries and database mapping.
- `src/composition/index.ts` is the single composition root for concrete dependencies.
- `apps/api` only configures Hono, middleware, runtime health, and process startup.

Repository dependencies are inferred from their concrete factory return types. Tests can
therefore pass structurally compatible fakes without maintaining duplicate interfaces.
