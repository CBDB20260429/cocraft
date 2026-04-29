# Neon Setup

## Project

- Neon project: `cocraft`
- Project ID: `plain-bird-65419567`
- Console: https://console.neon.tech/app/projects/plain-bird-65419567
- Default branch: `main`
- Default database: `neondb`

## Local Environment

Create a local `.env` file from `.env.example` and set the real values:

```sh
cp .env.example .env
```

Required values:

- `DATABASE_URL`: Neon PostgreSQL connection string for local development.
- `NEON_PROJECT_ID`: Neon project ID. This is not secret.
- `OPENAI_API_KEY`: OpenAI API key for model access.

Do not commit `.env`; it is ignored by git.

## GitHub Actions

Add the following GitHub repository secret:

- `NEON_API_KEY`: Neon API key.

Add the following GitHub repository variable:

- `NEON_PROJECT_ID`: `plain-bird-65419567`

In GitHub, these live under:

`Settings -> Secrets and variables -> Actions`

The workflow at `.github/workflows/neon_workflow.yml` uses `NEON_API_KEY` and `NEON_PROJECT_ID` to create a short-lived Neon branch for CI validation.
