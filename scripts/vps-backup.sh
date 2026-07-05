#!/bin/bash
# Safe online SQLite backup for production. Run via cron every 4 hours.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/english-app}"
DB="${APP_DIR}/prisma/prisma/dev.db"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/english-app}"
AUTO_DIR="${BACKUP_ROOT}/auto"
DAILY_DIR="${BACKUP_ROOT}/daily"
LOG="${LOG:-/var/log/english-app-backup.log}"

mkdir -p "$AUTO_DIR" "$DAILY_DIR"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

if [ ! -f "$DB" ]; then
  log "ERROR: database not found at $DB"
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  log "ERROR: sqlite3 not installed"
  exit 1
fi

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
AUTO_DEST="${AUTO_DIR}/auto-${STAMP}.db"
sqlite3 "$DB" ".backup '${AUTO_DEST}'"
log "Auto backup: ${AUTO_DEST} ($(du -h "${AUTO_DEST}" | cut -f1))"

DAY=$(date -u +%Y%m%d)
DAILY_DEST="${DAILY_DIR}/daily-${DAY}.db"
if [ ! -f "$DAILY_DEST" ]; then
  sqlite3 "$DB" ".backup '${DAILY_DEST}'"
  log "Daily backup: ${DAILY_DEST}"
fi

# Frequent auto backups: keep newest 60 (~10 days at 4h interval)
if ls "${AUTO_DIR}"/auto-*.db >/dev/null 2>&1; then
  ls -1t "${AUTO_DIR}"/auto-*.db | tail -n +61 | xargs -r rm -f
fi

# Daily backups: keep newest 30
if ls "${DAILY_DIR}"/daily-*.db >/dev/null 2>&1; then
  ls -1t "${DAILY_DIR}"/daily-*.db | tail -n +31 | xargs -r rm -f
fi

# Pre-deploy snapshots from deploy.js: keep newest 20
if ls "${BACKUP_ROOT}"/pre-deploy-*.db >/dev/null 2>&1; then
  ls -1t "${BACKUP_ROOT}"/pre-deploy-*.db | tail -n +21 | xargs -r rm -f
fi

log "Done"
