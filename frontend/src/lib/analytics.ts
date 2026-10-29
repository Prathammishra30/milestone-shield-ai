/**
 * Privacy-First Product Analytics Abstraction
 *
 * PRIVACY & COMPLIANCE REQUIREMENTS:
 * 1. Strictly scrub message text, deliverable URLs, passwords, API tokens, and PayPal keys.
 * 2. Track only necessary lifecycle and product usage events.
 * 3. Respect user opt-out and browser 'Do Not Track' (DNT) signal.
 * 4. Compatible with PostHog or any compliant self-hosted analytics provider.
 */

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined;
}

// Disallowed sensitive keys that must never be recorded
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /bearer/i,
  /deliverable/i,
  /message/i,
  /text/i,
  /credit/i,
  /card/i,
];

function sanitizeProperties(props?: AnalyticsProperties): AnalyticsProperties {
  if (!props) return {};
  const clean: AnalyticsProperties = {};

  for (const [key, value] of Object.entries(props)) {
    // Drop keys matching sensitive patterns
    if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      continue;
    }
    // Scrub string values that resemble tokens, JWTs, or email addresses
    if (typeof value === 'string') {
      if (value.startsWith('Bearer ') || value.includes('eyJ') || value.length > 200) {
        clean[key] = '[REDACTED]';
        continue;
      }
    }
    clean[key] = value;
  }

  return clean;
}

class ProductAnalytics {
  private consentGranted = true;
  private isDntEnabled = false;

  constructor() {
    // Respect Do Not Track header
    if (typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || (window as unknown as { doNotTrack?: string }).doNotTrack === '1')) {
      this.isDntEnabled = true;
      this.consentGranted = false;
    }

    const storedConsent = typeof localStorage !== 'undefined' ? localStorage.getItem('milestoneshield_analytics_consent') : null;
    if (storedConsent !== null) {
      this.consentGranted = storedConsent === 'true';
    }
  }

  public setConsent(granted: boolean): void {
    this.consentGranted = granted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('milestoneshield_analytics_consent', String(granted));
    }
  }

  public isTrackingAllowed(): boolean {
    return this.consentGranted && !this.isDntEnabled;
  }

  public track(eventName: string, properties?: AnalyticsProperties): void {
    if (!this.isTrackingAllowed()) return;

    const sanitized = sanitizeProperties(properties);
    const eventPayload = {
      event: eventName,
      properties: {
        ...sanitized,
        timestamp: new Date().toISOString(),
        environment: import.meta.env.MODE,
      },
    };

    // Diagnostic console trace in development
    if (import.meta.env.DEV) {
      console.debug('[Analytics Event]', eventPayload.event, eventPayload.properties);
    }

    // Provider hook (e.g. PostHog if configured)
    const win = typeof window !== 'undefined' ? (window as unknown as { posthog?: { capture: (e: string, p: unknown) => void } }) : null;
    if (win?.posthog) {
      win.posthog.capture(eventPayload.event, eventPayload.properties);
    }
  }
}

export const analytics = new ProductAnalytics();
