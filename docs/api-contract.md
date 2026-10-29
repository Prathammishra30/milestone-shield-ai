# MilestoneShield AI — API Contract

> **Version:** 0.1.0  
> **Last updated:** 2026-10-28  
> **Base URL:** `http://localhost:3001/api`

This document describes the planned API surface for MilestoneShield AI. Only endpoints marked **✅ Implemented** are functional. All others are planned for future milestones.

---

## Authentication

> Not yet implemented. Future milestones will add JWT-based authentication.

---

## Endpoints

### 1. Health Check

| Detail | Value |
|--------|-------|
| **Method** | `GET` |
| **Path** | `/api/health` |
| **Status** | ✅ Implemented |
| **Auth** | None |

**Response `200 OK`**

```json
{
  "status": "healthy",
  "service": "milestone-shield-ai",
  "version": "0.1.0",
  "timestamp": "2026-10-28T10:00:00.000Z",
  "uptime": 123.456,
  "environment": "development"
}
```

---

### 2. Create Project

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/projects` |
| **Status** | 🔮 Planned |
| **Auth** | Required |

**Request Body**

```json
{
  "name": "string (required, 1–200 chars)",
  "clientEmail": "string (required, valid email)",
  "freelancerEmail": "string (required, valid email)",
  "totalBudget": "number (required, > 0)",
  "description": "string (optional)"
}
```

**Response `201 Created`**

```json
{
  "status": "success",
  "data": {
    "id": "proj-uuid",
    "name": "E-Commerce Redesign",
    "status": "draft",
    "totalBudget": 12000,
    "createdAt": "2026-10-28T10:00:00.000Z"
  }
}
```

---

### 3. Generate Milestones (AI)

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/projects/:id/milestones/generate` |
| **Status** | 🔮 Planned |
| **Auth** | Required |

**Description:** Uses Anthropic Claude to generate measurable milestones with acceptance criteria based on the project scope.

**Request Body**

```json
{
  "scopeDescription": "string (required)",
  "numberOfMilestones": "number (optional, default 3–5)",
  "budgetDistribution": "string (optional: 'equal' | 'weighted')"
}
```

**Response `201 Created`**

```json
{
  "status": "success",
  "data": {
    "milestones": [
      {
        "id": "ms-uuid",
        "title": "string",
        "description": "string",
        "amount": 3000,
        "acceptanceCriteria": ["criterion 1", "criterion 2"],
        "suggestedDueDate": "2026-11-15"
      }
    ],
    "aiModel": "claude-3-sonnet",
    "generatedAt": "2026-10-28T10:00:00.000Z"
  }
}
```

---

### 4. Create PayPal Order for Milestone

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/milestones/:id/paypal/order` |
| **Status** | ✅ Implemented (Milestone 2A) |
| **Auth** | Prototype / Demo Mode |

**Description:** Creates a PayPal Orders v2 order with `intent: 'AUTHORIZE'` for a known milestone. The payment amount and currency are strictly derived from trusted server-side milestone data; client-supplied amounts are rejected.

**Request Body (Optional)**

```json
{
  "returnUrl": "http://localhost:5173/overview?paypal_return=true&milestoneId=ms-003",
  "cancelUrl": "http://localhost:5173/overview?paypal_cancel=true&milestoneId=ms-003",
  "idempotencyKey": "string (optional, supported via PayPal-Request-Id)"
}
```

**Response `201 Created`**

```json
{
  "status": "success",
  "data": {
    "orderId": "PAYPAL-ORDER-ID",
    "status": "CREATED",
    "approveUrl": "https://www.sandbox.paypal.com/checkoutnow?token=...",
    "milestoneId": "ms-003",
    "amount": 2500,
    "currency": "USD",
    "paymentRecordId": "pay-sbx-001"
  }
}
```

---

### 5. Authorize PayPal Order

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/payments/paypal/orders/:id/authorize` |
| **Status** | ✅ Implemented (Milestone 2A) |
| **Auth** | Prototype / Demo Mode |

**Description:** Authorizes a previously approved PayPal order via PayPal Orders v2 (`/v2/checkout/orders/{id}/authorize`). Funds are held on the buyer's payment instrument in Sandbox, not captured.

**Response `200 OK`**

```json
{
  "status": "success",
  "data": {
    "orderId": "PAYPAL-ORDER-ID",
    "authorizationId": "AUTH-ID",
    "status": "AUTHORIZED",
    "amount": {
      "currency_code": "USD",
      "value": "2500.00"
    }
  }
}
```

---

### 6. Capture Authorized Payment

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/payments/paypal/authorizations/:id/capture` |
| **Status** | ✅ Implemented (Milestone 2A) |
| **Auth** | Prototype / Demo Mode |

**Description:** Explicit human operator action to capture an authorized payment via PayPal Payments v2 (`/v2/payments/authorizations/{id}/capture`). Requires explicit confirmation (`confirmed: true`); AI agents are forbidden from executing captures. Validates that current payment state is `AUTHORIZED`. Duplicate captures are prevented with `409 Conflict`.

**Request Body**

```json
{
  "confirmed": true,
  "operatorNote": "string (optional, e.g. Client verified acceptance criteria)",
  "idempotencyKey": "string (optional)"
}
```

**Response `200 OK`**

```json
{
  "status": "success",
  "data": {
    "authorizationId": "AUTH-ID",
    "captureId": "CAPTURE-ID",
    "status": "CAPTURED",
    "amount": {
      "currency_code": "USD",
      "value": "2500.00"
    }
  }
}
```

---

### 7. Void Authorized Payment

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/payments/paypal/authorizations/:id/void` |
| **Status** | ✅ Implemented (Milestone 2A) |
| **Auth** | Prototype / Demo Mode |

**Description:** Voids an uncaptured authorization via PayPal Payments v2 (`/v2/payments/authorizations/{id}/void`), releasing the temporary authorization hold on the client's payment instrument. Cannot void an already captured payment.

**Request Body (Optional)**

```json
{
  "reason": "string (optional)",
  "idempotencyKey": "string (optional)"
}
```

**Response `200 OK`**

```json
{
  "status": "success",
  "data": {
    "authorizationId": "AUTH-ID",
    "status": "VOIDED",
    "message": "Authorization successfully voided in PayPal Sandbox."
  }
}
```

---

### 8. Read PayPal Sandbox Payments & Status

| Detail | Value |
|--------|-------|
| **Method** | `GET` |
| **Paths** | `/api/payments/paypal`<br>`/api/payments/paypal/milestone/:milestoneId`<br>`/api/payments/paypal/orders/:id`<br>`/api/payments/paypal/authorizations/:id` |
| **Status** | ✅ Implemented (Milestone 2A) |
| **Auth** | Prototype / Demo Mode |

**Description:** Reads tracked Sandbox payments and audit events from the temporary in-memory store.

**Response `200 OK` (Collection)**

```json
{
  "status": "success",
  "data": {
    "payments": [
      {
        "id": "pay-sbx-001",
        "milestoneId": "ms-003",
        "milestoneTitle": "PayPal Sandbox Payment Gateway Integration",
        "projectId": "proj-001",
        "projectName": "E-Commerce Platform Redesign & Implementation",
        "amount": 2500,
        "currency": "USD",
        "status": "AUTHORIZED",
        "paypalOrderId": "PAYPAL-ORDER-ID",
        "paypalAuthorizationId": "AUTH-ID",
        "createdAt": "2026-10-28T10:00:00.000Z",
        "updatedAt": "2026-10-28T10:05:00.000Z",
        "auditTrail": [ ... ]
      }
    ],
    "summary": {
      "totalTracked": 1,
      "authorizedCount": 1,
      "capturedCount": 0,
      "voidedCount": 0,
      "createdCount": 0
    },
    "notice": "Tracked Sandbox transactions (in-memory test store). Not an escrow service."
  }
}
```

---

### 9. Submit Deliverable

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/milestones/:id/submissions` |
| **Status** | 🔮 Planned |
| **Auth** | Required |

**Request Body**

```json
{
  "content": "string (required, markdown or plain text)",
  "attachmentUrls": ["string (optional, array of URLs)"],
  "notes": "string (optional)"
}
```

**Response `201 Created`**

```json
{
  "status": "success",
  "data": {
    "id": "sub-uuid",
    "milestoneId": "ms-uuid",
    "status": "pending_review",
    "submittedAt": "2026-10-28T10:00:00.000Z"
  }
}
```

---

### 10. Process Submission (AI Verification)

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/submissions/:id/process` |
| **Status** | 🔮 Planned |
| **Auth** | Required |

**Description:** Triggers AI verification of the submission against the milestone's acceptance criteria using Anthropic Claude.

**Response `200 OK`**

```json
{
  "status": "success",
  "data": {
    "submissionId": "sub-uuid",
    "aiVerification": {
      "overallConfidence": 0.87,
      "criteriaResults": [
        {
          "criterion": "All 8 pages implemented",
          "met": true,
          "confidence": 0.92,
          "evidence": "Found references to all 8 page components..."
        }
      ],
      "recommendation": "approve",
      "aiModel": "claude-3-sonnet",
      "processedAt": "2026-10-28T10:00:00.000Z"
    }
  }
}
```

---

### 11. Review Submission (Human Decision)

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/submissions/:id/review` |
| **Status** | 🔮 Planned |
| **Auth** | Required |

**Request Body**

```json
{
  "decision": "approved | rejected | revision_requested",
  "feedback": "string (optional)",
  "overrideAiRecommendation": "boolean (default false)"
}
```

**Response `200 OK`**

```json
{
  "status": "success",
  "data": {
    "submissionId": "sub-uuid",
    "status": "approved",
    "reviewedAt": "2026-10-28T10:00:00.000Z",
    "paymentTriggered": true,
    "auditTrailId": "audit-uuid"
  }
}
```

---

## Error Responses

All errors follow a consistent shape:

```json
{
  "status": "error",
  "message": "Human-readable error description",
  "errors": [
    {
      "path": "field.name",
      "message": "Validation detail"
    }
  ]
}
```

| Status Code | Meaning |
|-------------|---------|
| `400` | Validation error (Zod) |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate submission) |
| `500` | Internal server error |

---

## Safety Boundaries

1. **No production payments.** All PayPal integration uses Sandbox mode during development.
2. **AI cannot execute payments.** The AI provides verification recommendations only. Payment capture requires explicit human approval through the policy engine.
3. **Audit trail.** All payment state transitions (authorize, capture, void, refund) are logged.
4. **Idempotency.** Payment operations use idempotency keys to prevent duplicate processing.
5. **Escalation.** Ambiguous AI verification results are flagged for human review.
6. **Credential isolation.** PayPal secrets, API keys, and database credentials are never exposed to the frontend.

---

## Webhook Architecture & Signature Verification

### PayPal Webhooks (`POST /api/webhooks/paypal`) — ✅ Implemented

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/webhooks/paypal` |
| **Status** | ✅ Implemented |
| **Auth** | PayPal Cryptographic Signature Verification (`PAYPAL-AUTH-ALGO`, `PAYPAL-CERT-URL`, `PAYPAL-TRANSMISSION-ID`, `PAYPAL-TRANSMISSION-SIG`, `PAYPAL-TRANSMISSION-TIME`) |
| **Rate Limit** | 120 req/min per IP |

**Description:** Receives and reconciles asynchronous PayPal Sandbox lifecycle notifications. The endpoint calls PayPal's `POST /v1/notifications/verify-webhook-signature` endpoint to cryptographically validate that the notification genuinely originated from PayPal.

**Security Controls:**
1. **SSRF Protection:** Validates that `PAYPAL-CERT-URL` uses HTTPS and targets `*.paypal.com`.
2. **Cryptographic Verification:** Validates transmission signature against PayPal's verification service using `PAYPAL_WEBHOOK_ID`.
3. **Idempotency & Deduplication:** Tracks `event.id` in `webhook_events` (and in-memory dedup store) to prevent duplicate processing or replay attacks.
4. **State Machine Hierarchy:** Forward-only state progression. Stale or out-of-order events cannot downgrade settled (`CAPTURED` or `VOIDED`) payments.
5. **Redacted Logging:** No secrets, bearer tokens, or sensitive payload details are logged.

**Supported Event Reconciliations:**
- `CHECKOUT.ORDER.APPROVED` -> Records `BUYER_APPROVED` in payment audit trail.
- `PAYMENT.AUTHORIZATION.CREATED` -> Transitions payment from `ORDER_CREATED` to `AUTHORIZED`.
- `PAYMENT.CAPTURE.COMPLETED` -> Transitions payment from `AUTHORIZED` to `CAPTURED`, sets `paypalCaptureId`, and marks milestone `paid`.
- `PAYMENT.AUTHORIZATION.VOIDED` -> Transitions payment from `AUTHORIZED` to `VOIDED`.
- `PAYMENT.CAPTURE.DENIED` / `PAYMENT.CAPTURE.DECLINED` -> Transitions payment to `FAILED`.
- `CUSTOMER.DISPUTE.CREATED` / `CUSTOMER.DISPUTE.RESOLVED` -> Records immutable audit event; does not downgrade captured state.
- Unsupported events -> Acknowledged with HTTP `200` (`status: "ignored"`) to prevent indefinite webhook retries.
