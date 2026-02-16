# Quick Start

Scaffold a new Momentum CMS project in minutes.

## Prerequisites

- Node.js 18 or later
- npm
- PostgreSQL (if using Postgres) or no extra dependencies for SQLite

## Create a New Project

```bash
npx create-momentum-app my-app
```

The CLI prompts you to choose:

| Option        | Choices                                 |
| ------------- | --------------------------------------- |
| **Framework** | Angular (Express SSR) or Analog (Nitro) |
| **Database**  | PostgreSQL or SQLite                    |

## Start the Dev Server

```bash
cd my-app
cp .env.example .env   # Configure database connection
npm install
npm run dev
```

Open `http://localhost:4200/admin` (Angular) or `http://localhost:4000/admin` (Analog) to access the admin dashboard.

## What You Get

The generated project includes:

- **A sample `posts` collection** with title, content, and status fields
- **Admin dashboard** at `/admin` with CRUD interface
- **REST API** at `/api/posts` for programmatic access
- **Authentication** with email/password login
- **Database** configured with your chosen adapter
- **Tailwind CSS** pre-configured with the Momentum theme

## Project Scripts

| Command         | Description                              |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Start development server with hot reload |
| `npm run build` | Production build                         |
| `npm start`     | Start production server                  |

## Next Steps

- [Project Structure](project-structure.md) — Understand the generated files
- [Your First Collection](your-first-collection.md) — Define a custom collection
- [Fields Reference](../collections/fields.md) — All available field types
