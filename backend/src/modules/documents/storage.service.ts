import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

// Local-disk file storage for the Documents & Certificates module.
//
// Files are never served statically - every read goes through an
// authenticated controller endpoint that streams the file after a
// role/ownership check (see DocumentsController#download). fileKey values
// stored in the DB are relative paths under `root`, never absolute -
// resolve() is the only place that turns them back into a real path, which
// keeps callers from accidentally writing an absolute/attacker-controlled
// path straight to disk (path traversal).
//
// UPLOADS_DIR should point at a persistent volume in production. On a
// Hostinger VPS the local filesystem already survives restarts/redeploys,
// so the default (`<project>/uploads`) is fine as long as it's included in
// your backup routine - see README for details.
@Injectable()
export class StorageService {
  readonly root = process.env.UPLOADS_DIR
    ? join(process.env.UPLOADS_DIR)
    : join(process.cwd(), 'uploads');

  constructor() {
    this.ensureDir(this.root);
  }

  ensureDir(absoluteDir: string) {
    if (!existsSync(absoluteDir)) mkdirSync(absoluteDir, { recursive: true });
  }

  // Turns a stored relative fileKey (e.g. "documents/<schoolId>/<uuid>.pdf")
  // into an absolute path. Strips any ".." segments so a malformed/tampered
  // fileKey can never escape the uploads root.
  resolve(fileKey: string): string {
    const safeKey = fileKey
      .split(/[/\\]/)
      .filter((segment) => segment && segment !== '..')
      .join('/');
    return join(this.root, safeKey);
  }

  remove(fileKey: string) {
    const path = this.resolve(fileKey);
    if (existsSync(path)) unlinkSync(path);
  }
}
