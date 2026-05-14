import { ConsultationSlaTier } from '@prisma/client';

export function consultationSlaWindowMinutes(
  tier: ConsultationSlaTier,
  fastMinutes: number,
  standardMinutes: number,
): number {
  return tier === ConsultationSlaTier.FAST_ONLINE ? fastMinutes : standardMinutes;
}

export function consultationSlaDeadline(
  startedAt: Date,
  tier: ConsultationSlaTier,
  fastMinutes: number,
  standardMinutes: number,
): Date {
  const m = consultationSlaWindowMinutes(tier, fastMinutes, standardMinutes);
  return new Date(startedAt.getTime() + m * 60_000);
}
