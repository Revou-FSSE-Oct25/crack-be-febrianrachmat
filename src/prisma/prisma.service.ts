import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import { compare, hash } from 'bcryptjs';

const DEMO_USERS: ReadonlyArray<{
  email: string;
  fullName: string;
  role: UserRole;
}> = [
  {
    email: 'admin@demo.local',
    fullName: 'Demo Admin',
    role: UserRole.ADMIN,
  },
  {
    email: 'patient1@demo.local',
    fullName: 'Demo Patient One',
    role: UserRole.PATIENT,
  },
  {
    email: 'patient2@demo.local',
    fullName: 'Demo Patient Two',
    role: UserRole.PATIENT,
  },
  {
    email: 'physio1@demo.local',
    fullName: 'Demo Physio One',
    role: UserRole.PHYSIOTHERAPIST,
  },
  {
    email: 'physio2@demo.local',
    fullName: 'Demo Physio Two',
    role: UserRole.PHYSIOTHERAPIST,
  },
  {
    email: 'physio3@demo.local',
    fullName: 'Demo Physio Three',
    role: UserRole.PHYSIOTHERAPIST,
  },
];

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

    await this.ensureDemoLoginCredentials();
  }

  /**
   * Pastikan akun demo bisa login di DB runtime apa pun (Neon / PaaS Postgres).
   * Jika admin belum ada ATAU password demo tidak cocok → upsert ulang hash.
   */
  private async ensureDemoLoginCredentials(): Promise<void> {
    const plain = process.env.SEED_DEFAULT_PASSWORD ?? 'password123';

    try {
      const admin = await this.user.findUnique({
        where: { email: 'admin@demo.local' },
        select: { id: true, passwordHash: true },
      });

      const passwordOk =
        !!admin?.passwordHash && (await compare(plain, admin.passwordHash));

      if (admin && passwordOk) {
        return;
      }

      this.logger.warn(
        admin
          ? 'Demo admin password mismatch — resetting demo login credentials…'
          : 'Demo admin missing — upserting demo login credentials…',
      );

      const passwordHash = await hash(plain, 10);
      for (const demo of DEMO_USERS) {
        await this.user.upsert({
          where: { email: demo.email },
          create: {
            email: demo.email,
            fullName: demo.fullName,
            role: demo.role,
            passwordHash,
            isActive: true,
          },
          update: {
            fullName: demo.fullName,
            role: demo.role,
            passwordHash,
            isActive: true,
          },
        });
      }

      this.logger.log(
        `Demo login credentials ready (password = SEED_DEFAULT_PASSWORD or "password123")`,
      );
    } catch (error) {
      this.logger.error(
        `Demo credential ensure failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
