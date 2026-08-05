import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Public, unauthenticated storage for school logos - deliberately separate
// from documents/storage.service.ts (which is private, auth-gated). A logo
// has to render in the Sidebar/login screen via a plain <img src>, so it
// lives under its own root that main.ts serves as static files at
// `/branding`. Never put anything sensitive in here.
@Injectable()
export class LogoStorageService {
  readonly root = process.env.UPLOADS_DIR
    ? join(process.env.UPLOADS_DIR, 'logos')
    : join(process.cwd(), 'uploads', 'logos');

  constructor() {
    if (!existsSync(this.root)) mkdirSync(this.root, { recursive: true });
  }

  resolve(filename: string): string {
    // Strip any path segments - filenames here are always server-generated
    // (schoolId + extension), never taken verbatim from user input.
    const safeName = filename.split(/[/\\]/).pop()!;
    return join(this.root, safeName);
  }

  publicPath(filename: string): string {
    return `/branding/${filename}`;
  }
}
