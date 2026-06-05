# Contributing

Solo portfolio project. The workflow is documented in [ADR-0007 — Solo workflow: direct push for trivia, FF-merge for features](docs/decisions/0007-solo-workflow-direct-push.md).

If you spotted a bug or want to flag a design problem, open an issue with a minimal reproduction.

## Local development

```bash
cp .env.example .env       # set JWT_SECRET_KEY (>=32 chars) and POSTGRES_PASSWORD
docker compose up --build
```

The `dev` Spring profile (default) seeds three demo users (`alice@demo.io`, `bob@demo.io`, `charlie@demo.io`, password `Password1`), wallets, trading pairs, and open orders.

For the deeper "how it works" — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
For the "why each pattern was chosen" — [docs/decisions/](docs/decisions/).
