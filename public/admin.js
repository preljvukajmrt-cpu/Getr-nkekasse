// Admin-Passwort ändern
$("change-password-btn").onclick = async function() {
	const oldPassword = $("old-admin-password").value;
	const newPassword = $("new-admin-password").value;
	const msg = $("password-message");
	if (!oldPassword || !newPassword) {
		msg.textContent = "Bitte beide Felder ausfüllen.";
		msg.style.color = "#ff4136";
		return;
	}
	const res = await fetch('/api/admin/password', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ oldPassword, newPassword })
	});
	const data = await res.json();
	if (data.success) {
		msg.textContent = "Passwort erfolgreich geändert.";
		msg.style.color = "green";
		$("old-admin-password").value = "";
		$("new-admin-password").value = "";
	} else {
		msg.textContent = data.error || "Fehler beim Ändern.";
		msg.style.color = "#ff4136";
	}
};

// Hilfsfunktion
function $(id) { return document.getElementById(id); }

// Admin-Login
$("admin-login-btn").onclick = async function() {
	const password = $("admin-password").value;
	const res = await fetch("/api/admin/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ password })
	});
	const data = await res.json();
	if (data.success) {
		$("admin-login-section").style.display = "none";
		$("admin-main-section").style.display = "block";
		loadAdminDrinks();
		loadTimerStatus();
		showTab("drinks");
	} else {
		$("admin-login-message").textContent = data.error || "Login fehlgeschlagen.";
		$("admin-login-message").style.color = "#ff6b6b";
	}
};

// Tabs
function showTab(tab) {
	$("drinks-section").style.display = tab === "drinks" ? "block" : "none";
	$("password-section").style.display = tab === "password" ? "block" : "none";
	$("debug-section").style.display = tab === "debug" ? "block" : "none";
}
$("tab-drinks").onclick = () => showTab("drinks");
$("tab-password").onclick = () => showTab("password");
$("tab-debug").onclick = () => showTab("debug");

// Timer-Status laden
async function loadTimerStatus() {
	try {
		const res = await fetch("/api/admin/timer-status");
		const data = await res.json();
		updateTimerButton(data.timersDisabled);
	} catch (error) {
		console.error("Fehler beim Laden des Timer-Status:", error);
	}
}

// Timer-Button aktualisieren
function updateTimerButton(timersDisabled) {
	const btn = $("timer-toggle-btn");
	const status = $("timer-status");
	
	if (timersDisabled) {
		btn.textContent = "Timer an";
		btn.className = "timer-btn-on";
		status.textContent = "Status: Timer gestoppt";
	} else {
		btn.textContent = "Timer aus";
		btn.className = "timer-btn-off";
		status.textContent = "Status: Timer laufen";
	}
}

// Timer-Toggle-Button
$("timer-toggle-btn").onclick = async function() {
	try {
		const res = await fetch("/api/admin/timer-toggle", {
			method: "POST",
			headers: { "Content-Type": "application/json" }
		});
		const data = await res.json();
		if (data.success) {
			updateTimerButton(data.timersDisabled);
		} else {
			alert("Fehler beim Umschalten der Timer: " + (data.error || "Unbekannter Fehler"));
		}
	} catch (error) {
		console.error("Fehler beim Umschalten der Timer:", error);
		alert("Fehler beim Umschalten der Timer");
	}
};


// Logout
$("admin-logout-btn").onclick = function() {
	// Auch User ausloggen
	window.localStorage.removeItem("username");
	$("admin-main-section").style.display = "none";
	$("admin-login-section").style.display = "block";
	$("admin-password").value = "";
	$("admin-login-message").textContent = "";
	// Nach Logout zurück zum Startfenster
	window.location.href = "/index.html";
};


// Getränke laden (Admin)
async function loadAdminDrinks() {
	const res = await fetch("/api/admin/drinks");
	const drinks = await res.json();
	const list = $("admin-drink-list");
	list.innerHTML = "";
	drinks.forEach(drink => {
		const li = document.createElement("li");
		li.textContent = drink.name + " (" + drink.price.toFixed(2) + " €) ";
		list.appendChild(li);
	});
}

// Getränk hinzufügen
$("add-drink-btn").onclick = async function() {
	const name = $("new-drink-name").value.trim();
	const price = parseFloat($("new-drink-price").value);
	if (!name || isNaN(price)) {
		alert("Bitte Name und Preis eingeben.");
		return;
	}
	const res = await fetch("/api/admin/drinks", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, price })
	});
	const data = await res.json();
	if (data.success) {
		$("new-drink-name").value = "";
		$("new-drink-price").value = "";
		loadAdminDrinks();
	} else {
		alert(data.error || "Fehler beim Hinzufügen.");
	}
};
