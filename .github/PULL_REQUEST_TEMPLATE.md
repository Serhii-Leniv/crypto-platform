## Summary

<!-- 2-3 sentences describing what this PR does and why -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring (no functional change)
- [ ] Performance improvement
- [ ] Documentation update
- [ ] Infrastructure / DevOps

## Affected Services

- [ ] auth
- [ ] gateway
- [ ] order-matching
- [ ] wallet
- [ ] market-data
- [ ] frontend
- [ ] Docker Compose

## Testing

- [ ] All existing tests pass (`mvn -B clean verify`)
- [ ] New unit tests added for new logic
- [ ] Manually tested with `docker compose up --build`

## API Changes

<!-- If you changed any REST API contract, list it here -->

| Method | Path | Change |
|--------|------|--------|
| | | |

## Checklist

- [ ] Code follows the project's naming conventions (see `CLAUDE.md`)
- [ ] Swagger annotations updated if endpoints changed
- [ ] Flyway migration added if schema changed
- [ ] Environment variable changes reflected in `.env.example` and `docker-compose.yml`
- [ ] `README.md` updated if architecture, setup steps, or management UIs changed
