# create-momentum-app

Scaffold a new Momentum CMS application with a single command.

## Usage

```bash
npx create-momentum-app
```

### Non-interactive

```bash
npx create-momentum-app my-app --flavor angular --database postgres
```

## Options

| Flag           | Description            | Default    |
| -------------- | ---------------------- | ---------- |
| `--flavor`     | `angular` or `analog`  | (prompted) |
| `--database`   | `postgres` or `sqlite` | (prompted) |
| `--no-install` | Skip `npm install`     | false      |

## What you get

- A fully configured Momentum CMS project
- Angular SSR with Express or Analog with Nitro
- Admin dashboard UI at `/admin`
- REST API at `/api`
- Authentication via Better Auth
- Drizzle ORM with PostgreSQL or SQLite
- Tailwind CSS with the Momentum admin theme
