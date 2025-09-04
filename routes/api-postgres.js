/**
 * PostgreSQL-basierte API Routes für Getränkekasse
 * Verwendet DatabaseManager anstelle von JSON-Dateien
 */

const express = require('express');
const db = require('../database');
const router = express.Router();

// Limit für User-Kontostände
const MAX_USER_BALANCE = 150.00;

// Middleware zur Überprüfung der Datenbankverbindung (vereinfacht)
async function requireDatabase(req, res, next) {
    next();
}

// Hilfsfunktion für feste Dezimalstellen
function roundToTwoDecimals(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

// === LOGIN ===
router.post('/login', requireDatabase, async (req, res) => {
    console.log('[LOGIN] ========== LOGIN REQUEST ==========');
    console.log('[LOGIN] Request Body:', JSON.stringify(req.body, null, 2));
    
    const { username, pin } = req.body;
    
    // Validierung der Eingaben
    if (!username || !pin) {
        console.log('[LOGIN] ❌ Username oder PIN fehlt');
        return res.status(400).json({ error: 'Username und PIN sind erforderlich' });
    }
    
    if (typeof username !== 'string' || typeof pin !== 'string') {
        console.log('[LOGIN] ❌ Username oder PIN sind nicht vom Typ String');
        return res.status(400).json({ error: 'Username und PIN müssen Strings sein' });
    }
    
    if (pin.length !== 4) {
        console.log('[LOGIN] ❌ PIN hat nicht 4 Stellen:', pin.length);
        return res.status(400).json({ error: 'PIN muss 4 Stellen haben' });
    }
    
    try {
        console.log(`[LOGIN] Versuch für Username: "${username}", PIN: "${pin}"`);
        
        const isValid = await db.validateLogin(username, pin);
        
        if (isValid) {
            console.log(`[LOGIN] ✅ Erfolgreicher Login für User "${username}"`);
            res.json({ success: true });
        } else {
            console.log(`[LOGIN] ❌ Login fehlgeschlagen für User "${username}"`);
            res.status(401).json({ error: 'Login fehlgeschlagen' });
        }
        
    } catch (error) {
        console.error('[LOGIN] ❌ EXCEPTION:', error);
        res.status(500).json({ error: 'Server Fehler beim Login' });
    }
});

// === USER MANAGEMENT ===
router.get('/allusers', requireDatabase, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json(users);
    } catch (error) {
        console.error('[API] Fehler beim Laden der Benutzer:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
    }
});

router.post('/register', requireDatabase, async (req, res) => {
    const { username, pin, balance } = req.body;
    
    if (!username || !pin || pin.length !== 4) {
        return res.status(400).json({ error: 'Ungültige Eingabe' });
    }
    
    try {
        // Prüfe ob User bereits existiert
        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Nutzer existiert bereits' });
        }
        
        let startBalance = 0;
        if (typeof balance === 'number' && balance >= 0) {
            startBalance = Math.min(balance, MAX_USER_BALANCE);
        }
        
        await db.createUser(username, pin, startBalance);
        res.json({ success: true });
        
    } catch (error) {
        console.error('[API] Fehler bei der Registrierung:', error);
        res.status(500).json({ error: 'Fehler bei der Registrierung' });
    }
});

router.get('/balance/:username', requireDatabase, async (req, res) => {
    try {
        const balance = await db.getUserBalance(req.params.username);
        res.json({ balance: balance || 0 });
    } catch (error) {
        console.error('[API] Fehler beim Laden des Guthabens:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Guthabens' });
    }
});

router.post('/change-pin', requireDatabase, async (req, res) => {
    const { username, oldPin, newPin } = req.body;
    
    if (!username || !oldPin || !newPin || newPin.length !== 4 || oldPin.length !== 4) {
        return res.status(400).json({ error: 'Ungültige Eingabe' });
    }
    
    try {
        // Prüfe alten PIN
        const isValid = await db.validateLogin(username, oldPin);
        if (!isValid) {
            return res.status(403).json({ error: 'Alter PIN ist falsch.' });
        }
        
        await db.updateUserPin(username, newPin);
        res.json({ success: true });
        
    } catch (error) {
        console.error('[API] Fehler beim Ändern des PINs:', error);
        res.status(500).json({ error: 'Fehler beim Ändern des PINs' });
    }
});

router.post('/deleteuser', requireDatabase, async (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Kein Nutzer angegeben' });
    }
    
    try {
        const user = await db.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'Nutzer nicht gefunden' });
        }
        
        if ((user.balance || 0) < 0) {
            return res.status(400).json({ error: 'Account kann nicht gelöscht werden, wenn Guthaben im Minus ist.' });
        }
        
        await db.deleteUser(username);
        res.json({ success: true });
        
    } catch (error) {
        console.error('[API] Fehler beim Löschen des Benutzers:', error);
        res.status(500).json({ error: 'Fehler beim Löschen des Benutzers' });
    }
});

// === TRANSACTIONS ===
router.post('/deposit', requireDatabase, async (req, res) => {
    console.log('[DEPOSIT] ========== DEPOSIT REQUEST ==========');
    console.log('[DEPOSIT] Body:', JSON.stringify(req.body, null, 2));
    
    const { username, amount } = req.body;
    
    if (!username) {
        console.log('[DEPOSIT] ERROR: No username provided');
        return res.status(400).json({ error: 'Kein Username angegeben' });
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
        console.log('[DEPOSIT] ERROR: Invalid amount:', amount, 'type:', typeof amount);
        return res.status(400).json({ error: 'Ungültiger Betrag' });
    }
    
    const roundedAmount = roundToTwoDecimals(amount);
    
    try {
        const currentBalance = await db.getUserBalance(username);
        const newBalance = roundToTwoDecimals(currentBalance + roundedAmount);
        
        console.log('[DEPOSIT] Current balance:', currentBalance);
        console.log('[DEPOSIT] New balance would be:', newBalance);
        
        if (newBalance > MAX_USER_BALANCE) {
            const errorMsg = `LIMIT ÜBERSCHRITTEN! Maximum: ${MAX_USER_BALANCE}€, aktuell: ${currentBalance}€, nach Einzahlung: ${newBalance}€`;
            console.log('[DEPOSIT] ❌❌❌', errorMsg);
            return res.status(400).json({ error: errorMsg });
        }
        
        const finalBalance = await db.addTransaction(username, roundedAmount, 'deposit', 'Einzahlung');
        
        console.log('[DEPOSIT] ✅✅✅ SUCCESS! New balance:', finalBalance);
        res.json({ success: true, balance: finalBalance });
        
    } catch (error) {
        console.log('[DEPOSIT] ❌ EXCEPTION:', error);
        res.status(500).json({ error: 'Server Fehler: ' + error.message });
    }
});

router.post('/withdraw', requireDatabase, async (req, res) => {
    const { username, amount } = req.body;
    
    if (!username || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Ungültige Eingabe' });
    }
    
    try {
        const currentBalance = await db.getUserBalance(username);
        const newBalance = currentBalance - amount;
        
        if (newBalance < -10) {
            return res.status(400).json({ error: 'Kohle her' });
        }
        
        const finalBalance = await db.addTransaction(username, -amount, 'withdraw', 'Auszahlung');
        res.json({ success: true, balance: finalBalance });
        
    } catch (error) {
        console.error('[API] Fehler beim Auszahlen:', error);
        res.status(500).json({ error: 'Fehler beim Auszahlen' });
    }
});

router.post('/transfer', requireDatabase, async (req, res) => {
    console.log('[TRANSFER] Request received:', req.body);
    const { from, to, amount } = req.body;
    
    if (!from || !to || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Ungültige Eingabe' });
    }
    
    try {
        const senderBalance = await db.getUserBalance(from);
        const receiverBalance = await db.getUserBalance(to);
        
        // Sender-Guthaben prüfen
        const newSenderBalance = senderBalance - amount;
        if (newSenderBalance < -10) {
            return res.status(400).json({ error: 'Nicht genug Guthaben' });
        }
        
        // Empfänger-Limit prüfen
        const newReceiverBalance = roundToTwoDecimals(receiverBalance + amount);
        
        if (newReceiverBalance > MAX_USER_BALANCE) {
            const errorMsg = `Empfänger-Limit überschritten! Maximum: ${MAX_USER_BALANCE}€`;
            return res.status(400).json({ error: errorMsg });
        }
        
        // Transaktionen durchführen
        await db.addTransaction(from, -amount, 'transfer', `Gesendet an ${to}`);
        await db.addTransaction(to, amount, 'transfer', `Erhalten von ${from}`);
        
        const finalSenderBalance = await db.getUserBalance(from);
        
        console.log('[TRANSFER] ✅ Transfer successful');
        res.json({ success: true, balance: finalSenderBalance });
        
    } catch (error) {
        console.error('[API] Fehler bei der Überweisung:', error);
        res.status(500).json({ error: 'Fehler bei der Überweisung' });
    }
});

router.get('/consumption/:username', requireDatabase, async (req, res) => {
    try {
        const transactions = await db.getUserTransactions(req.params.username);
        res.json(transactions);
    } catch (error) {
        console.error('[API] Fehler beim Laden der Transaktionen:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Transaktionen' });
    }
});

// === DRINKS ===
router.get('/drinks', requireDatabase, async (req, res) => {
    try {
        const drinks = await db.getDrinks();
        res.json(drinks);
    } catch (error) {
        console.error('[API] Fehler beim Laden der Getränke:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Getränke' });
    }
});

router.post('/consume', requireDatabase, async (req, res) => {
    const { username, drink } = req.body;
    
    try {
        const user = await db.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'Nutzer nicht gefunden' });
        }
        
        const drinks = await db.getDrinks();
        const drinkObj = drinks.find(d => d.name === drink);
        if (!drinkObj) {
            return res.status(400).json({ error: 'Getränk nicht gefunden' });
        }
        
        const price = drinkObj.price;
        const newBalance = user.balance - price;
        
        if (newBalance < -10) {
            return res.status(400).json({ error: 'Kohle her' });
        }
        
        const finalBalance = await db.addTransaction(username, -price, 'purchase', drink, drink);
        res.json({ success: true, balance: finalBalance });
        
    } catch (error) {
        console.error('[API] Fehler beim Kauf:', error);
        res.status(500).json({ error: 'Fehler beim Kauf' });
    }
});

// === ADMIN ===
router.post('/admin/login', requireDatabase, async (req, res) => {
    const { password } = req.body;
    
    try {
        const adminPassword = await db.getAdminSetting('password');
        if (adminPassword !== password) {
            return res.status(401).json({ error: 'Falsches Passwort' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Fehler beim Admin-Login:', error);
        res.status(500).json({ error: 'Fehler beim Admin-Login' });
    }
});

router.post('/admin/password', requireDatabase, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    
    try {
        const adminPassword = await db.getAdminSetting('password');
        if (adminPassword !== oldPassword) {
            return res.status(401).json({ error: 'Falsches Passwort' });
        }
        
        await db.setAdminSetting('password', newPassword);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Fehler beim Passwort-Wechsel:', error);
        res.status(500).json({ error: 'Fehler beim Passwort-Wechsel' });
    }
});

router.get('/admin/drinks', requireDatabase, async (req, res) => {
    try {
        const drinks = await db.getDrinks();
        res.json(drinks);
    } catch (error) {
        console.error('[API] Fehler beim Laden der Admin-Getränke:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Admin-Getränke' });
    }
});

router.post('/admin/drinks', requireDatabase, async (req, res) => {
    const { name, price } = req.body;
    
    if (!name || typeof price !== 'number') {
        return res.status(400).json({ error: 'Ungültige Eingabe' });
    }
    
    try {
        await db.addDrink(name, price);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Fehler beim Hinzufügen des Getränks:', error);
        res.status(500).json({ error: 'Fehler beim Hinzufügen des Getränks' });
    }
});

router.delete('/admin/drinks/:name', requireDatabase, async (req, res) => {
    try {
        const success = await db.deleteDrink(req.params.name);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Getränk nicht gefunden' });
        }
    } catch (error) {
        console.error('[API] Fehler beim Löschen des Getränks:', error);
        res.status(500).json({ error: 'Fehler beim Löschen des Getränks' });
    }
});

// Update drink (for bulk updates)
router.put('/admin/drinks', requireDatabase, async (req, res) => {
    try {
        const { drinks } = req.body;
        if (!drinks || !Array.isArray(drinks)) {
            return res.status(400).json({ error: 'Ungültige Getränke-Daten' });
        }
        
        // Update each drink
        for (const drink of drinks) {
            if (!drink.id || !drink.name || drink.price === undefined) {
                return res.status(400).json({ error: 'Unvollständige Getränke-Daten' });
            }
            await db.updateDrink(drink.id, drink.name, drink.price);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Fehler beim Aktualisieren der Getränke:', error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Getränke' });
    }
});

// Delete drink by ID
router.delete('/admin/drinks/id/:id', requireDatabase, async (req, res) => {
    try {
        const success = await db.deleteDrinkById(req.params.id);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Getränk nicht gefunden' });
        }
    } catch (error) {
        console.error('[API] Fehler beim Löschen des Getränks:', error);
        res.status(500).json({ error: 'Fehler beim Löschen des Getränks' });
    }
});

// Barcode endpoints
router.put('/admin/drinks/:id/barcode', requireDatabase, async (req, res) => {
    try {
        const { barcode } = req.body;
        if (!barcode) {
            return res.status(400).json({ error: 'Barcode ist erforderlich' });
        }
        
        const success = await db.updateDrinkBarcode(req.params.id, barcode);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Getränk nicht gefunden' });
        }
    } catch (error) {
        console.error('[API] Fehler beim Aktualisieren des Barcodes:', error);
        if (error.code === '23505') {
            res.status(400).json({ error: 'Barcode bereits vergeben' });
        } else {
            res.status(500).json({ error: 'Fehler beim Aktualisieren des Barcodes' });
        }
    }
});

router.get('/drinks/barcode/:barcode', requireDatabase, async (req, res) => {
    try {
        const drink = await db.getDrinkByBarcode(req.params.barcode);
        if (drink) {
            res.json(drink);
        } else {
            res.status(404).json({ error: 'Getränk mit diesem Barcode nicht gefunden' });
        }
    } catch (error) {
        console.error('[API] Fehler beim Suchen nach Barcode:', error);
        res.status(500).json({ error: 'Fehler beim Suchen nach Barcode' });
    }
});

// Timer-Status
router.get('/admin/timer-status', requireDatabase, async (req, res) => {
    try {
        const timersDisabled = await db.getAdminSetting('timersDisabled') === 'true';
        res.json({ timersDisabled });
    } catch (error) {
        console.error('[API] Fehler beim Laden des Timer-Status:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Timer-Status' });
    }
});

router.post('/admin/timer-toggle', requireDatabase, async (req, res) => {
    try {
        const currentStatus = await db.getAdminSetting('timersDisabled') === 'true';
        const newStatus = !currentStatus;
        
        await db.setAdminSetting('timersDisabled', String(newStatus));
        res.json({ success: true, timersDisabled: newStatus });
    } catch (error) {
        console.error('[API] Fehler beim Timer-Toggle:', error);
        res.status(500).json({ error: 'Fehler beim Timer-Toggle' });
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[API] Schließe Datenbankverbindung...');
    await db.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[API] Schließe Datenbankverbindung...');
    await db.disconnect();
    process.exit(0);
});

module.exports = router;
