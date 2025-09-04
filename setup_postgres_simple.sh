#!/bin/bash
# Einfache PostgreSQL Migration für Fedora - Getränkekasse

echo "🐘 Einfache PostgreSQL Migration für Fedora"
echo "============================================="

# 1. Stelle sicher dass PostgreSQL läuft
echo "🔧 Starte PostgreSQL Service..."
sudo systemctl start postgresql

# 2. Erstelle Benutzer und Datenbank manuell
echo "👤 Erstelle Benutzer und Datenbank..."

# Verwende peer authentication für postgres user
sudo -u postgres psql << EOF
-- Erstelle User falls nicht vorhanden
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'getraenkekasse_user') THEN
        CREATE USER getraenkekasse_user WITH PASSWORD 'getraenkekasse_password_2025';
    END IF;
END
\$\$;

-- Erstelle Datenbank falls nicht vorhanden
SELECT 'CREATE DATABASE getraenkekasse OWNER getraenkekasse_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'getraenkekasse')\gexec

-- Setze Berechtigungen
ALTER USER getraenkekasse_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE getraenkekasse TO getraenkekasse_user;

\q
EOF

echo "✅ Benutzer und Datenbank erstellt"

# 3. Setze trust authentication für lokale Verbindungen (einfacher)
echo "🔐 Konfiguriere einfache Authentifizierung..."

# Backup erstellen
sudo cp /var/lib/pgsql/data/pg_hba.conf /var/lib/pgsql/data/pg_hba.conf.backup.manual

# Neue einfache Konfiguration
cat << EOF | sudo tee /var/lib/pgsql/data/pg_hba.conf > /dev/null
# PostgreSQL Client Authentication Configuration File
# Simple configuration for local development

# Allow local connections for getraenkekasse
local   getraenkekasse    getraenkekasse_user                     trust
local   all               postgres                                peer

# Default rules
local   all               all                                     peer
host    all               all             127.0.0.1/32            ident
host    all               all             ::1/128                 ident
local   replication       all                                     peer
host    replication       all             127.0.0.1/32            ident
host    replication       all             ::1/128                 ident
EOF

# PostgreSQL neu laden
sudo systemctl reload postgresql

echo "✅ Authentifizierung konfiguriert"

# 4. Teste Verbindung
echo "🧪 Teste Datenbankverbindung..."
if psql -h localhost -U getraenkekasse_user -d getraenkekasse -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Datenbankverbindung erfolgreich!"
    echo ""
    echo "🚀 Du kannst jetzt das Python-Migrationsskript ausführen:"
    echo "python3 migrate_to_postgres.py"
else
    echo "❌ Datenbankverbindung fehlgeschlagen"
    echo "Versuche manuell zu verbinden mit:"
    echo "psql -h localhost -U getraenkekasse_user -d getraenkekasse"
fi
