import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

type HealthReport = { status: string; database: string };

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Probes read the status code, not the body. Returning 200 while Mongo is
   * down would make this endpoint useless to `depends_on: service_healthy`
   * and to any uptime monitor, so a lost connection must surface as 503.
   */
  @Get()
  check(): HealthReport {
    const connected = this.connection.readyState === ConnectionStates.connected;

    if (!connected) {
      throw new ServiceUnavailableException({
        status: 'ERROR',
        database: 'Disconnected',
      } satisfies HealthReport);
    }

    return { status: 'OK', database: 'Connected' };
  }
}
