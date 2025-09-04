// PIN ändern mit modalen Dialogen
$("change-pin-btn").onclick = async function() {
	const username = window.localStorage.getItem("username");
	if (!username) return;
	const oldPin = await showPinModal("Bitte alten 4-stelligen PIN eingeben:");
	if (!oldPin || oldPin.length !== 4) {
		alert("Bitte einen gültigen alten 4-stelligen PIN eingeben.");
		return;
	}
	const newPin = await showPinModal("Neuen 4-stelligen PIN eingeben:");
	if (!newPin || newPin.length !== 4) {
		alert("Bitte einen gültigen neuen 4-stelligen PIN eingeben.");
		return;
	}
	const res = await fetch('/api/change-pin', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, oldPin, newPin })
	});
	const data = await res.json();
	if (data.success) {
		alert("PIN erfolgreich geändert.");
	} else {
		alert(data.error || "Fehler beim Ändern des PIN.");
	}
};

// Modaler Dialog für PIN-Eingabe (type=password)
function showPinModal(labelText) {
	return new Promise(resolve => {
		const bg = document.getElementById("pin-modal-bg");
		const label = document.getElementById("pin-modal-label");
		const input = document.getElementById("pin-modal-input");
		const ok = document.getElementById("pin-modal-ok");
		const cancel = document.getElementById("pin-modal-cancel");
		label.textContent = labelText;
		input.value = "";
		bg.style.display = "flex";
		input.focus();
		function close(val) {
			bg.style.display = "none";
			ok.removeEventListener("click", okHandler);
			cancel.removeEventListener("click", cancelHandler);
			input.removeEventListener("keydown", keyHandler);
			resolve(val);
		}
		function okHandler() { close(input.value); }
		function cancelHandler() { close(null); }
		function keyHandler(e) {
			if (e.key === "Enter") okHandler();
			if (e.key === "Escape") cancelHandler();
		}
		ok.addEventListener("click", okHandler);
		cancel.addEventListener("click", cancelHandler);
		input.addEventListener("keydown", keyHandler);
	});
}
// User-Grid laden und anzeigen (paged)
let usersCache = [];
let usersPerPage = 16; // number of users shown per page (adjust as needed)
let usersCurrentPage = 1;
let usersTotalPages = 1;
let usersPageResetTimer = null;
const USERS_PAGE_RESET_MS = 10000; // 10s - return to page 1

async function loadUserGrid(page = 1) {
	const res = await fetch('/api/allusers');
	let users = await res.json();
	// Sortiere nach letztem Kauf (neuester zuerst)
	users.sort((a, b) => {
		const aLast = a.consumption && a.consumption.length ? new Date(a.consumption[a.consumption.length-1].date) : new Date(0);
		const bLast = b.consumption && b.consumption.length ? new Date(b.consumption[b.consumption.length-1].date) : new Date(0);
		return bLast - aLast;
	});
	usersCache = users;
	// simple paging
	usersTotalPages = Math.max(1, Math.ceil(usersCache.length / usersPerPage));
	usersCurrentPage = Math.min(Math.max(1, page), usersTotalPages);
	const start = (usersCurrentPage - 1) * usersPerPage;
	const pageUsers = usersCache.slice(start, start + usersPerPage);
	const grid = $("user-grid");
	grid.innerHTML = "";
	pageUsers.forEach(user => {
		const btn = document.createElement("button");
		btn.className = "user-tile";
		btn.textContent = user.username;
		btn.onclick = () => {
			$("username").value = user.username;
			// PIN-Eingabe fokussieren
			const pinDisplay = $("pin-display");
			if (pinDisplay) pinDisplay.focus();
			// Markiere Auswahl
			document.querySelectorAll('.user-tile.selected').forEach(b => b.classList.remove('selected'));
			btn.classList.add('selected');
			// reset page-reset timer when user picks
			startUsersPageResetTimer();
		};
		grid.appendChild(btn);
	});
	// ensure the grid always has usersPerPage tiles (fill with invisible placeholders)
	const filled = pageUsers.length;
	if (filled < usersPerPage) {
		const need = usersPerPage - filled;
		for (let i = 0; i < need; i++) {
			const ph = document.createElement('div');
			ph.className = 'user-tile placeholder';
			// keep DOM size but no content
			ph.innerHTML = '&nbsp;';
			grid.appendChild(ph);
		}
	}
	// update pager display
	const disp = $("users-page-display");
	if (disp) disp.textContent = usersCurrentPage + ' / ' + usersTotalPages;
	// ensure pager buttons exist and are wired
	const prev = $("users-prev");
	const next = $("users-next");
	if (prev && !prev._wired) { prev.addEventListener('click', () => { goUsersPage(usersCurrentPage - 1); }); prev._wired = true; }
	if (next && !next._wired) { next.addEventListener('click', () => { goUsersPage(usersCurrentPage + 1); }); next._wired = true; }
	// (re)start page reset timer when page != 1
	if (usersCurrentPage !== 1) startUsersPageResetTimer(); else clearUsersPageResetTimer();
}

function goUsersPage(page) {
	const target = Math.min(Math.max(1, page), usersTotalPages);
	if (target === usersCurrentPage) return;
	usersCurrentPage = target;
	loadUserGrid(usersCurrentPage);
}

function clearUsersPageResetTimer() {
	if (usersPageResetTimer) { clearTimeout(usersPageResetTimer); usersPageResetTimer = null; }
}

function startUsersPageResetTimer() {
	clearUsersPageResetTimer();
	if (usersCurrentPage === 1) return;
	
	// Timer nicht starten wenn global gestoppt
	if (globalTimersDisabled) {
		console.log('[Users-Page-Reset] Timer gestoppt - nicht gestartet');
		return;
	}
	
	usersPageResetTimer = setTimeout(() => {
		usersCurrentPage = 1;
		loadUserGrid(1);
		usersPageResetTimer = null;
	}, USERS_PAGE_RESET_MS);
}

// Diese Funktion wurde durch das neue Modal ersetzt - wird nicht mehr benötigt
// Der alte withdraw-btn existiert nicht mehr

// Hilfsfunktionen
function $(id) { return document.getElementById(id); }

// --- Globaler Timer-Status ---
let globalTimersDisabled = false;

// Timer-Status vom Server abrufen
async function loadTimerStatus() {
	try {
		const res = await fetch("/api/admin/timer-status");
		const data = await res.json();
		globalTimersDisabled = data.timersDisabled;
		console.log('[Timer] Globaler Timer-Status:', globalTimersDisabled ? 'gestoppt' : 'läuft');
	} catch (error) {
		console.error('[Timer] Fehler beim Laden des Timer-Status:', error);
		globalTimersDisabled = false; // Fallback: Timer laufen lassen
	}
}

// Timer-Status regelmäßig aktualisieren (alle 5 Sekunden)
setInterval(loadTimerStatus, 5000);

// --- Auto-Logout (15 Sekunden Inaktivität) with visual progress ---
let autoLogoutTimer = null;
let autoLogoutInterval = null;
const AUTO_LOGOUT_MS = 15000; // 15 Sekunden
const SLOW_LOGOUT_MS = AUTO_LOGOUT_MS * 2; // 30 Sekunden wenn Modal geöffnet ist

function startAutoLogoutTimer() {
	// Timer nicht starten wenn global gestoppt
	if (globalTimersDisabled) {
		console.log('[AutoLogout] Timer gestoppt - nicht gestartet');
		return;
	}
	
	clearAutoLogoutTimer();
	
	// Timer verlangsamen wenn Geld-Modal geöffnet ist
	const moneyModalOpen = $("money-modal-bg") && $("money-modal-bg").style.display === 'flex';
	const currentTimeout = moneyModalOpen ? SLOW_LOGOUT_MS : AUTO_LOGOUT_MS;
	const timeoutLabel = moneyModalOpen ? 'SLOW' : 'NORMAL';
	
	console.log('[AutoLogout] start timer for', currentTimeout, 'ms (', timeoutLabel, ')');
	const start = Date.now();
	const progressEl = document.querySelector('#logout-btn .logout-progress');
	if (progressEl) progressEl.style.width = '0%';
	
	autoLogoutTimer = setTimeout(() => {
		console.log('[AutoLogout] timeout fired — performing logout');
		if (autoLogoutInterval) { clearInterval(autoLogoutInterval); autoLogoutInterval = null; }
		if (progressEl) progressEl.style.width = '100%';
		doLogout('Automatisch ausgeloggt (Inaktivität).');
	}, currentTimeout);
	
	// start interval to update progress bar
	if (autoLogoutInterval) clearInterval(autoLogoutInterval);
	autoLogoutInterval = setInterval(() => {
		const elapsed = Date.now() - start;
		const pct = Math.min(100, (elapsed / currentTimeout) * 100);
		if (progressEl) progressEl.style.width = pct + '%';
	}, 100);
}
function resetAutoLogoutTimer() {
	// Timer nicht resetten wenn global gestoppt
	if (globalTimersDisabled) {
		console.log('[AutoLogout] Timer gestoppt - Reset ignoriert');
		return;
	}
	// nur wenn main-section sichtbar ist
	const mainVisible = $("main-section") && $("main-section").style.display === 'block';
	if (!mainVisible) return;
	// restart timer and reset visual
	startAutoLogoutTimer();
	const progressEl = document.querySelector('#logout-btn .logout-progress');
	if (progressEl) progressEl.style.width = '0%';
}
function clearAutoLogoutTimer() {
	if (autoLogoutTimer) {
		clearTimeout(autoLogoutTimer);
		autoLogoutTimer = null;
		console.log('[AutoLogout] cleared');
	}
	if (autoLogoutInterval) {
		clearInterval(autoLogoutInterval);
		autoLogoutInterval = null;
	}
	// Progress-Balken zurücksetzen
	const progressEl = document.querySelector('#logout-btn .logout-progress');
	if (progressEl) progressEl.style.width = '0%';
}

// Funktion um Timer-Status sofort zu aktualisieren (z.B. wenn Admin ihn ändert)
function forceUpdateTimerStatus() {
	loadTimerStatus().then(() => {
		if (globalTimersDisabled) {
			clearAutoLogoutTimer();
			console.log('[Timer] Timer wurden global deaktiviert - alle Timer gestoppt');
		} else {
			console.log('[Timer] Timer wurden global aktiviert');
			// Timer nur starten wenn main-section sichtbar ist
			const mainVisible = $("main-section") && $("main-section").style.display === 'block';
			if (mainVisible) {
				startAutoLogoutTimer();
			}
		}
	});
}
// reset timer on common interactions
['click', 'keydown', 'touchstart'].forEach(evt => {
	document.addEventListener(evt, () => {
		resetAutoLogoutTimer();
	}, { passive: true });
});

// Registrierung
$("register-btn").onclick = function() {
	window.location.href = "register.html";
};

// Numpad wiring (PIN-Eingabe)
function setupNumpad() {
	const pinInput = $("pin");
	const pinDisplay = $("pin-display");
	if (!pinInput) return;
	
	console.log('[NUMPAD] Setting up numpad...');
	
	// Setup für Ziffern-Buttons (1-9, 0)
	document.querySelectorAll('.num-btn').forEach(b => {
		if (b._numpadWired) return; // Bereits verdrahtet
		b._numpadWired = true;
		console.log('[NUMPAD] Wiring button:', b.textContent);
		b.addEventListener('click', () => {
			if (pinInput.value.length >= 4) return;
			const digit = b.textContent.trim();
			pinInput.value = pinInput.value + digit;
			console.log('[NUMPAD] Added digit:', digit, 'Current PIN:', pinInput.value);
			// update masked display
			if (pinDisplay) pinDisplay.innerHTML = pinInput.value.split('').map(()=>'•').join('');
			// reset pin-clear timer on input
			if (typeof resetPinClearTimer === 'function') resetPinClearTimer();
			// kleine visuelle Rückmeldung
			b.classList.add('active');
			setTimeout(() => b.classList.remove('active'), 120);
			
			// Automatischer Login wenn 4 Ziffern eingegeben wurden
			if (pinInput.value.length === 4) {
				console.log('[NUMPAD] 4 digits entered, triggering auto-login');
				setTimeout(() => {
					const loginBtn = document.getElementById('login-btn');
					if (loginBtn) {
						loginBtn.click();
					}
				}, 100); // Kurze Verzögerung für bessere UX
			}
		});
	});
	
	// Setup für Backspace-Button
	const back = document.getElementById('num-back');
	if (back && !back._numpadWired) {
		back._numpadWired = true;
		console.log('[NUMPAD] Wiring backspace button');
		back.addEventListener('click', () => {
			const pin = pinInput.value;
			pinInput.value = pin.slice(0, -1);
			console.log('[NUMPAD] Backspace, new PIN:', pinInput.value);
			if (pinDisplay) pinDisplay.innerHTML = pinInput.value.split('').map(()=>'•').join('');
			if (typeof resetPinClearTimer === 'function') resetPinClearTimer();
			back.classList.add('active'); setTimeout(() => back.classList.remove('active'), 120);
		});
	}
	
	// Setup für Clear-Button
	const clear = document.getElementById('num-clear');
	if (clear && !clear._numpadWired) {
		clear._numpadWired = true;
		console.log('[NUMPAD] Wiring clear button');
		clear.addEventListener('click', () => {
			pinInput.value = '';
			console.log('[NUMPAD] Clear PIN');
			if (pinDisplay) pinDisplay.innerHTML = '';
			if (typeof resetPinClearTimer === 'function') resetPinClearTimer();
			clear.classList.add('active'); setTimeout(() => clear.classList.remove('active'), 120);
		});
	}
	
	// Keyboard-Handler für PIN-Eingabe hinzufügen
	if (pinInput && !pinInput._keyboardWired) {
		pinInput._keyboardWired = true;
		pinInput.addEventListener('input', () => {
			// Begrenze auf 4 Zeichen und nur Ziffern
			pinInput.value = pinInput.value.replace(/[^0-9]/g, '').slice(0, 4);
			// Update masked display
			if (pinDisplay) pinDisplay.innerHTML = pinInput.value.split('').map(()=>'•').join('');
			// reset pin-clear timer on input
			if (typeof resetPinClearTimer === 'function') resetPinClearTimer();
			
			// Automatischer Login wenn 4 Ziffern eingegeben wurden
			if (pinInput.value.length === 4) {
				console.log('[KEYBOARD] 4 digits entered, triggering auto-login');
				setTimeout(() => {
					const loginBtn = document.getElementById('login-btn');
					if (loginBtn) {
						loginBtn.click();
					}
				}, 100);
			}
		});
	}
	
	console.log('[NUMPAD] Setup complete');
}
// ensure numpad is set up on DOM ready
window.addEventListener('DOMContentLoaded', setupNumpad);

// --- PIN auto-clear (10 Sekunden) ---
let pinClearTimer = null;
const PIN_CLEAR_MS = 10000; // 10 Sekunden
function clearPinField() {
	const pin = $("pin");
	const disp = $("pin-display");
	if (pin) pin.value = "";
	if (disp) disp.innerHTML = "";
}
function clearPinClearTimer() {
	if (pinClearTimer) { clearTimeout(pinClearTimer); pinClearTimer = null; }
}
function startPinClearTimer() {
	// Timer nicht starten wenn global gestoppt
	if (globalTimersDisabled) {
		console.log('[PIN-Clear] Timer gestoppt - nicht gestartet');
		return;
	}
	
	clearPinClearTimer();
	pinClearTimer = setTimeout(() => {
		clearPinField();
		pinClearTimer = null;
	}, PIN_CLEAR_MS);
}
function resetPinClearTimer() {
	// restart timer on input
	startPinClearTimer();
}

// Admin-Button im Login (zeigt Admin-Seite, Button optisch gleich wie Login/Register)
$("admin-btn").onclick = function() {
	window.location.href = "admin.html";
};

// Geld verwalten Modal öffnen (jetzt über Balance-Widget)
$("balance-widget").onclick = function() {
	$("money-modal-bg").style.display = "flex";
	$("money-amount").value = "";
	$("money-amount").focus();
	// Timer neu starten mit verlangsamter Geschwindigkeit
	if (typeof startAutoLogoutTimer === 'function') startAutoLogoutTimer();
};

// Geld verwalten Modal abbrechen (setzt Eingabe zurück und schließt Modal)
$("money-modal-cancel").onclick = function() {
	$("money-amount").value = "";
	$("money-modal-bg").style.display = "none";
	// Timer neu starten mit normaler Geschwindigkeit
	if (typeof startAutoLogoutTimer === 'function') startAutoLogoutTimer();
};

// Numpad für Geld verwalten
function setupMoneyNumpad() {
	const amountInput = $("money-amount");
	
	// Zahlen-Buttons (verwendet jetzt die gleichen Klassen wie PIN-Numpad)
	document.querySelectorAll('#money-numpad .num-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const currentValue = amountInput.value.replace(/[^\d]/g, '');
			if (currentValue.length < 8) { // Max 8 Ziffern (999999.99)
				const newValue = currentValue + btn.textContent;
				// Korrekte Formatierung für alle Beträge
				if (newValue.length === 1) {
					amountInput.value = '0.0' + newValue;
				} else if (newValue.length === 2) {
					amountInput.value = '0.' + newValue;
				} else {
					// 3+ Ziffern: Immer die letzten 2 als Cents behandeln
					const euros = newValue.slice(0, -2);
					const cents = newValue.slice(-2);
					amountInput.value = euros + '.' + cents;
				}
			}
		});
	});
	
	// Clear-Button
	$("money-clear").addEventListener('click', () => {
		amountInput.value = "";
	});
	
	// Backspace-Button
	$("money-back").addEventListener('click', () => {
		const currentValue = amountInput.value.replace(/[^\d]/g, '');
		if (currentValue.length > 0) {
			const newValue = currentValue.slice(0, -1);
			if (newValue.length === 0) {
				amountInput.value = "";
			} else if (newValue.length === 1) {
				amountInput.value = '0.0' + newValue;
			} else if (newValue.length === 2) {
				amountInput.value = '0.' + newValue;
			} else {
				// 3+ Ziffern: Immer die letzten 2 als Cents behandeln
				const euros = newValue.slice(0, -2);
				const cents = newValue.slice(-2);
				amountInput.value = euros + '.' + cents;
			}
		}
	});
}

// Einzahlen über Modal
$("money-deposit-btn").onclick = async function() {
	const amount = parseFloat($("money-amount").value);
	if (isNaN(amount) || amount <= 0) {
		alert("Bitte gültigen Betrag eingeben.");
		return;
	}
	
	const username = window.localStorage.getItem("username");
	if (!username) return;
	
	const res = await fetch("/api/deposit", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, amount })
	});
	const data = await res.json();
	if (data.success) {
		$("money-amount").value = "";
		$("money-modal-bg").style.display = "none";
		loadBalance();
		loadTransactions();
		alert("Betrag erfolgreich eingezahlt.");
	} else {
		alert(data.error || "Fehler beim Einzahlen.");
	}
};

// Auszahlen über Modal
$("money-withdraw-btn").onclick = async function() {
	const amount = parseFloat($("money-amount").value);
	if (isNaN(amount) || amount <= 0) {
		alert("Bitte gültigen Betrag eingeben.");
		return;
	}
	
	const username = window.localStorage.getItem("username");
	if (!username) return;
	
	const res = await fetch("/api/withdraw", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, amount })
	});
	const data = await res.json();
	if (data.success) {
		$("money-amount").value = "";
		$("money-modal-bg").style.display = "none";
		loadBalance();
		loadTransactions();
		alert("Betrag erfolgreich ausgezahlt.");
	} else {
		alert(data.error || "Fehler beim Auszahlen.");
	}
};

// Senden über Modal - öffnet Transfer-Modal
$("money-send-btn").onclick = async function() {
	const amount = parseFloat($("money-amount").value);
	if (isNaN(amount) || amount <= 0) {
		alert("Bitte gültigen Betrag eingeben.");
		return;
	}
	
	// Schließe Geld-Modal und öffne Transfer-Modal
	$("money-modal-bg").style.display = "none";
	
	// Lade Nutzerliste und zeige Transfer-Modal
	const username = window.localStorage.getItem("username");
	if (!username) return;
	
	const res = await fetch('/api/allusers');
	const users = await res.json();
	const list = document.getElementById('transfer-user-list');
	list.innerHTML = '';
	
	users.filter(u => u.username !== username).forEach(u => {
		const btn = document.createElement('button');
		btn.className = 'user-tile';
		btn.textContent = u.username;
		btn.style.display = 'block';
		btn.style.width = '100%';
		btn.style.textAlign = 'left';
		btn.onclick = () => {
			document.querySelectorAll('#transfer-user-list .user-tile.selected').forEach(b => b.classList.remove('selected'));
			btn.classList.add('selected');
		};
		list.appendChild(btn);
	});
	
	// Zeige Transfer-Modal
	const bg = document.getElementById('transfer-modal-bg');
	bg.style.display = 'flex';
};

// Login
$("login-btn").onclick = async function() {
	const username = $("username").value.trim();
	const pin = $("pin").value.trim();
	
	console.log('[FRONTEND-LOGIN] Username:', username, 'PIN-Länge:', pin.length);
	
	if (!username || pin.length !== 4) {
		$("login-message").textContent = "Bitte Name und 4-stelligen PIN eingeben.";
		$("login-message").style.color = "red";
		return;
	}
	
	$("login-message").textContent = "Login läuft..."; // Loading message
	$("login-message").style.color = "#fff";
	
	try {
		console.log('[FRONTEND-LOGIN] Sende Request an /api/login');
		const res = await fetch("/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, pin })
		});
		
		console.log('[FRONTEND-LOGIN] Response Status:', res.status);
		const data = await res.json();
		console.log('[FRONTEND-LOGIN] Response Data:', data);
		
		if (data && data.success) {
			console.log('[FRONTEND-LOGIN] ✅ Login erfolgreich');
			$("user-section").style.display = "none";
			$("main-section").style.display = "block";
			window.localStorage.setItem("username", username);
			// hide top name and show username in balance label
			if (document.getElementById("user-display-name")) document.getElementById("user-display-name").style.display = 'none';
			if (document.getElementById("balance-label")) document.getElementById("balance-label").textContent = username + "'s Guthaben";
			loadDrinks();
			loadBalance();
			if (typeof loadTransactions === 'function') loadTransactions();
			if (typeof startAutoLogoutTimer === 'function') startAutoLogoutTimer();
			clearPinField();
			if (typeof startPinClearTimer === 'function') startPinClearTimer();
		} else {
			console.log('[FRONTEND-LOGIN] ❌ Login fehlgeschlagen:', data);
			$("login-message").style.color = "red";
			$("login-message").textContent = (data && data.error) || "Login fehlgeschlagen.";
		}
	} catch (error) {
		console.error('[FRONTEND-LOGIN] ❌ EXCEPTION:', error);
		$("login-message").style.color = "red";
		$("login-message").textContent = "Netzwerkfehler beim Login.";
	}
};

// Logout / Abmelden (wird auch von Auto-Logout aufgerufen)
function doLogout(message) {
	clearAutoLogoutTimer();
	clearPinClearTimer(); // PIN-Clear-Timer auch stoppen
	window.localStorage.removeItem("username");
	
	// Alle Modals schließen
	if ($("money-modal-bg")) $("money-modal-bg").style.display = "none";
	if ($("transfer-modal-bg")) $("transfer-modal-bg").style.display = "none";
	if ($("pin-modal-bg")) $("pin-modal-bg").style.display = "none";
	
	$("main-section").style.display = "none";
	$("user-section").style.display = "block";
	if ($("login-message")) {
		$("login-message").textContent = message || "";
	}
	// Felder leeren
	clearPinField(); // Verwende die spezielle Funktion
	$("money-amount").value = "";
	document.querySelectorAll('.user-tile.selected').forEach(b => b.classList.remove('selected'));
}
$("logout-btn").onclick = function() { doLogout(); };

// Account löschen
$("delete-account-btn").onclick = async function() {
	const username = window.localStorage.getItem("username");
	if (!username) return;
	// Prüfe Guthaben
	const res = await fetch(`/api/balance/${encodeURIComponent(username)}`);
	const data = await res.json();
	if (data.balance < 0) {
		alert("Account kann nur gelöscht werden, wenn das Guthaben nicht im Minus ist.");
		return;
	}
	if (!confirm("Account wirklich löschen?")) return;
	const delRes = await fetch('/api/deleteuser', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username })
	});
	const delData = await delRes.json();
	if (delData.success) {
		window.localStorage.removeItem("username");
		$("main-section").style.display = "none";
		$("user-section").style.display = "block";
		$("login-message").textContent = "Account gelöscht.";
		$("pin").value = "";
		$("money-amount").value = "";
		document.querySelectorAll('.user-tile.selected').forEach(b => b.classList.remove('selected'));
		loadUserGrid(1);
	} else {
		alert(delData.error || "Fehler beim Löschen.");
	}
};

// Guthaben laden
async function loadBalance() {
	const username = window.localStorage.getItem("username");
	if (!username) return;
	try {
		const res = await fetch(`/api/balance/${encodeURIComponent(username)}`);
		const data = await res.json();
		const balance = parseFloat(data.balance) || 0;
		$("balance").textContent = balance.toFixed(2);
		console.log('[BALANCE] Loaded balance for', username, ':', balance);
	} catch (error) {
		console.error('[BALANCE] Error loading balance:', error);
		$("balance").textContent = "0.00";
	}
}

// Transfer modal handlers
document.getElementById('transfer-modal-cancel').onclick = () => {
	document.getElementById('transfer-modal-bg').style.display = 'none';
};
document.getElementById('transfer-modal-ok').onclick = async () => {
	const sel = document.querySelector('#transfer-user-list .user-tile.selected');
	if (!sel) { alert('Bitte Empfänger auswählen.'); return; }
	const to = sel.textContent;
	const from = window.localStorage.getItem('username');
	const amount = parseFloat($("money-amount").value);
	if (!from || !to || isNaN(amount) || amount <= 0) { alert('Ungültige Eingabe.'); return; }
	const res = await fetch('/api/transfer', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ from, to, amount })
	});
	const data = await res.json();
	if (data.success) {
		document.getElementById('transfer-modal-bg').style.display = 'none';
		$("money-amount").value = '';
		loadBalance();
		loadTransactions();
		alert('Betrag gesendet.');
	} else {
		alert(data.error || 'Fehler beim Senden.');
	}
};

// Getränke laden
async function loadDrinks() {
	const res = await fetch("/api/drinks");
	const drinks = await res.json();
	const list = $("drink-list");
	list.innerHTML = "";
	drinks.forEach(drink => {
		const li = document.createElement("li");
		const drinkBtn = document.createElement("button");
		drinkBtn.className = "drink-btn";
		// name on top, price on the next line (no parentheses)
		const nameDiv = document.createElement('div');
		nameDiv.className = 'drink-name';
		nameDiv.textContent = drink.name;
		const priceDiv = document.createElement('div');
		priceDiv.className = 'drink-price';
		priceDiv.textContent = drink.price.toFixed(2) + ' €';
		drinkBtn.appendChild(nameDiv);
		drinkBtn.appendChild(priceDiv);
		drinkBtn.onclick = () => consumeDrink(drink.name);
		li.appendChild(drinkBtn);
		list.appendChild(li);
	});
}

// Kontobewegungen laden (nur die letzten 3)
async function loadTransactions() {
	const username = window.localStorage.getItem("username");
	if (!username) return;
	const res = await fetch(`/api/consumption/${encodeURIComponent(username)}`);
	let transactions = await res.json();
	const list = $("consumption-list");
	list.innerHTML = "";
	// Sortiere nach Datum (neueste zuerst) und nimm die letzten 3
	transactions = transactions.filter(t => t && t.date).sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,3);
	transactions.forEach(entry => {
		const li = document.createElement("li");
		const desc = entry.description || entry.drink || entry.type || '';
		const dateStr = new Date(entry.date).toLocaleString();
		const amount = typeof entry.amount === 'number' ? entry.amount : null;
		const left = document.createElement('div');
		left.textContent = `${desc} (${dateStr})`;
		const right = document.createElement('div');
		right.style.fontWeight = '700';
		if (amount !== null) {
			const sign = amount > 0 ? '+' : '-';
			const formatted = sign + Math.abs(amount).toFixed(2) + ' €';
			right.textContent = formatted;
			right.className = amount >= 0 ? 'tx-positive' : 'tx-negative';
		}
		li.appendChild(left);
		li.appendChild(right);
		list.appendChild(li);
	});
}

// Getränk konsumieren
async function consumeDrink(drink) {
	const username = window.localStorage.getItem("username");
	if (!username) return;
	const res = await fetch("/api/consume", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, drink })
	});
	const data = await res.json();
		if (data.success) {
			loadTransactions();
		loadBalance();
	} else {
		alert(data.error || "Fehler beim Kauf.");
	}
}

// Automatisches Einloggen, falls noch gespeichert

window.addEventListener("DOMContentLoaded", () => {
	loadUserGrid(1);
	// Timer-Status beim Laden der Seite abrufen
	loadTimerStatus();
	
	// Regelmäßiger Check des Timer-Status (alle 30 Sekunden)
	setInterval(() => {
		if ($("main-section") && $("main-section").style.display === 'block') {
			forceUpdateTimerStatus();
		}
	}, 30000); // 30 Sekunden
	
	// Money-Numpad initialisieren
	setupMoneyNumpad();
	
	const username = window.localStorage.getItem("username");
	if (username) {
		$("user-section").style.display = "none";
		$("main-section").style.display = "block";
		document.getElementById("user-display-name").style.display = 'none';
		document.getElementById("balance-label").textContent = username + "'s Guthaben";
		loadDrinks();
		loadTransactions();
		loadBalance();
		// starte Auto-Logout-Timer beim automatischen Login
		if (typeof startAutoLogoutTimer === 'function') startAutoLogoutTimer();
		// clear pin on auto-login and start pin-clear timer
		if (typeof clearPinField === 'function') clearPinField();
		if (typeof startPinClearTimer === 'function') startPinClearTimer();
	}
});

// Entferne den doppelten Login-Button Handler - das war das Hauptproblem!
// Der Login-Handler ist bereits weiter oben im Code definiert

// Click-outside Funktionalität für alle Modals
document.addEventListener('DOMContentLoaded', function() {
	// PIN Modal - Click outside to close
	const pinModalBg = document.getElementById('pin-modal-bg');
	if (pinModalBg) {
		pinModalBg.addEventListener('click', function(e) {
			if (e.target === pinModalBg) {
				// Simuliere Abbrechen-Button click
				const cancelBtn = document.getElementById('pin-modal-cancel');
				if (cancelBtn) cancelBtn.click();
			}
		});
	}
	
	// Money Modal - Click outside to close
	const moneyModalBg = document.getElementById('money-modal-bg');
	if (moneyModalBg) {
		moneyModalBg.addEventListener('click', function(e) {
			if (e.target === moneyModalBg) {
				// Simuliere Abbrechen-Button click
				const cancelBtn = document.getElementById('money-modal-cancel');
				if (cancelBtn) cancelBtn.click();
			}
		});
	}
	
	// Transfer Modal - Click outside to close
	const transferModalBg = document.getElementById('transfer-modal-bg');
	if (transferModalBg) {
		transferModalBg.addEventListener('click', function(e) {
			if (e.target === transferModalBg) {
				// Simuliere Abbrechen-Button click
				const cancelBtn = document.getElementById('transfer-modal-cancel');
				if (cancelBtn) cancelBtn.click();
			}
		});
	}
});
