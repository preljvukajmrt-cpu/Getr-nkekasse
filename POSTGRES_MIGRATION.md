# PostgreSQL Migration für Getränkekasse (Fedora)

Dieses Dokument beschreibt die Migration der Getränkekasse von JSON-basierten Dateien zu PostgreSQL auf Fedora Linux.

## 🚀 Schnellstart

### 1. Migration ausführen

```bash
# Python-Skript ausführbar machen
chmod +x migrate_to_postgres.py

# Migration starten
python3 migrate_to_postgres.py
```

Das Skript wird:
- PostgreSQL installieren (dnf-basiert für Fedora)
- PostgreSQL initialisieren 
- Eine Datenbank erstellen
- Die Daten aus `data.json` migrieren
- Eine Konfigurationsdatei erstellen

### 2. Node.js Abhängigkeiten installieren

```bash
npm install pg
```

### 3. API auf PostgreSQL umstellen

Ersetze in `app.js`:
```javascript
// Alt:
const apiRoutes = require('./routes/api');

// Neu:
const apiRoutes = require('./routes/api-postgres');
```

## 📊 Datenbank-Schema

### Tabellen

#### `drinks`
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR(255) UNIQUE)
- `price` (DECIMAL(10,2))
- `created_at` (TIMESTAMP)

#### `users`
- `id` (SERIAL PRIMARY KEY)
- `username` (VARCHAR(255) UNIQUE)
- `pin` (VARCHAR(4))
- `balance` (DECIMAL(10,2))
- `created_at` (TIMESTAMP)

#### `transactions`
- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER REFERENCES users(id))
- `transaction_date` (TIMESTAMP)
- `amount` (DECIMAL(10,2))
- `transaction_type` (VARCHAR(50))
- `description` (TEXT)
- `drink_name` (VARCHAR(255))
- `created_at` (TIMESTAMP)

#### `admin_settings`
- `id` (SERIAL PRIMARY KEY)
- `setting_key` (VARCHAR(255) UNIQUE)
- `setting_value` (TEXT)
- `updated_at` (TIMESTAMP)

## 🔧 Konfiguration

### Datenbankverbindung

Die Konfiguration wird in `database-config.json` gespeichert:

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "getraenkekasse",
    "user": "getraenkekasse_user",
    "password": "getraenkekasse_password_2025"
  }
}
```

### Standard-Anmeldedaten

- **Datenbank**: `getraenkekasse`
- **Benutzer**: `getraenkekasse_user`
- **Passwort**: `getraenkekasse_password_2025`
- **Host**: `localhost`
- **Port**: `5432`

## � Fedora-spezifische Problemlösungen

### Authentifizierungsfehler beheben

Falls du den Fehler "Ident-Authentifizierung fehlgeschlagen" erhältst:

#### Automatische Lösung:
```bash
./fix_postgres_auth.sh
```

#### Manuelle Lösung:

1. **pg_hba.conf bearbeiten:**
   ```bash
   sudo nano /var/lib/pgsql/data/pg_hba.conf
   ```

2. **Füge am ANFANG der Datei hinzu:**
   ```
   local   getraenkekasse    getraenkekasse_user                     md5
   ```

3. **PostgreSQL neu laden:**
   ```bash
   sudo systemctl reload postgresql
   ```

4. **Migrationsskript erneut ausführen:**
   ```bash
   python3 migrate_to_postgres.py
   ```

### Komplette manuelle Setup-Schritte für Fedora

Falls das automatische Setup fehlschlägt:

```bash
# 1. PostgreSQL installieren
sudo dnf install -y postgresql postgresql-server postgresql-contrib

# 2. Datenbank initialisieren
sudo postgresql-setup --initdb

# 3. Service starten
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 4. Benutzer und Datenbank erstellen
sudo -u postgres createuser --login getraenkekasse_user
sudo -u postgres createdb -O getraenkekasse_user getraenkekasse
sudo -u postgres psql -c "ALTER USER getraenkekasse_user WITH PASSWORD 'getraenkekasse_password_2025';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE getraenkekasse TO getraenkekasse_user;"

# 5. Authentifizierung konfigurieren
./fix_postgres_auth.sh

# 6. Migration fortsetzen
python3 migrate_to_postgres.py
```

### PostgreSQL installieren (Fedora)

```bash
# Fedora
sudo dnf install -y postgresql postgresql-server postgresql-contrib

# Datenbank initialisieren (nur beim ersten Mal)
sudo postgresql-setup --initdb

# Service starten
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Datenbank und Benutzer erstellen

```bash
# Benutzer erstellen
sudo -u postgres createuser --createdb --login getraenkekasse_user

# Datenbank erstellen
sudo -u postgres createdb -O getraenkekasse_user getraenkekasse

# Passwort setzen
sudo -u postgres psql -c "ALTER USER getraenkekasse_user WITH PASSWORD 'getraenkekasse_password_2025';"
```

### Alternative: Über psql

```bash
sudo -u postgres psql
```

```sql
CREATE USER getraenkekasse_user WITH PASSWORD 'getraenkekasse_password_2025';
CREATE DATABASE getraenkekasse OWNER getraenkekasse_user;
GRANT ALL PRIVILEGES ON DATABASE getraenkekasse TO getraenkekasse_user;
\q
```

### Tabellen erstellen

```bash
psql -h localhost -U getraenkekasse_user -d getraenkekasse
```

Führe dann die SQL-Befehle aus dem Python-Skript aus.

## 🔍 Testen der Migration

### Datenbankverbindung testen

```bash
psql -h localhost -U getraenkekasse_user -d getraenkekasse -c "SELECT COUNT(*) FROM users;"
```

### Daten überprüfen

```sql
-- Anzahl Benutzer
SELECT COUNT(*) FROM users;

-- Anzahl Getränke
SELECT COUNT(*) FROM drinks;

-- Anzahl Transaktionen
SELECT COUNT(*) FROM transactions;

-- Beispiel-Benutzer anzeigen
SELECT username, balance FROM users LIMIT 5;
```

## 🔄 Rückgängigmachen der Migration

Falls du zur JSON-basierten Version zurückkehren möchtest:

1. In `app.js` zurück zu `./routes/api` wechseln
2. `npm uninstall pg`
3. PostgreSQL Service stoppen: `sudo systemctl stop postgresql`

## 📝 API-Änderungen

Die API-Endpunkte bleiben identisch, aber die interne Implementierung verwendet jetzt PostgreSQL:

### Neue Features durch PostgreSQL

- **Transaktions-Sicherheit**: Atomare Operationen
- **Bessere Performance**: Indizierte Suchen
- **Datenintegrität**: Foreign Keys und Constraints
- **Backup-Möglichkeiten**: Standard PostgreSQL Tools
- **Skalierbarkeit**: Unterstützt mehr gleichzeitige Benutzer

### Backward Compatibility

Alle bestehenden API-Endpunkte funktionieren weiterhin:
- `/api/login`
- `/api/register`
- `/api/balance/:username`
- `/api/drinks`
- `/api/consume`
- `/api/deposit`
- `/api/withdraw`
- `/api/transfer`
- etc.

## 🚨 Troubleshooting

### Häufige Probleme

#### PostgreSQL Service läuft nicht
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

#### Verbindungsfehler
```bash
# Überprüfe Firewall
sudo ufw status

# Überprüfe PostgreSQL-Konfiguration
sudo -u postgres psql -c "SHOW config_file;"
```

#### Berechtigungsfehler
```bash
# Benutzer-Berechtigungen prüfen
sudo -u postgres psql -c "\\du"
```

### Logs überprüfen

```bash
# PostgreSQL Logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Application Logs
npm start
```

## 🔐 Sicherheit

### Produktionsumgebung

Für den Produktionseinsatz solltest du:

1. **Passwort ändern**:
   ```sql
   ALTER USER getraenkekasse_user PASSWORD 'NEUES_SICHERES_PASSWORT';
   ```

2. **Netzwerkzugriff beschränken** in `/etc/postgresql/*/main/pg_hba.conf`

3. **SSL aktivieren** in `/etc/postgresql/*/main/postgresql.conf`

4. **Firewall konfigurieren**:
   ```bash
   sudo ufw allow from 127.0.0.1 to any port 5432
   ```

## 📚 Weitere Ressourcen

- [PostgreSQL Dokumentation](https://www.postgresql.org/docs/)
- [psycopg2 Dokumentation](https://www.psycopg.org/docs/)
- [Node.js pg Module](https://node-postgres.com/)

## 🤝 Support

Bei Problemen mit der Migration:

1. Überprüfe die Logs
2. Stelle sicher, dass alle Abhängigkeiten installiert sind
3. Prüfe die Datenbankverbindung manuell
4. Verwende die Troubleshooting-Sektion
