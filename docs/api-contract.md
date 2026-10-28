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
| **Status** | 🔮 Planned |
| **Auth** | Required |

**Description:** Creates a PayPal order for the milestone amount. The order is created in `AUTHORIZE` intent — funds are held but not captured until the milestone is approved.

**Response `201 Created`**

```json
{
  "status": "success",
  "data": {
    "orderId": "PAYPAL-ORDER-ID",
    "status": "CREATED",
    "approveUrl": "https://www.sandbox.paypal.com/checkoutnow?token=...",
    "amount": 3000,
    "currency": "USD"
  }
}
```

---

### 5. Authorize PayPal Order

| Detail | Value |
|--------|-------|
| **Method** | `POST` |
| **Path** | `/api/payments/paypal/orders/:id/authorize` |
| **Status** | 🔮 Planned |
| **Auth** | Required |

**Description:** Authorizes a previously approved PayPal order. Funds are held but not captured. Capture happens only after milestone approval through the policy engine.

**Response `200 OK`**

```json
{
  "status": "success",
  "data": {
    "orderId": "PAYPAL-ORDER-ID",
    "authorizationId": "AUTH-ID",
    "status": "AUTHORIZED",
    "amount": 3000
  }
}
```

**Security Notes:**
- The AI never independently captures, refunds, or voids a payment.
- Capture requires explicit approval through the backend policy engine.
- All payment state transitions are recorded in an audit trail.
- Ambiguous cases are escalated for human review.

---

### 6. Submit Deliverable

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

### 7. Process Submission (AI Verification)

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

### 8. Review Submission (Human Decision)

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
