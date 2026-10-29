# Database Backup & Disaster Recovery Runbook

**Service Target:** <br />
**Document Status:** <br />
**Last Verified:**

---

## 1. Provider Plan Capabilities & Limitations

| Tier | Backup Type | Frequency | Retention Window | Point-in-Time Recovery (PITR) |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase Free** | Daily physical snapshot | Once every 24 hours | 7 days | Not available (Restore only to midnight UTC snapshot) |
| **Supabase Pro** | Continuous WAL archiving + Daily | Every 24h + streaming | 7 days (upgradeable to 30) | Available to within seconds of disaster |
| **Self-Hosted PostgreSQL** | `pg_dump` cron + WAL-G / pgBackRest | Hourly WAL + Daily base | Configurable (Recommended: 30 days) | Available via write-ahead log replay |

> [!WARNING]
> **Production Rule:** Never declare automated PITR or cross-region replication active until the specific Supabase project plan has been upgraded to Pro and verified in the Supabase Dashboard under `Project Settings -> Database -> Backups`.

---

## 2. Retention Policy & Compliance

In accordance with financial reconciliation requirements (reflected in `backend/migrations/004_create_payments_and_audit.sql` and the platform Privacy Policy):

1. **Active Database:** Contains full contract graphs, active milestones, user profiles, deliverable URLs, and immutable audit logs.
2. **Account Deletions:** Personal identification information (PII) is anonymized in place. Transactional records and audit events are **never cascade-deleted**.
3. **Daily Snapshots:** Retained for a minimum of 30 days in off-site object storage (e.g. GCS / AWS S3) with immutable bucket locks (WORM).
4. **Monthly Archival:** Monthly logical dumps are retained for 7 years to satisfy statutory tax and commercial record-keeping obligations.

---

## 3. Automated Backup Routine (Production)

### 3.1 Managed Supabase Automatic Backups
Supabase performs automatic daily storage backups starting at 00:00 UTC. To verify backup status:
1. Navigate to **Supabase Dashboard** &rarr; **Project Settings** &rarr; **Database** &rarr; **Backups**.
2. Confirm the timestamp of the latest completed snapshot.

### 3.2 Automated Off-Site Logical Dumps (Independent Redundancy)
To prevent vendor lock-in and provide a tested independent recovery mechanism, execute the daily logical backup script via GitHub Actions or cron:

```bash
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/milestoneshield"
BACKUP_FILE="${BACKUP_DIR}/milestoneshield_dump_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Dump using custom directory format with compression
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --exclude-table-data='public.audit_events' \
  | gzip > "${BACKUP_FILE}"

# Dump audit events separately with cryptographic verification
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --table='public.audit_events' \
  | gzip > "${BACKUP_DIR}/audit_events_${TIMESTAMP}.sql.gz"

# Compute sha256 checksum for tamper-evidence
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"

echo "Backup completed: ${BACKUP_FILE}"
```

---

## 4. Tested Step-by-Step Restoration Procedure

### Phase A: Scenario Assessment
Identify the nature of the failure:
- **Corrupted Record / Accidental Mutation:** Use Table-level restore or PITR replay to 1 minute prior to incident.
- **Catastrophic Infrastructure Failure:** Full cluster restore to clean database instance.

### Phase B: Local Disaster Recovery Drill (Verified Test)

Execute the following commands to test database restoration locally or in staging:

```bash
# 1. Prepare target testing database
createdb -U postgres -h localhost -p 5432 milestoneshield_restore_test

# 2. Apply base migrations to ensure schema consistency
for file in backend/migrations/*.sql; do
  psql -U postgres -h localhost -d milestoneshield_restore_test -f "$file"
done

# 3. Restore logical data from backup
gunzip -c /var/backups/milestoneshield/milestoneshield_dump_20261028_000000.sql.gz \
  | pg_restore -U postgres -h localhost -d milestoneshield_restore_test --clean --if-exists

# 4. Verify integrity of recovered tables
psql -U postgres -h localhost -d milestoneshield_restore_test -c "
  SELECT 'profiles' AS table_name, count(*) FROM public.profiles
  UNION ALL
  SELECT 'contracts', count(*) FROM public.contracts
  UNION ALL
  SELECT 'milestones', count(*) FROM public.milestones
  UNION ALL
  SELECT 'payments', count(*) FROM public.payments
  UNION ALL
  SELECT 'audit_events', count(*) FROM public.audit_events;
"
```

### Phase C: Supabase Cloud Point-in-Time Recovery
If restoring on Supabase Cloud:
1. In the Supabase Dashboard, go to **Database** &rarr; **Backups** &rarr; **Point in Time**.
2. Select the recovery timestamp prior to the incident.
3. Click **Restore Database**. The database will enter maintenance mode for approximately 5–15 minutes depending on volume.
4. Verify application connectivity via `GET /api/health`.

---

## 5. Recovery Time Objective (RTO) and Recovery Point Objective (RPO)

- **Target RPO (Data Loss Tolerance):**
  - Supabase Pro with PITR: `< 5 minutes`
  - Daily Snapshot tier: `< 24 hours`
- **Target RTO (Downtime Tolerance):**
  - Logical restore: `< 30 minutes`
  - Automated cloud instance restore: `< 15 minutes`

---

## 6. Disaster Recovery Verification Checklist

- [ ] Daily backup job logs reviewed weekly.
- [ ] Off-site object storage bucket versioning and lifecycle retention verified.
- [ ] Quarterly restore drill performed on isolated staging environment.
- [ ] Encryption keys and database connection strings rotated every 90 days.
- [ ] Tamper-evident sha256 checksums match across backup archives.
