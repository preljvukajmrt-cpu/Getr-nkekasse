#!/usr/bin/env python3
"""
Migriere Daten aus data_backup_20250904_212147.json in PostgreSQL
"""

import json
import psycopg2
from datetime import datetime
import sys

# Konfiguration
DATABASE_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'getraenkekasse',
    'user': 'getraenkekasse_user',
    'password': 'getraenkekasse_password_2025'
}

def load_backup_data():
    """Lädt die Backup-Daten"""
    with open('data_backup_20250904_212147.json', 'r', encoding='utf-8') as file:
        return json.load(file)

def migrate_drinks(data, cursor):
    """Migriert Getränke"""
    print("🥤 Migriere Getränke...")
    drinks = data.get('drinks', [])
    
    for drink in drinks:
        cursor.execute("""
            INSERT INTO drinks (name, price) 
            VALUES (%s, %s) 
            ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price
        """, (drink['name'], drink['price']))
    
    print(f"✅ {len(drinks)} Getränke migriert")

def migrate_users_and_transactions(data, cursor):
    """Migriert Benutzer und Transaktionen"""
    print("👥 Migriere Benutzer und Transaktionen...")
    users = data.get('users', [])
    total_transactions = 0
    
    for user in users:
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
                print(f"⚠️ Fehler bei Transaktion für {user['username']}: {e}")
    
    print(f"✅ {len(users)} Benutzer und {total_transactions} Transaktionen migriert")

def migrate_admin_settings(data, cursor):
    """Migriert Admin-Einstellungen"""
    print("⚙️ Migriere Admin-Einstellungen...")
    admin = data.get('admin', {})
    
    for key, value in admin.items():
        cursor.execute("""
            INSERT INTO admin_settings (setting_key, setting_value) 
            VALUES (%s, %s) 
            ON CONFLICT (setting_key) DO UPDATE SET 
                setting_value = EXCLUDED.setting_value,
                updated_at = NOW()
        """, (key, str(value)))
    
    print(f"✅ {len(admin)} Admin-Einstellungen migriert")

def main():
    """Hauptfunktion"""
    print("🚀 Starte Datenmigration nach PostgreSQL...")
    
    try:
        # Daten laden
        data = load_backup_data()
        print("📂 Backup-Daten geladen")
        
        # Verbindung zur Datenbank
        conn = psycopg2.connect(**DATABASE_CONFIG)
        cursor = conn.cursor()
        print("🔗 Mit PostgreSQL verbunden")
        
        # Migriere alle Daten
        migrate_drinks(data, cursor)
        migrate_users_and_transactions(data, cursor)
        migrate_admin_settings(data, cursor)
        
        # Commit alle Änderungen
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Datenmigration erfolgreich abgeschlossen!")
        
        # Zeige Statistiken
        conn = psycopg2.connect(**DATABASE_CONFIG)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM drinks")
        drink_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM transactions")
        transaction_count = cursor.fetchone()[0]
        
        print(f"\n📊 Migrierte Daten:")
        print(f"👥 Benutzer: {user_count}")
        print(f"🥤 Getränke: {drink_count}")
        print(f"💳 Transaktionen: {transaction_count}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Fehler bei der Migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
