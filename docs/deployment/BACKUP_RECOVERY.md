# AgroAI – Backup and Recovery Procedures

> [!IMPORTANT]
> Live disaster-recovery drills and automated Cloud Storage export jobs require access to production GCP resources and explicit owner authorization. This document specifies standard operational procedures.

---

## 1. Scope and Data Classification

| Data Category | Storage Location | Sensitivity | Backup Frequency | Retention Policy |
|---|---|---|---|---|
| Farm, Field, User Profiles | Cloud Firestore (`farms`, `fields`, `users`) | Confidential | Daily snapshot | 30 days |
| Assignments & Tenures | Cloud Firestore (`assignments`) | Confidential | Daily snapshot | 90 days |
| Payments & Ledgers | Cloud Firestore (`payments`) | Financial / High | Point-in-time recovery (PITR) + Daily snapshot | 7 years (Audit compliance) |
| Reviews & History | Cloud Firestore (`assignment_reviews`) | Confidential | Daily snapshot | 1 year |
| Telemetry & Activity | Cloud Firestore (`soil_telemetry`, `field_activity`, `irrigation_plans`) | Operational | Weekly snapshot | 30 days |
| Crop Images | Google Cloud Storage Bucket | High (Farmer data) | Bucket Versioning + Nearline replication | Indefinite / Configured lifecycle |
| Application Artifacts | Git repository & Container Registry | Proprietary | On release / commit | Indefinite |

---

## 2. Cloud Firestore Backup Strategy

### 2.1 Point-in-Time Recovery (PITR)
For critical operational continuity, Firestore Point-in-Time Recovery (PITR) must be enabled on the production database:
```bash
gcloud firestore databases update --database='(default)' --enable-pitr
```
*Recovery Window:* 7 days of continuous point-in-time recovery.

### 2.2 Scheduled Managed Export (gcloud CLI / Cloud Scheduler)
Schedule daily automated backups to an isolated Cloud Storage bucket (`gs://agroai-firestore-backups/`):

```bash
# Manual snapshot command
gcloud firestore export gs://agroai-firestore-backups/$(date +%Y-%m-%d-%H%M%S) \
  --project=${FIREBASE_PROJECT_ID}
```

Cloud Scheduler job configuration:
- **Frequency:** Daily at 02:00 UTC (`0 2 * * *`)
- **Target:** Cloud Functions trigger executing Firestore Managed Export API.

---

## 3. Crop Image Storage (GCS) Backup & Lifecycle

1. **Object Versioning:** Enable versioning on the primary crop images bucket:
   ```bash
   gcloud storage buckets update gs://${AGROAI_GCS_BUCKET_NAME} --versioning
   ```
2. **Dual-Region / Multi-Region Redundancy:** For production deployments in Asia/South Asia, choose dual-region (e.g. `asia-south1` and `asia-south2`) to guarantee regional high availability.
3. **Lifecycle Rule:** Automatically move images older than 365 days to Coldline/Archive storage class.

---

## 4. Disaster Recovery & Restoration Procedures

### 4.1 Restoring Firestore from Snapshot
To restore collections from a specific snapshot:
```bash
gcloud firestore import gs://agroai-firestore-backups/YYYY-MM-DD-HHMMSS/ \
  --project=${FIREBASE_PROJECT_ID}
```
*Note:* Importing documents does not delete documents created after the backup timestamp. If a complete rollback is needed, an empty target database or explicit collection purge must be executed.

### 4.2 Restoring from PITR
Restore the database state to a specific second:
```bash
gcloud firestore databases restore \
  --source-database='(default)' \
  --destination-database='restored-db' \
  --recovery-time='2026-11-18T14:30:00Z'
```

---

## 5. RTO and RPO Targets

- **Recovery Point Objective (RPO):**
  - Financial & Transactional Data (Payments, Assignments): < 5 minutes (via PITR)
  - General Field & Farm Data: < 24 hours (via Daily Snapshots)
- **Recovery Time Objective (RTO):**
  - Database restoration to operational readiness: < 2 hours
  - Complete stack rebuild (Docker Compose / Cloud Run): < 30 minutes
