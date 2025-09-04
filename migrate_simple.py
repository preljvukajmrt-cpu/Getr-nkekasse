#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vereinfachte PostgreSQL Migration für Getränkekasse
Verwendet Unix-Socket Verbindungen
"""

import json
import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib
from datetime import datetime

# Konfiguration
DATABASE_NAME = "getraenkekasse"
DATABASE_USER = "getraenkekasse_user"

def load_data():
    """Lädt die JSON-Daten"""
    print("📁 Lade data.json...")
    
    if not os.path.exists('data.json'):
        print("❌ data.json nicht gefunden")
        return None
        
    with open('data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"✅ {len(data.get('users', []))} Benutzer geladen")
    print(f"✅ {len(data.get('transactions', []))} Transaktionen geladen")
    
    return data

def create_tables():
    """Erstellt die Tabellen-Struktur"""
    print("📋 Erstelle Tabellen...")
    
    try:
        conn = psycopg2.connect(
            database=DATABASE_NAME,
            user=DATABASE_USER
        )
        cursor = conn.cursor()
        
        # Tabellen erstellen
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                pin_hash VARCHAR(255) NOT NULL,
                balance DECIMAL(10,2) DEFAULT 0.00,
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                item_name VARCHAR(255),
                timestamp TIMESTAMP NOT NULL,
                note TEXT,
                FOREIGN KEY (username) REFERENCES users(username)
            );
        """)
        
        # Indizes für bessere Performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_username ON transactions(username);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Tabellen erfolgreich erstellt")
        return True
        
    except Exception as e:
        print(f"❌ Fehler beim Erstellen der Tabellen: {e}")
        return False

def migrate_users(data):
    """Migriert Benutzer zur PostgreSQL"""
    print("👥 Migriere Benutzer...")
    
    users = data.get('users', [])
    if not users:
        print("⚠️ Keine Benutzer zum Migrieren gefunden")
        return True
    
    try:
        conn = psycopg2.connect(
            database=DATABASE_NAME,
            user=DATABASE_USER
        )
        cursor = conn.cursor()
        
        for user in users:
            # Bestimme displayName
            display_name = user.get('displayName', user.get('username', 'Unbekannt'))
            
            # Bestimme PIN hash
            pin_hash = user.get('pinHash', user.get('pin', ''))
            if not pin_hash.startswith('$'):  # Falls es noch nicht gehashed ist
                pin_hash = hashlib.sha256(pin_hash.encode()).hexdigest()
            
            cursor.execute("""
                INSERT INTO users (username, display_name, pin_hash, balance, role)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (username) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    pin_hash = EXCLUDED.pin_hash,
                    balance = EXCLUDED.balance,
                    role = EXCLUDED.role
            """, (
                user['username'],
                display_name,
                pin_hash,
                float(user.get('balance', 0.0)),
                user.get('role', 'user')
            ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ {len(users)} Benutzer erfolgreich migriert")
        return True
        
    except Exception as e:
        print(f"❌ Fehler beim Migrieren der Benutzer: {e}")
        return False

def migrate_transactions(data):
    """Migriert Transaktionen zur PostgreSQL"""
    print("💰 Migriere Transaktionen...")
    
    transactions = data.get('transactions', [])
    if not transactions:
        print("⚠️ Keine Transaktionen zum Migrieren gefunden")
        return True
    
    try:
        conn = psycopg2.connect(
            database=DATABASE_NAME,
            user=DATABASE_USER
        )
        cursor = conn.cursor()
        
        for trans in transactions:
            timestamp = datetime.fromisoformat(trans['timestamp'].replace('Z', '+00:00'))
            
            cursor.execute("""
                INSERT INTO transactions (username, transaction_type, amount, item_name, timestamp, note)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                trans['username'],
                trans['type'],
                float(trans['amount']),
                trans.get('itemName'),
                timestamp,
                trans.get('note')
            ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ {len(transactions)} Transaktionen erfolgreich migriert")
        return True
        
    except Exception as e:
        print(f"❌ Fehler beim Migrieren der Transaktionen: {e}")
        return False

def verify_migration():
    """Überprüft die Migration"""
    print("🔍 Überprüfe Migration...")
    
    try:
        conn = psycopg2.connect(
            database=DATABASE_NAME,
            user=DATABASE_USER
        )
        cursor = conn.cursor()
        
        # Anzahl Benutzer
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        # Anzahl Transaktionen
        cursor.execute("SELECT COUNT(*) FROM transactions")
        trans_count = cursor.fetchone()[0]
        
        # Gesamtsaldo
        cursor.execute("SELECT SUM(balance) FROM users")
        total_balance = cursor.fetchone()[0] or 0
        
        cursor.close()
        conn.close()
        
        print(f"✅ {user_count} Benutzer in der Datenbank")
        print(f"✅ {trans_count} Transaktionen in der Datenbank")
        print(f"✅ Gesamtsaldo: {total_balance:.2f}€")
        
        return True
        
    except Exception as e:
        print(f"❌ Fehler bei der Überprüfung: {e}")
        return False

def create_backup():
    """Erstellt ein Backup der JSON-Datei"""
    if os.path.exists('data.json'):
        backup_name = f"data_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        os.rename('data.json', backup_name)
        print(f"💾 Backup erstellt: {backup_name}")

def main():
    print("🐘 Vereinfachte PostgreSQL Migration")
    print("=====================================")
    
    # 1. Lade JSON-Daten
    data = load_data()
    if not data:
        return False
    
    # 2. Erstelle Tabellen
    if not create_tables():
        return False
    
    # 3. Migriere Benutzer
    if not migrate_users(data):
        return False
    
    # 4. Migriere Transaktionen
    if not migrate_transactions(data):
        return False
    
    # 5. Überprüfe Migration
    if not verify_migration():
        return False
    
    # 6. Erstelle Backup der JSON-Datei
    create_backup()
    
    print("\n🎉 Migration erfolgreich abgeschlossen!")
    print("\nNächste Schritte:")
    print("1. Teste die Anwendung mit: node app.js")
    print("2. Verwende routes/api-postgres.js statt routes/api.js")
    print("3. Die JSON-Datei wurde als Backup gesichert")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
