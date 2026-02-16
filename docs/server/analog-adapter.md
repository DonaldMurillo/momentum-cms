# Analog Adapter

Integrate Momentum CMS with Analog.js (Nitro/h3).

## Package

```bash
npm install @momentumcms/server-analog
```

## Setup

Analog uses file-based routing for the server. Three files are involved:

### Server Initialization (`server/utils/momentum-init.ts`)

```typescript
import { initializeMomentum } from '@momentumcms/server-analog';
import momentumConfig from '../../momentum.config';

let momentum: Awaited<ReturnType<typeof initializeMomentum>>;

export async function getMomentum() {
	if (!momentum) {
		momentum = await initializeMomentum(momentumConfig);
	}
	return momentum;
}
```

### Middleware (`server/middleware/00-init.ts`)

```typescript
import { getMomentum } from '../utils/momentum-init';

export default defineEventHandler(async (event) => {
	await getMomentum(); // Ensure initialized
});
```

### API Catch-All (`server/routes/api/[...]momentum].ts`)

```typescript
import { createMomentumHandler } from '@momentumcms/server-analog';
import { getMomentum } from '../../utils/momentum-init';

export default defineEventHandler(async (event) => {
	const momentum = await getMomentum();
	return createMomentumHandler(momentum)(event);
});
```

## How It Works

1. The middleware ensures Momentum is initialized on first request
2. The catch-all route handler delegates API requests to Momentum
3. Analog/Nitro handles file-based routing for everything else
4. h3 event handlers are used instead of Express middleware

## File-Based Routing

Analog routes API endpoints based on file names:

- `server/routes/api/[...]momentum].ts` — Catch-all for Momentum API
- Additional custom routes can coexist alongside Momentum

## Related

- [Overview](overview.md) — Server architecture
- [Express Adapter](express-adapter.md) — Alternative adapter
