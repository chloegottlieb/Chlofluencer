import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { HttpError } from './auth.js';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

export function mediaKind(mimetype) {
  if (!EXTENSIONS[mimetype]) return null;
  return mimetype.startsWith('video/') ? 'video' : 'image';
}

export function createUploader(uploadDir) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + EXTENSIONS[file.mimetype]),
  });
  return multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, cb) => {
      if (mediaKind(file.mimetype)) cb(null, true);
      else cb(new HttpError(400, 'Only JPEG, PNG, GIF, WebP images and MP4/WebM/MOV videos are supported'));
    },
  });
}

export function removeUpload(uploadDir, url) {
  if (!url?.startsWith('/uploads/')) return;
  const file = path.join(uploadDir, path.basename(url));
  fs.rm(file, { force: true }, () => {});
}
