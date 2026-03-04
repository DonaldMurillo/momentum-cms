import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
	@Get()
	check(): { status: string; ready: boolean; timestamp: string } {
		return {
			status: 'ok',
			ready: true,
			timestamp: new Date().toISOString(),
		};
	}
}
