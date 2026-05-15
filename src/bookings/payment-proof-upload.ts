import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'node:crypto';

const MAX_BYTES = 5 * 1024 * 1024;

export function paymentProofDiskStorage() {
  const dir = join(process.cwd(), 'uploads', 'payment-proofs');
  return diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const raw = extname(file.originalname || '').toLowerCase();
      const safe =
        ['.jpg', '.jpeg', '.png', '.webp'].includes(raw) && raw.length <= 6
          ? raw
          : '.jpg';
      cb(null, `${randomUUID()}${safe}`);
    },
  });
}

export const paymentProofUploadLimits = { fileSize: MAX_BYTES };
