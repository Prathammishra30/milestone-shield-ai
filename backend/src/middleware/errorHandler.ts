import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';

/** Structured API error with HTTP status code */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** Express error-handling middleware */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: err.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Known operational errors
  if (err instanceof AppError) {
    // Log full details server-side (stack trace, message) for debugging
    console.error('Operational error:', err.message, err.stack);

    // In production, return a generic message to clients to avoid leaking
    // configuration, internal paths, or stack details.
    const clientMessage =
      env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

    res.status(err.statusCode).json({
      status: 'error',
      message: clientMessage,
    });
    return;
  }

  // Unexpected errors
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
}
