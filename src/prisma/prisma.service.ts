import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    // `$connect()` dibuat non-blocking supaya bootstrap Nest tidak gagal
    // hanya karena DB belum siap (mis. saat baru deploy ke Railway).
    // `/health` controller akan melaporkan status `degraded` selama DB down,
    // sementara koneksi pertama akan terjadi otomatis di query pertama.
    try {
      await this.$connect();
    } catch (error) {
      this.logger.warn(
        `Prisma initial $connect() failed; continuing without blocking bootstrap: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
