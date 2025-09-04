#!/usr/bin/env python3
"""
PostgreSQL Migration Script für Getränkekasse
Installiert PostgreSQL und migriert Daten aus data.json in eine relationale Datenbank
"""

import json
import subprocess
import sys
import os
import getpass
from datetime import datetime
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Konfiguration
DATABASE_NAME = "getraenkekasse"
DATABASE_USER = "getraenkekasse_user"
DEFAULT_PASSWORD = "getraenkekasse_password_2025"

def install_dependencies():
    """Installiert benötigte Python-Pakete"""
    print("🔧 Installiere Python-Abhängigkeiten...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
        print("✅ Python-Abhängigkeiten erfolgreich installiert")
    except subprocess.CalledProcessError as e:
        print(f"❌ Fehler beim Installieren der Python-Abhängigkeiten: {e}")
        sys.exit(1)

def configure_postgresql_auth():
    """Konfiguriert PostgreSQL Authentifizierung für md5"""
    print("🔐 Konfiguriere PostgreSQL Authentifizierung...")
    
    try:
        # Finde PostgreSQL Konfigurationsdateien
        result = subprocess.run([
            "sudo", "-u", "postgres", "psql", 
            "-t", "-c", "SHOW hba_file;"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            hba_file = result.stdout.strip()
            print(f"📁 pg_hba.conf gefunden: {hba_file}")
            
            # Backup erstellen
            subprocess.check_call([
                "sudo", "cp", hba_file, f"{hba_file}.backup"
            ])
            print("💾 Backup der pg_hba.conf erstellt")
            
            # md5 Authentifizierung hinzufügen
            auth_line = f"local   {DATABASE_NAME}    {DATABASE_USER}                     md5\n"
            
            # Temporäre Datei erstellen
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_file:
                temp_file.write(auth_line)
                temp_file_path = temp_file.name
            
            # Auth-Zeile am Anfang der Datei einfügen
            subprocess.check_call([
                "sudo", "sh", "-c", 
                f"cat {temp_file_path} {hba_file} > {hba_file}.new && mv {hba_file}.new {hba_file}"
            ])
            
            # Temp-Datei löschen
            os.unlink(temp_file_path)
            
            # PostgreSQL neu laden
            subprocess.check_call(["sudo", "systemctl", "reload", "postgresql"])
            print("✅ PostgreSQL Authentifizierung konfiguriert und neu geladen")
            
            return True
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Fehler bei der Authentifizierung-Konfiguration: {e}")
        return False
    except Exception as e:
        print(f"❌ Unerwarteter Fehler: {e}")
        return False
    """Versucht automatisches Setup für Fedora"""
    print("🔧 Versuche automatisches Fedora-Setup...")
    try:
        # Prüfe ob postgres User existiert und Service läuft
        subprocess.check_call(["sudo", "systemctl", "is-active", "postgresql"], 
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("✅ PostgreSQL Service läuft")
        
        # Erstelle Benutzer über createuser (ohne --createdb da das Probleme machen kann)
        try:
            subprocess.check_call([
                "sudo", "-u", "postgres", "createuser", 
                "--login", DATABASE_USER
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"✅ Benutzer '{DATABASE_USER}' erstellt")
        except subprocess.CalledProcessError:
            print(f"ℹ️ Benutzer '{DATABASE_USER}' existiert möglicherweise bereits")
        
        # Erstelle Datenbank
        try:
            subprocess.check_call([
                "sudo", "-u", "postgres", "createdb", 
                "-O", DATABASE_USER, DATABASE_NAME
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"✅ Datenbank '{DATABASE_NAME}' erstellt")
        except subprocess.CalledProcessError:
            print(f"ℹ️ Datenbank '{DATABASE_NAME}' existiert möglicherweise bereits")
        
        # Setze Passwort und Berechtigungen über psql
        psql_commands = [
            f"ALTER USER {DATABASE_USER} WITH PASSWORD '{DEFAULT_PASSWORD}';",
            f"ALTER USER {DATABASE_USER} CREATEDB;",
            f"GRANT ALL PRIVILEGES ON DATABASE {DATABASE_NAME} TO {DATABASE_USER};"
        ]
        
        for cmd in psql_commands:
            try:
                subprocess.check_call([
                    "sudo", "-u", "postgres", "psql", 
                    "-c", cmd
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except subprocess.CalledProcessError as e:
                print(f"⚠️ SQL-Befehl möglicherweise fehlgeschlagen: {cmd}")
        
        print(f"✅ Automatisches Setup abgeschlossen")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Automatisches Setup fehlgeschlagen")
        return False

def install_postgresql():
    """Installiert PostgreSQL auf Fedora"""
    print("🐘 Installiere PostgreSQL...")
    try:
        # Install PostgreSQL
        subprocess.check_call(["sudo", "dnf", "install", "-y", "postgresql", "postgresql-server", "postgresql-contrib"])
        
        print("✅ PostgreSQL erfolgreich installiert")
        
        # Initialize database (nur beim ersten Mal nötig)
        try:
            subprocess.check_call(["sudo", "postgresql-setup", "--initdb"])
            print("✅ PostgreSQL Datenbank initialisiert")
        except subprocess.CalledProcessError:
            # Kann fehlschlagen wenn bereits initialisiert
            print("ℹ️ PostgreSQL bereits initialisiert oder Initialisierung übersprungen")
        
        # Start PostgreSQL service
        subprocess.check_call(["sudo", "systemctl", "start", "postgresql"])
        subprocess.check_call(["sudo", "systemctl", "enable", "postgresql"])
        
        print("✅ PostgreSQL Service gestartet und aktiviert")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Fehler beim Installieren von PostgreSQL: {e}")
        print("Versuche manuell zu installieren mit:")
        print("sudo dnf install -y postgresql postgresql-server postgresql-contrib")
        print("sudo postgresql-setup --initdb")
        print("sudo systemctl start postgresql")
        print("sudo systemctl enable postgresql")
        sys.exit(1)

def setup_database():
    """Erstellt Datenbank und Benutzer"""
    print("🗄️ Richte Datenbank ein...")
    
    try:
        # Verbindung als postgres user
        conn = psycopg2.connect(
            host="localhost",
            database="postgres",
            user="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Erstelle Benutzer
        try:
            cursor.execute(f"CREATE USER {DATABASE_USER} WITH PASSWORD '{DEFAULT_PASSWORD}';")
            print(f"✅ Benutzer '{DATABASE_USER}' erstellt")
        except psycopg2.errors.DuplicateObject:
            print(f"ℹ️ Benutzer '{DATABASE_USER}' existiert bereits")
        
        # Erstelle Datenbank
        try:
            cursor.execute(f"CREATE DATABASE {DATABASE_NAME} OWNER {DATABASE_USER};")
            print(f"✅ Datenbank '{DATABASE_NAME}' erstellt")
        except psycopg2.errors.DuplicateDatabase:
            print(f"ℹ️ Datenbank '{DATABASE_NAME}' existiert bereits")
        
        # Gebe Berechtigungen
        cursor.execute(f"GRANT ALL PRIVILEGES ON DATABASE {DATABASE_NAME} TO {DATABASE_USER};")
        
        cursor.close()
        conn.close()
        
        print("✅ Datenbank-Setup abgeschlossen")
        
    except psycopg2.OperationalError:
        print("❌ Kann nicht als 'postgres' User verbinden.")
        print("Auf Fedora musst du möglicherweise zuerst den postgres User konfigurieren:")
        print()
        print("=== MANUELLE SCHRITTE ===")
        print("1. Führe folgende Befehle aus:")
        print(f"   sudo -u postgres createuser --login {DATABASE_USER}")
        print(f"   sudo -u postgres createdb -O {DATABASE_USER} {DATABASE_NAME}")
        print(f"   sudo -u postgres psql -c \"ALTER USER {DATABASE_USER} WITH PASSWORD '{DEFAULT_PASSWORD}';\"")
        print(f"   sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE {DATABASE_NAME} TO {DATABASE_USER};\"")
        print()
        print("2. Oder über psql:")
        print("   sudo -u postgres psql")
        print(f"   CREATE USER {DATABASE_USER} WITH PASSWORD '{DEFAULT_PASSWORD}';")
        print(f"   CREATE DATABASE {DATABASE_NAME} OWNER {DATABASE_USER};")
        print(f"   GRANT ALL PRIVILEGES ON DATABASE {DATABASE_NAME} TO {DATABASE_USER};")
        print("   \\q")
        print()
        
        response = input("Möchtest du es automatisch versuchen? (j/n): ")
        if response.lower() == 'j':
            success = try_fedora_setup()
            if success:
                # Konfiguriere Authentifizierung
                auth_success = configure_postgresql_auth()
                if not auth_success:
                    print("⚠️ Authentifizierung-Konfiguration fehlgeschlagen.")
                    print("Du musst möglicherweise manuell pg_hba.conf bearbeiten.")
            else:
                print("❌ Automatisches Setup fehlgeschlagen.")
                print("Bitte führe die manuellen Befehle oben aus und starte das Skript erneut.")
                sys.exit(1)
        else:
            print("Bitte führe die manuellen Befehle aus und starte das Skript erneut.")
            sys.exit(1)

def try_fedora_setup():
    """Versucht automatisches Setup für Fedora"""
    print("🔧 Versuche automatisches Fedora-Setup...")
    try:
        # Prüfe ob postgres User existiert und Service läuft
        subprocess.check_call(["sudo", "systemctl", "is-active", "postgresql"], 
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("✅ PostgreSQL Service läuft")
        
        # Erstelle Benutzer über createuser (ohne --createdb da das Probleme machen kann)
        try:
            subprocess.check_call([
                "sudo", "-u", "postgres", "createuser", 
                "--login", DATABASE_USER
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"✅ Benutzer '{DATABASE_USER}' erstellt")
        except subprocess.CalledProcessError:
            print(f"ℹ️ Benutzer '{DATABASE_USER}' existiert möglicherweise bereits")
        
        # Erstelle Datenbank
        try:
            subprocess.check_call([
                "sudo", "-u", "postgres", "createdb", 
                "-O", DATABASE_USER, DATABASE_NAME
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"✅ Datenbank '{DATABASE_NAME}' erstellt")
        except subprocess.CalledProcessError:
            print(f"ℹ️ Datenbank '{DATABASE_NAME}' existiert möglicherweise bereits")
        
        # Setze Passwort und Berechtigungen über psql
        psql_commands = [
            f"ALTER USER {DATABASE_USER} WITH PASSWORD '{DEFAULT_PASSWORD}';",
            f"ALTER USER {DATABASE_USER} CREATEDB;",
            f"GRANT ALL PRIVILEGES ON DATABASE {DATABASE_NAME} TO {DATABASE_USER};"
        ]
        
        for cmd in psql_commands:
            try:
                subprocess.check_call([
                    "sudo", "-u", "postgres", "psql", 
                    "-c", cmd
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except subprocess.CalledProcessError as e:
                print(f"⚠️ SQL-Befehl möglicherweise fehlgeschlagen: {cmd}")
        
        print(f"✅ Automatisches Setup abgeschlossen")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Automatisches Setup fehlgeschlagen")
        return False

def create_tables():
    """Erstellt die Tabellen-Struktur"""
    print("📋 Erstelle Tabellen...")
    
    # Warte kurz nach Authentifizierung-Konfiguration
    import time
    time.sleep(2)
    
    try:
        conn = psycopg2.connect(
            host="localhost",
            database=DATABASE_NAME,
            user=DATABASE_USER,
            password=DEFAULT_PASSWORD
        )
        cursor = conn.cursor()
        
        # Drinks Tabelle
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS drinks (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Users Tabelle
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                pin VARCHAR(4) NOT NULL,
                balance DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Transactions Tabelle (für consumption history)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                transaction_date TIMESTAMP NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                description TEXT,
                drink_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Admin Tabelle
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(255) UNIQUE NOT NULL,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Indizes erstellen
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Tabellen erfolgreich erstellt")
        
    except psycopg2.OperationalError as e:
        if "Ident-Authentifizierung" in str(e) or "ident authentication failed" in str(e):
            print("❌ Authentifizierungsfehler - pg_hba.conf muss angepasst werden")
            print()
            print("=== MANUELLE LÖSUNG ===")
            print("1. Bearbeite die PostgreSQL Konfiguration:")
            print("   sudo nano /var/lib/pgsql/data/pg_hba.conf")
            print()
            print("2. Füge diese Zeile am ANFANG der Datei hinzu:")
            print(f"   local   {DATABASE_NAME}    {DATABASE_USER}                     md5")
            print()
            print("3. PostgreSQL neu laden:")
            print("   sudo systemctl reload postgresql")
            print()
            print("4. Skript erneut ausführen")
            print()
            
            response = input("Soll ich versuchen, das automatisch zu beheben? (j/n): ")
            if response.lower() == 'j':
                if configure_postgresql_auth():
                    print("🔄 Versuche erneut Tabellen zu erstellen...")
                    time.sleep(2)
                    # Rekursiver Aufruf
                    create_tables()
                else:
                    sys.exit(1)
            else:
                sys.exit(1)
        else:
            print(f"❌ Fehler beim Erstellen der Tabellen: {e}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Fehler beim Erstellen der Tabellen: {e}")
        sys.exit(1)

def load_json_data():
    """Lädt die Daten aus data.json"""
    print("📂 Lade Daten aus data.json...")
    
    try:
        with open('data.json', 'r', encoding='utf-8') as file:
            data = json.load(file)
        print("✅ data.json erfolgreich geladen")
        return data
    except FileNotFoundError:
        print("❌ data.json nicht gefunden")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Fehler beim Parsen von data.json: {e}")
        sys.exit(1)

def migrate_drinks(data, cursor):
    """Migriert Getränke-Daten"""
    print("🥤 Migriere Getränke...")
    
    drinks = data.get('drinks', [])
    for drink in drinks:
        try:
            cursor.execute("""
                INSERT INTO drinks (name, price) 
                VALUES (%s, %s) 
                ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price
            """, (drink['name'], drink['price']))
        except Exception as e:
            print(f"⚠️ Fehler beim Migrieren von Getränk {drink['name']}: {e}")
    
    print(f"✅ {len(drinks)} Getränke migriert")

def migrate_users_and_transactions(data, cursor):
    """Migriert Benutzer und Transaktionen"""
    print("👥 Migriere Benutzer und Transaktionen...")
    
    users = data.get('users', [])
    total_transactions = 0
    
    for user in users:
        try:
            # Benutzer einfügen
            cursor.execute("""
                INSERT INTO users (username, pin, balance) 
                VALUES (%s, %s, %s) 
                ON CONFLICT (username) DO UPDATE SET 
                    pin = EXCLUDED.pin, 
                    balance = EXCLUDED.balance
            """, (user['username'], user['pin'], user.get('balance', 0)))
            
            # User ID abrufen
            cursor.execute("SELECT id FROM users WHERE username = %s", (user['username'],))
            user_id = cursor.fetchone()[0]
            
            # Transaktionen migrieren
            consumption = user.get('consumption', [])
            for transaction in consumption:
                try:
                    # Datum parsen
                    if 'date' in transaction:
                        trans_date = datetime.fromisoformat(transaction['date'].replace('Z', '+00:00'))
                    else:
                        trans_date = datetime.now()
                    
                    # Bestimme Getränkename für purchase transactions
                    drink_name = None
                    if transaction.get('type') == 'purchase':
                        drink_name = transaction.get('description')
                    
                    cursor.execute("""
                        INSERT INTO transactions 
                        (user_id, transaction_date, amount, transaction_type, description, drink_name) 
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        user_id,
                        trans_date,
                        transaction.get('amount', 0),
                        transaction.get('type', 'unknown'),
                        transaction.get('description', ''),
                        drink_name
                    ))
                    total_transactions += 1
                    
                except Exception as e:
                    print(f"⚠️ Fehler beim Migrieren einer Transaktion für {user['username']}: {e}")
                    
        except Exception as e:
            print(f"⚠️ Fehler beim Migrieren von Benutzer {user['username']}: {e}")
    
    print(f"✅ {len(users)} Benutzer und {total_transactions} Transaktionen migriert")

def migrate_admin_settings(data, cursor):
    """Migriert Admin-Einstellungen"""
    print("⚙️ Migriere Admin-Einstellungen...")
    
    admin = data.get('admin', {})
    
    for key, value in admin.items():
        try:
            cursor.execute("""
                INSERT INTO admin_settings (setting_key, setting_value) 
                VALUES (%s, %s) 
                ON CONFLICT (setting_key) DO UPDATE SET 
                    setting_value = EXCLUDED.setting_value,
                    updated_at = CURRENT_TIMESTAMP
            """, (key, str(value)))
        except Exception as e:
            print(f"⚠️ Fehler beim Migrieren der Admin-Einstellung {key}: {e}")
    
    print(f"✅ {len(admin)} Admin-Einstellungen migriert")

def migrate_data():
    """Führt die komplette Datenmigration durch"""
    print("🚀 Starte Datenmigration...")
    
    # Lade JSON-Daten
    data = load_json_data()
    
    try:
        # Verbindung zur Datenbank
        conn = psycopg2.connect(
            host="localhost",
            database=DATABASE_NAME,
            user=DATABASE_USER,
            password=DEFAULT_PASSWORD
        )
        cursor = conn.cursor()
        
        # Migriere alle Daten
        migrate_drinks(data, cursor)
        migrate_users_and_transactions(data, cursor)
        migrate_admin_settings(data, cursor)
        
        # Commit alle Änderungen
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Datenmigration erfolgreich abgeschlossen!")
        
    except Exception as e:
        print(f"❌ Fehler bei der Datenmigration: {e}")
        sys.exit(1)

def create_database_config():
    """Erstellt eine Konfigurationsdatei für die Node.js App"""
    print("📝 Erstelle Datenbank-Konfiguration...")
    
    config = {
        "database": {
            "host": "localhost",
            "port": 5432,
            "database": DATABASE_NAME,
            "user": DATABASE_USER,
            "password": DEFAULT_PASSWORD
        }
    }
    
    with open('database-config.json', 'w', encoding='utf-8') as file:
        json.dump(config, file, indent=2)
    
    print("✅ database-config.json erstellt")

def show_connection_info():
    """Zeigt Verbindungsinformationen an"""
    print("\n" + "="*50)
    print("🎉 MIGRATION ABGESCHLOSSEN!")
    print("="*50)
    print(f"Datenbank: {DATABASE_NAME}")
    print(f"Benutzer: {DATABASE_USER}")
    print(f"Passwort: {DEFAULT_PASSWORD}")
    print("Host: localhost")
    print("Port: 5432")
    print("\nVerbindungsstring:")
    print(f"postgresql://{DATABASE_USER}:{DEFAULT_PASSWORD}@localhost:5432/{DATABASE_NAME}")
    print("\nKonfigurationsdatei: database-config.json")
    print("="*50)

def main():
    """Hauptfunktion"""
    print("🐘 PostgreSQL Migration für Getränkekasse (Fedora)")
    print("=" * 50)
    
    # Prüfe ob wir im richtigen Verzeichnis sind
    if not os.path.exists('data.json'):
        print("❌ data.json nicht gefunden. Bitte führe das Skript im Projektverzeichnis aus.")
        sys.exit(1)
    
    try:
        # 1. Installiere Dependencies
        install_dependencies()
        
        # 2. Installiere PostgreSQL
        install_postgresql()
        
        # 3. Richte Datenbank ein
        setup_database()
        
        # 4. Erstelle Tabellen
        create_tables()
        
        # 5. Migriere Daten
        migrate_data()
        
        # 6. Erstelle Konfigurationsdatei
        create_database_config()
        
        # 7. Zeige Verbindungsinformationen
        show_connection_info()
        
    except KeyboardInterrupt:
        print("\n❌ Migration abgebrochen")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unerwarteter Fehler: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
