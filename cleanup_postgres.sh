#!/bin/bash
# Bereinige PostgreSQL Konfiguration

echo "🧹 Bereinige PostgreSQL Konfiguration..."

# Backup erstellen
sudo cp /var/lib/pgsql/data/pg_hba.conf /var/lib/pgsql/data/pg_hba.conf.backup.cleanup

# Saubere Konfiguration erstellen
cat << EOF | sudo tee /var/lib/pgsql/data/pg_hba.conf > /dev/null
# PostgreSQL Client Authentication Configuration File
# Clean configuration for getraenkekasse

# Allow trust for getraenkekasse database
local   getraenkekasse    getraenkekasse_user                     trust

# Default postgres rules
local   all               postgres                                peer
local   all               all                                     peer
host    all               all             127.0.0.1/32            ident
host    all               all             ::1/128                 ident

# Replication
local   replication       all                                     peer
host    replication       all             127.0.0.1/32            ident
host    replication       all             ::1/128                 ident
EOF

# PostgreSQL neu starten für sichere Konfiguration
sudo systemctl restart postgresql

echo "✅ PostgreSQL Konfiguration bereinigt und neu gestartet"

# Teste Verbindung
if psql -U getraenkekasse_user -d getraenkekasse -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Datenbankverbindung funktioniert!"
else
    echo "❌ Datenbankverbindung fehlgeschlagen"
fi
