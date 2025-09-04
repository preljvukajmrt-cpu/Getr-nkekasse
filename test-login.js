// Test der Login-Logik ohne Server
const fs = require('fs');

// Hilfsfunktion zum Lesen der Daten (kopiert aus api.js)
function readData() {
  try {
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    return data;
  } catch (err) {
    console.error('Fehler beim Lesen der data.json:', err);
    return { drinks: [], users: [], admin: { password: "9999" } };
  }
}

// Test der Login-Logik
function testLogin(username, pin) {
  console.log(`\n=== LOGIN TEST für "${username}" mit PIN "${pin}" ===`);
  
  // Validierung der Eingaben
  if (!username || !pin) {
    console.log('❌ Username oder PIN fehlt');
    return { error: 'Username und PIN sind erforderlich' };
  }
  
  if (typeof username !== 'string' || typeof pin !== 'string') {
    console.log('❌ Username oder PIN sind nicht vom Typ String');
    return { error: 'Username und PIN müssen Strings sein' };
  }
  
  if (pin.length !== 4) {
    console.log('❌ PIN hat nicht 4 Stellen:', pin.length);
    return { error: 'PIN muss 4 Stellen haben' };
  }
  
  try {
    const data = readData();
    console.log(`Anzahl User in Datenbank: ${data.users ? data.users.length : 0}`);
    
    // Debug: Zeige alle verfügbaren Usernames
    if (data.users) {
      console.log('Verfügbare Users:', data.users.map(u => `"${u.username}" (PIN: "${u.pin}")`));
    }
    
    // User suchen (case-sensitive)
    const user = data.users ? data.users.find(u => u.username === username) : null;
    if (!user) {
      console.log(`❌ User "${username}" nicht gefunden`);
      return { error: 'Login fehlgeschlagen' };
    }
    
    console.log(`✅ User gefunden: "${user.username}", gespeicherter PIN: "${user.pin}"`);
    
    // PIN prüfen (string comparison)
    if (user.pin !== pin) {
      console.log(`❌ Falscher PIN für User "${username}". Eingabe: "${pin}", Erwartet: "${user.pin}"`);
      return { error: 'Login fehlgeschlagen' };
    }
    
    console.log(`✅ Erfolgreicher Login für User "${username}"`);
    return { success: true };
    
  } catch (error) {
    console.error('❌ EXCEPTION:', error);
    return { error: 'Server Fehler beim Login' };
  }
}

// Führe Tests durch
console.log('=== LOGIN ROUTINE TEST ===');

// Test mit bekannten Usern aus data.json
testLogin('test1', '1111');
testLogin('test2', '2222');
testLogin('test3', '3333');

// Fehlerhafte Tests
testLogin('test1', '9999'); // Falscher PIN
testLogin('nonexistent', '1111'); // User existiert nicht
testLogin('test1', '111'); // PIN zu kurz
testLogin('', '1111'); // Leerer Username
testLogin('test1', ''); // Leerer PIN

console.log('\n=== TEST ABGESCHLOSSEN ===');
