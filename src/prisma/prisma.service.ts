import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

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
      return;
    }

    await this.ensureDemoSeedIfMissing();
  }

  /**
   * Jika admin demo belum ada di DB yang dipakai runtime (sering terjadi di
   * PaaS yang mengabaikan Docker entrypoint / RUN_DB_SEED), jalankan seed.
   */
  private async ensureDemoSeedIfMissing(): Promise<void> {
    try {
      const admin = await this.user.findUnique({
        where: { email: 'admin@demo.local' },
        select: { id: true },
      });
      if (admin) {
        return;
      }

      this.logger.warn(
        'Demo admin missing — running `npx prisma db seed` once…',
      );
      execSync('npx prisma db seed', {
        stdio: 'inherit',
        env: process.env,
      });
      this.logger.log('Demo seed finished');
    } catch (error) {
      this.logger.error(
        `Demo seed skipped/failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
