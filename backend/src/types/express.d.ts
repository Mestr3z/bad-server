import 'express';

declare global {
  namespace Express {
    interface User {
      _id: string;
      email?: string;
      roles?: ('customer' | 'admin')[];
    }

    interface Request {
      user?: User;
      slowDown?: {
        limit: number;
        current?: number;
        resetTime?: Date;
      };
      csrfToken?: () => string;
    }
  }
}

export {};
