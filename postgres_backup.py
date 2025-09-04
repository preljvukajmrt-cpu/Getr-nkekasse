#!/usr/bin/env python3
"""
Backup und Restore Skript für PostgreSQL Getränkekasse
"""

import json
import subprocess
import sys
import os
import argparse
from datetime import datetime
import psycopg2

# Konfiguration
DATABASE_NAME = "getraenkekasse"
DATABASE_USER = "getraenkekasse_user"
DEFAULT_PASSWORD = "getraenkekasse_password_2025"

def load_database_config():
    """Lädt die Datenbank-Konfiguration"""
    try:
        with open('database-config.json', 'r') as file:
            config = json.load(file)
            return config['database']
    except FileNotFoundError:
        return {
            'host': 'localhost',
            'port': 5432,
            'database': DATABASE_NAME,
            'user': DATABASE_USER,
            'password': DEFAULT_PASSWORD
        }

def create_backup():
    """Erstellt ein SQL-Backup der Datenbank"""
    config = load_database_config()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = f"backup_getraenkekasse_{timestamp}.sql"
    
    print(f"🗄️ Erstelle Backup: {backup_file}")
    
    try:
        # Umgebungsvariable für Passwort setzen
        env = os.environ.copy()
        env['PGPASSWORD'] = config['password']
        
        # pg_dump ausführen
        subprocess.check_call([
            'pg_dump',
            '-h', config['host'],
            '-p', str(config['port']),
            '-U', config['user'],
            '-d', config['database'],
            '-f', backup_file,
            '--no-password'
        ], env=env)
        
        print(f"✅ Backup erfolgreich erstellt: {backup_file}")
        return backup_file
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Fehler beim Erstellen des Backups: {e}")
        return None
    except FileNotFoundError:
        print("❌ pg_dump nicht gefunden. Bitte PostgreSQL Client Tools installieren.")
        return None

def restore_backup(backup_file):
    """Stellt ein Backup wieder her"""
    if not os.path.exists(backup_file):
        print(f"❌ Backup-Datei nicht gefunden: {backup_file}")
        return False
    
    config = load_database_config()
    
    print(f"🔄 Stelle Backup wieder her: {backup_file}")
    print("⚠️ WARNUNG: Alle aktuellen Daten werden überschrieben!")
    
    response = input("Fortfahren? (j/N): ")
    if response.lower() != 'j':
        print("Abgebrochen.")
        return False
    
    try:
        # Umgebungsvariable für Passwort setzen
        env = os.environ.copy()
        env['PGPASSWORD'] = config['password']
        
        # Datenbank leeren und wiederherstellen
        subprocess.check_call([
            'psql',
            '-h', config['host'],
            '-p', str(config['port']),
            '-U', config['user'],
            '-d', config['database'],
            '-f', backup_file,
            '--no-password'
        ], env=env)
        
        print(f"✅ Backup erfolgreich wiederhergestellt: {backup_file}")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Fehler beim Wiederherstellen des Backups: {e}")
        return False

def export_to_json():
    """Exportiert die Datenbank zurück ins JSON-Format"""
    config = load_database_config()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    json_file = f"export_data_{timestamp}.json"
    
    print(f"📤 Exportiere Daten nach JSON: {json_file}")
    
    try:
        # Verbindung zur Datenbank
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            database=config['database'],
            user=config['user'],
            password=config['password']
        )
        cursor = conn.cursor()
        
        # Datenstruktur erstellen
        data = {
            "drinks": [],
            "users": [],
            "admin": {}
        }
        
        # Getränke exportieren
        cursor.execute("SELECT name, price FROM drinks ORDER BY name")
        for row in cursor.fetchall():
            data["drinks"].append({
                "name": row[0],
                "price": float(row[1])
            })
        
        # Benutzer exportieren
        cursor.execute("SELECT id, username, pin, balance FROM users ORDER BY username")
        users_data = cursor.fetchall()
        
        for user_row in users_data:
            user_id, username, pin, balance = user_row
            
            # Transaktionen für diesen Benutzer laden
            cursor.execute("""
                SELECT transaction_date, amount, transaction_type, description, drink_name
                FROM transactions 
                WHERE user_id = %s 
                ORDER BY transaction_date
            """, (user_id,))
            
            consumption = []
            for trans_row in cursor.fetchall():
                trans_date, amount, trans_type, description, drink_name = trans_row
                
                transaction = {
                    "date": trans_date.isoformat() + "Z",
                    "amount": float(amount),
                    "type": trans_type,
                    "description": description or ""
                }
                
                # Für alte Kompatibilität: drink-Feld für alte Transaktionen
                if trans_type == "purchase" and drink_name:
                    transaction["drink"] = drink_name
                
                consumption.append(transaction)
            
            data["users"].append({
                "username": username,
                "pin": pin,
                "consumption": consumption,
                "balance": float(balance) if balance else 0
            })
        
        # Admin-Einstellungen exportieren
        cursor.execute("SELECT setting_key, setting_value FROM admin_settings")
        for row in cursor.fetchall():
            key, value = row
            # Versuche boolean/numeric Werte zu konvertieren
            if value.lower() in ['true', 'false']:
                data["admin"][key] = value.lower() == 'true'
            elif value.isdigit():
                data["admin"][key] = int(value)
            else:
                try:
                    data["admin"][key] = float(value)
                except ValueError:
                    data["admin"][key] = value
        
        cursor.close()
        conn.close()
        
        # JSON-Datei schreiben
        with open(json_file, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=2, ensure_ascii=False)
        
        print(f"✅ JSON-Export erfolgreich: {json_file}")
        print(f"📊 Exportiert: {len(data['drinks'])} Getränke, {len(data['users'])} Benutzer")
        
        return json_file
        
    except Exception as e:
        print(f"❌ Fehler beim JSON-Export: {e}")
        return None

def show_database_stats():
    """Zeigt Statistiken über die Datenbank"""
    config = load_database_config()
    
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            database=config['database'],
            user=config['user'],
            password=config['password']
        )
        cursor = conn.cursor()
        
        print("📊 DATENBANK STATISTIKEN")
        print("=" * 30)
        
        # Benutzer-Statistiken
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"👥 Benutzer: {user_count}")
        
        cursor.execute("SELECT SUM(balance) FROM users")
        total_balance = cursor.fetchone()[0] or 0
        print(f"💰 Gesamtguthaben: {float(total_balance):.2f}€")
        
        # Getränke-Statistiken
        cursor.execute("SELECT COUNT(*) FROM drinks")
        drink_count = cursor.fetchone()[0]
        print(f"🥤 Getränke: {drink_count}")
        
        # Transaktions-Statistiken
        cursor.execute("SELECT COUNT(*) FROM transactions")
        trans_count = cursor.fetchone()[0]
        print(f"📋 Transaktionen: {trans_count}")
        
        cursor.execute("""
            SELECT transaction_type, COUNT(*) 
            FROM transactions 
            GROUP BY transaction_type 
            ORDER BY COUNT(*) DESC
        """)
        print("\n📈 Transaktionstypen:")
        for trans_type, count in cursor.fetchall():
            print(f"  {trans_type}: {count}")
        
        # Top Getränke
        cursor.execute("""
            SELECT drink_name, COUNT(*) as purchases
            FROM transactions 
            WHERE transaction_type = 'purchase' AND drink_name IS NOT NULL
            GROUP BY drink_name 
            ORDER BY purchases DESC 
            LIMIT 5
        """)
        top_drinks = cursor.fetchall()
        if top_drinks:
            print("\n🏆 Top Getränke:")
            for drink, count in top_drinks:
                print(f"  {drink}: {count}x")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Fehler beim Laden der Statistiken: {e}")

def main():
    parser = argparse.ArgumentParser(description='PostgreSQL Backup/Restore für Getränkekasse')
    parser.add_argument('action', choices=['backup', 'restore', 'export', 'stats'], 
                       help='Aktion: backup, restore, export oder stats')
    parser.add_argument('--file', help='Backup-Datei für restore')
    
    args = parser.parse_args()
    
    if args.action == 'backup':
        create_backup()
    elif args.action == 'restore':
        if not args.file:
            print("❌ Backup-Datei mit --file angeben")
            sys.exit(1)
        restore_backup(args.file)
    elif args.action == 'export':
        export_to_json()
    elif args.action == 'stats':
        show_database_stats()

if __name__ == "__main__":
    main()
