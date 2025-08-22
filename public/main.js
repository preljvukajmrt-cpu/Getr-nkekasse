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
// User-Grid laden und anzeigen
async function loadUserGrid() {
	const res = await fetch('/api/allusers');
	let users = await res.json();
	// Sortiere nach letztem Kauf (neuester zuerst)
	users.sort((a, b) => {
		const aLast = a.consumption && a.consumption.length ? new Date(a.consumption[a.consumption.length-1].date) : new Date(0);
		const bLast = b.consumption && b.consumption.length ? new Date(b.consumption[b.consumption.length-1].date) : new Date(0);
		return bLast - aLast;
	});
	const grid = $("user-grid");
	grid.innerHTML = "";
	let selectedBtn = null;
	users.slice(0, 16).forEach(user => {
		const btn = document.createElement("button");
		btn.className = "user-tile";
		btn.textContent = user.username;
		btn.onclick = () => {
			$("username").value = user.username;
			$("pin").focus();
			// Markiere Auswahl
			document.querySelectorAll('.user-tile.selected').forEach(b => b.classList.remove('selected'));
			btn.classList.add('selected');
		};
		grid.appendChild(btn);
	});
}

// Geld auszahlen
$("withdraw-btn").onclick = async function() {
	const username = window.localStorage.getItem("username");
	const amount = parseFloat($("withdraw-amount").value);
	if (!username || isNaN(amount) || amount <= 0) {
		alert("Bitte gültigen Betrag eingeben.");
		return;
	}
	const res = await fetch("/api/withdraw", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, amount })
	});
	const data = await res.json();
	if (data.success) {
		$("withdraw-amount").value = "";
		loadBalance();
		loadTransactions();
	} else {
		alert(data.error || "Fehler beim Auszahlen.");
	}
};

// Hilfsfunktionen
function $(id) { return document.getElementById(id); }

// Registrierung
$("register-btn").onclick = function() {
	window.location.href = "register.html";
};

// Login
$("login-btn").onclick = async function() {
	const username = $("username").value.trim();
	const pin = $("pin").value.trim();
	if (!username || pin.length !== 4) {
		$("login-message").textContent = "Bitte Name und 4-stelligen PIN eingeben.";
		return;
	}
	const res = await fetch("/api/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, pin })
	});
	const data = await res.json();
	if (data.success) {
		$("user-section").style.display = "none";
		$("main-section").style.display = "block";
		window.localStorage.setItem("username", username);
	// hide top name and show username in balance label
	document.getElementById("user-display-name").style.display = 'none';
	document.getElementById("balance-label").textContent = username + "'s Guthaben";
		loadDrinks();
		loadTransactions();
	} else {
		$("login-message").style.color = "red";
		$("login-message").textContent = data.error || "Login fehlgeschlagen.";
	}
};


// Logout
$("logout-btn").onclick = function() {
	window.localStorage.removeItem("username");
	$("main-section").style.display = "none";
	$("user-section").style.display = "block";
	$("login-message").textContent = "";
	// Felder leeren
	$("pin").value = "";
	$("deposit-amount").value = "";
	$("withdraw-amount").value = "";
	document.querySelectorAll('.user-tile.selected').forEach(b => b.classList.remove('selected'));
};

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
		$("deposit-amount").value = "";
		$("withdraw-amount").value = "";
		document.querySelectorAll('.user-tile.selected').forEach(b => b.classList.remove('selected'));
		loadUserGrid();
	} else {
		alert(delData.error || "Fehler beim Löschen.");
	}
};

// Guthaben laden
async function loadBalance() {
	const username = window.localStorage.getItem("username");
	if (!username) return;
	const res = await fetch(`/api/balance/${encodeURIComponent(username)}`);
	const data = await res.json();
	$("balance").textContent = data.balance.toFixed(2);
}

// Geld einzahlen
$("deposit-btn").onclick = async function() {
	const username = window.localStorage.getItem("username");
	const amount = parseFloat($("deposit-amount").value);
	if (!username || isNaN(amount) || amount <= 0) {
		alert("Bitte gültigen Betrag eingeben.");
		return;
	}
	const res = await fetch("/api/deposit", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, amount })
	});
	const data = await res.json();
	if (data.success) {
		$("deposit-amount").value = "";
		loadBalance();
		loadTransactions();
	} else {
		alert(data.error || "Fehler beim Einzahlen.");
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
	loadUserGrid();
	const username = window.localStorage.getItem("username");
	if (username) {
		$("user-section").style.display = "none";
		$("main-section").style.display = "block";
	document.getElementById("user-display-name").style.display = 'none';
	document.getElementById("balance-label").textContent = username + "'s Guthaben";
	loadDrinks();
	loadTransactions();
	loadBalance();
	}
});

// Nach Login auch Guthaben laden
const origLoginBtn = $("login-btn").onclick;
$("login-btn").onclick = async function() {
	await origLoginBtn.apply(this, arguments);
	if ($("main-section").style.display === "block") loadBalance();
};
