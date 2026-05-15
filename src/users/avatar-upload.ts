import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';

const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function avatarFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void {
  const mime = (file.mimetype || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    cb(
      new BadRequestException(
        'Foto profil harus berupa gambar JPEG, PNG, atau WebP.',
      ),
      false,
    );
    return;
  }
  cb(null, true);
}

export function avatarDiskStorage() {
  const dir = join(process.cwd(), 'uploads', 'avatars');
  return diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const mime = (file.mimetype || '').toLowerCase();
      const ext = EXT_BY_MIME[mime] ?? '.bin';
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}

export const avatarUploadLimits = { fileSize: MAX_BYTES };
