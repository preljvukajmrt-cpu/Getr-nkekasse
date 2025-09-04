/**
 * PostgreSQL Database Manager für Getränkekasse
 * Handles all database operations with connection pooling
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            const configPath = path.join(__dirname, 'database-config.json');
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            // Fallback auf einfache Konfiguration
            return {
                host: config.database?.host || 'localhost',
                port: config.database?.port || 5432,
                database: config.database?.database || 'getraenkekasse',
                user: config.database?.user || 'getraenkekasse_user',
                password: config.database?.password || 'getraenkekasse_password_2025'
            };
        } catch (error) {
            console.warn('[DB] Keine database-config.json gefunden, verwende Defaults');
            return {
                host: 'localhost',
                port: 5432,
                database: 'getraenkekasse',
                user: 'getraenkekasse_user',
                password: 'getraenkekasse_password_2025'
            };
        }
    }

    async connect() {
        if (this.pool) {
            return;
        }

        try {
            console.log('[DB] Verbinde mit PostgreSQL...');
            console.log(`[DB] Host: ${this.config.host}:${this.config.port}`);
            console.log(`[DB] Database: ${this.config.database}`);
            console.log(`[DB] User: ${this.config.user}`);

            this.pool = new Pool({
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            // Test Verbindung
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            console.log('[DB] ✅ PostgreSQL Verbindung erfolgreich');
        } catch (error) {
            console.error('[DB] ❌ PostgreSQL Verbindungsfehler:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            console.log('[DB] PostgreSQL Verbindung geschlossen');
        }
    }

    // === USER MANAGEMENT ===
    async getAllUsers() {
        const query = 'SELECT username, balance FROM users ORDER BY username';
        const result = await this.pool.query(query);
        return result.rows.map(row => ({
            username: row.username,
            balance: parseFloat(row.balance || 0)
        }));
    }

    async getUserByUsername(username) {
        const query = 'SELECT id, username, pin, balance FROM users WHERE username = $1';
        const result = await this.pool.query(query, [username]);
        return result.rows[0] || null;
    }

    async getUserBalance(username) {
        const query = 'SELECT balance FROM users WHERE username = $1';
        const result = await this.pool.query(query, [username]);
        const balance = result.rows[0]?.balance || 0;
        return parseFloat(balance);
    }

    async createUser(username, pin, balance = 0) {
        const query = `
            INSERT INTO users (username, pin, balance) 
            VALUES ($1, $2, $3) 
            RETURNING id
        `;
        const result = await this.pool.query(query, [username, pin, balance]);
        return result.rows[0].id;
    }

    async updateUserPin(username, newPin) {
        const query = 'UPDATE users SET pin = $1 WHERE username = $2';
        await this.pool.query(query, [newPin, username]);
    }

    async deleteUser(username) {
        const query = 'DELETE FROM users WHERE username = $1';
        await this.pool.query(query, [username]);
    }

    async validateLogin(username, pin) {
        const query = 'SELECT id FROM users WHERE username = $1 AND pin = $2';
        const result = await this.pool.query(query, [username, pin]);
        return result.rows.length > 0;
    }

    // === TRANSACTIONS ===
    async addTransaction(username, amount, type, description, drinkName = null) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');

            // Get user ID and current balance
            const userQuery = 'SELECT id, balance FROM users WHERE username = $1';
            const userResult = await client.query(userQuery, [username]);
            
            if (userResult.rows.length === 0) {
                throw new Error(`User ${username} not found`);
            }

            const user = userResult.rows[0];
            const newBalance = parseFloat(user.balance) + parseFloat(amount);

            // Update user balance
            const updateQuery = 'UPDATE users SET balance = $1 WHERE id = $2';
            await client.query(updateQuery, [newBalance, user.id]);

            // Insert transaction record
            const transQuery = `
                INSERT INTO transactions 
                (user_id, transaction_date, amount, transaction_type, description, drink_name) 
                VALUES ($1, NOW(), $2, $3, $4, $5)
            `;
            await client.query(transQuery, [user.id, amount, type, description, drinkName]);

            await client.query('COMMIT');
            return newBalance;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getUserTransactions(username) {
        const query = `
            SELECT t.transaction_date as date, t.amount, t.transaction_type as type, 
                   t.description, t.drink_name
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE u.username = $1
            ORDER BY t.transaction_date DESC
        `;
        const result = await this.pool.query(query, [username]);
        
        // Format für Frontend-Kompatibilität
        return result.rows.map(row => ({
            date: row.date.toISOString(),
            amount: parseFloat(row.amount),
            type: row.type,
            description: row.description
        }));
    }

    // === DRINKS ===
    async getDrinks() {
        const query = 'SELECT id, name, price FROM drinks ORDER BY name';
        const result = await this.pool.query(query);
        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            price: parseFloat(row.price)
        }));
    }

    async addDrink(name, price) {
        const query = 'INSERT INTO drinks (name, price) VALUES ($1, $2)';
        await this.pool.query(query, [name, price]);
    }

    async deleteDrink(name) {
        const query = 'DELETE FROM drinks WHERE name = $1';
        const result = await this.pool.query(query, [name]);
        return result.rowCount > 0;
    }

    async updateDrink(id, name, price) {
        const query = 'UPDATE drinks SET name = $1, price = $2 WHERE id = $3';
        const result = await this.pool.query(query, [name, price, id]);
        return result.rowCount > 0;
    }

    async deleteDrinkById(id) {
        const query = 'DELETE FROM drinks WHERE id = $1';
        const result = await this.pool.query(query, [id]);
        return result.rowCount > 0;
    }

    // === ADMIN SETTINGS ===
    async getAdminSetting(key) {
        const query = 'SELECT setting_value FROM admin_settings WHERE setting_key = $1';
        const result = await this.pool.query(query, [key]);
        return result.rows[0]?.setting_value || null;
    }

    async setAdminSetting(key, value) {
        const query = `
            INSERT INTO admin_settings (setting_key, setting_value) 
            VALUES ($1, $2) 
            ON CONFLICT (setting_key) 
            DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
        `;
        await this.pool.query(query, [key, value]);
    }
}

// Singleton instance
const db = new DatabaseManager();

// Export wrapper functions for backward compatibility
module.exports = {
    // Connection management
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),

    // User operations
    getAllUsers: () => db.getAllUsers(),
    getUserByUsername: (username) => db.getUserByUsername(username),
    getUserBalance: (username) => db.getUserBalance(username),
    createUser: (username, pin, balance) => db.createUser(username, pin, balance),
    updateUserPin: (username, newPin) => db.updateUserPin(username, newPin),
    deleteUser: (username) => db.deleteUser(username),
    validateLogin: (username, pin) => db.validateLogin(username, pin),

    // Transaction operations
    addTransaction: (username, amount, type, description, drinkName) => 
        db.addTransaction(username, amount, type, description, drinkName),
    getUserTransactions: (username) => db.getUserTransactions(username),

    // Drink operations
    getDrinks: () => db.getDrinks(),
    addDrink: (name, price) => db.addDrink(name, price),
    deleteDrink: (name) => db.deleteDrink(name),
    updateDrink: (id, name, price) => db.updateDrink(id, name, price),
    deleteDrinkById: (id) => db.deleteDrinkById(id),

    // Admin operations
    getAdminSetting: (key) => db.getAdminSetting(key),
    setAdminSetting: (key, value) => db.setAdminSetting(key, value)
};
