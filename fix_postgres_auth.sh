#!/bin/bash
# PostgreSQL Konfiguration für Fedora - Getränkekasse

echo "🔧 PostgreSQL Konfiguration für Fedora"
echo "======================================"

# Konfigurationsdatei finden
HBA_FILE=$(sudo -u postgres psql -t -c "SHOW hba_file;" | xargs)

if [ -z "$HBA_FILE" ]; then
    echo "❌ Konnte pg_hba.conf nicht finden"
    exit 1
fi

echo "📁 pg_hba.conf gefunden: $HBA_FILE"

# Backup erstellen
echo "💾 Erstelle Backup..."
sudo cp "$HBA_FILE" "${HBA_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

# Auth-Zeile hinzufügen
AUTH_LINE="local   getraenkekasse    getraenkekasse_user                     md5"

echo "🔐 Füge Authentifizierung hinzu..."
echo "$AUTH_LINE" | sudo tee /tmp/auth_line.conf > /dev/null
sudo sh -c "cat /tmp/auth_line.conf $HBA_FILE > ${HBA_FILE}.new && mv ${HBA_FILE}.new $HBA_FILE"
rm -f /tmp/auth_line.conf

# PostgreSQL neu laden
echo "🔄 Lade PostgreSQL Konfiguration neu..."
sudo systemctl reload postgresql

echo "✅ Konfiguration abgeschlossen!"
echo ""
echo "Du kannst jetzt das Migrationsskript erneut ausführen:"
echo "python3 migrate_to_postgres.py"
