import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const ALLOWED = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.json',
  '.ico',
]);

export default function serveStatic(baseDir: string) {
  const root = path.resolve(baseDir);
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    const safe = path.normalize(req.path).replace(/^(\.\.[/\\])+/, '');
    const full = path.resolve(root, '.' + safe);
    if (!full.startsWith(root)) return next();
    const ext = path.extname(full).toLowerCase();
    if (!ALLOWED.has(ext)) return next();
    fs.access(full, fs.constants.F_OK, (err) => {
      if (err) return next();
      res.sendFile(full, (e) => {
        if (e) next(e);
      });
    });
  };
}
