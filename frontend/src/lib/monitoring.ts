/**
 * Client-Side Error Monitoring Abstraction
 *
 * SAFETY & PRIVACY RULES:
 * 1. Never transmit authentication tokens, passwords, or PayPal sandbox client secrets.
 * 2. Scrub sensitive properties before logging or reporting.
 * 3. Attach environment and release metadata.
 * 4. Sentry/GlitchTip-ready hook.
 */

export interface ErrorContext {
  componentStack?: string;
  route?: string;
  action?: string;
  [key: string]: unknown;
}

function sanitizeContext(ctx?: ErrorContext): ErrorContext {
  if (!ctx) return {};
  const cleaned: ErrorContext = {};

  for (const [key, val] of Object.entries(ctx)) {
    if (/token|auth|password|secret|key/i.test(key)) {
      continue;
    }
    cleaned[key] = val;
  }
  return cleaned;
}

export function captureException(error: unknown, context?: ErrorContext): void {
  const sanitizedCtx = sanitizeContext(context);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // In development, log clean diagnostic to console
  if (import.meta.env.DEV) {
    console.error('[Monitoring Exception Captured]', {
      message: errorMessage,
      context: sanitizedCtx,
      stack: errorStack,
    });
  }

  // Hook for Sentry or equivalent provider
  const win = typeof window !== 'undefined' ? (window as unknown as { Sentry?: { captureException: (e: unknown, extra: unknown) => void } }) : null;
  if (win?.Sentry) {
    win.Sentry.captureException(error, { extra: sanitizedCtx });
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (import.meta.env.DEV) {
    console.log(`[Monitoring Message: ${level.toUpperCase()}]`, message);
  }

  const win = typeof window !== 'undefined' ? (window as unknown as { Sentry?: { captureMessage: (m: string, l: string) => void } }) : null;
  if (win?.Sentry) {
    win.Sentry.captureMessage(message, level);
  }
}
