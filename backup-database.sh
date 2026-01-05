#!/bin/bash

# Database backup script for boekhouding
# Creates timestamped SQL dump of PostgreSQL database

BACKUP_DIR="/home/thartist/Desktop/riemerFYI/database-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/boekhouding_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Start postgres container if not running
docker compose up -d postgres

# Wait for postgres to be ready
sleep 2

# Create backup
echo "Creating database backup..."
docker exec business_db pg_dump -U admin business_admin > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Backup created successfully: $BACKUP_FILE"
    ls -lh "$BACKUP_FILE"
else
    echo "✗ Backup failed!"
    exit 1
fi