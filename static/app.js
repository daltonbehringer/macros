const state = {
    currentDate: new Date().toISOString().split("T")[0],
    selectedMealType: "breakfast",
    targets: null,
    user: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- Auth ---

async function checkAuth() {
    try {
        const res = await fetch("/auth/me");
        if (!res.ok) {
            showAuthScreen();
            return;
        }
        const data = await res.json();
        state.user = { id: data.id, username: data.username };
        state.targets = data.settings;
        showApp();
    } catch {
        showAuthScreen();
    }
}

function showAuthScreen() {
    $("#auth-screen").classList.remove("hidden");
    $("#app").classList.add("hidden");
    $("#settings-overlay").classList.add("hidden");
}

function showApp() {
    $("#auth-screen").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#current-date").textContent = formatDateDisplay(state.currentDate);
    loadDay();
    loadSavedMeals();
}

async function login() {
    const username = $("#auth-username").value.trim();
    const password = $("#auth-password").value;
    if (!username || !password) return;

    const authError = $("#auth-error");
    authError.classList.add("hidden");

    try {
        const res = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const err = await res.json();
            authError.textContent = err.detail || "Login failed";
            authError.classList.remove("hidden");
            return;
        }
        await checkAuth();
    } catch {
        authError.textContent = "Connection error";
        authError.classList.remove("hidden");
    }
}

async function register() {
    const username = $("#auth-username").value.trim();
    const password = $("#auth-password").value;
    if (!username || !password) return;

    const authError = $("#auth-error");
    authError.classList.add("hidden");

    try {
        const res = await fetch("/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const err = await res.json();
            authError.textContent = err.detail || "Registration failed";
            authError.classList.remove("hidden");
            return;
        }
        await checkAuth();
    } catch {
        authError.textContent = "Connection error";
        authError.classList.remove("hidden");
    }
}

async function logout() {
    await fetch("/auth/logout", { method: "POST" });
    state.user = null;
    state.targets = null;
    $("#auth-username").value = "";
    $("#auth-password").value = "";
    showAuthScreen();
}

// --- Date Navigation ---

function formatDateDisplay(iso) {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function shiftDate(days) {
    const d = new Date(state.currentDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    state.currentDate = d.toISOString().split("T")[0];
    $("#current-date").textContent = formatDateDisplay(state.currentDate);
    loadDay();
}

// --- Meal Type Selection ---

$$(".meal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        $$(".meal-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.selectedMealType = btn.dataset.type;
    });
});

// --- Progress Bars ---

function updateBars(totals) {
    if (!state.targets) return;
    const t = state.targets;
    const macros = [
        { key: "calories", current: totals.calories, target: t.calories_target, unit: "" },
        { key: "protein", current: totals.protein_g, target: t.protein_target, unit: "g" },
        { key: "carbs", current: totals.carbs_g, target: t.carbs_target, unit: "g" },
        { key: "fat", current: totals.fat_g, target: t.fat_target, unit: "g" },
    ];

    macros.forEach(({ key, current, target, unit }) => {
        const bar = $(`.macro-bar[data-macro="${key}"]`);
        const pct = Math.min((current / target) * 100, 100);
        bar.querySelector(".bar-fill").style.width = pct + "%";

        const cur = key === "calories" ? Math.round(current).toLocaleString() : Math.round(current);
        const tgt = key === "calories" ? Math.round(target).toLocaleString() : Math.round(target);
        bar.querySelector(".macro-value").textContent = `${cur} / ${tgt}${unit}`;
    });
}

// --- Render Entries ---

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

function renderEntries(entries) {
    const log = $("#meal-log");
    log.innerHTML = "";

    const grouped = {};
    entries.forEach((e) => {
        if (!grouped[e.meal_type]) grouped[e.meal_type] = [];
        grouped[e.meal_type].push(e);
    });

    MEAL_ORDER.forEach((type) => {
        if (!grouped[type]) return;
        const group = document.createElement("div");
        group.className = "meal-group";
        group.innerHTML = `<h3>${MEAL_LABELS[type]}</h3>`;

        grouped[type].forEach((entry) => {
            const card = document.createElement("div");
            card.className = "entry-card";
            card.innerHTML = `
                <div class="entry-header">
                    <span class="entry-food-name">${esc(entry.food_name)}</span>
                    <div class="entry-actions">
                        <button type="button" class="btn-save" title="Save meal" data-id="${entry.id}">Save</button>
                        <button type="button" class="btn-delete" title="Delete" data-id="${entry.id}">&times;</button>
                    </div>
                </div>
                <div class="entry-macros">
                    <span><i class="dot dot-cal"></i>${Math.round(entry.calories)} cal</span>
                    <span><i class="dot dot-protein"></i>${Math.round(entry.protein_g)}g P</span>
                    <span><i class="dot dot-carbs"></i>${Math.round(entry.carbs_g)}g C</span>
                    <span><i class="dot dot-fat"></i>${Math.round(entry.fat_g)}g F</span>
                </div>
                ${entry.notes ? `<div class="entry-notes">${esc(entry.notes)}</div>` : ""}
            `;
            group.appendChild(card);
        });

        log.appendChild(group);
    });

    log.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", () => deleteEntry(parseInt(btn.dataset.id)));
    });
    log.querySelectorAll(".btn-save").forEach((btn) => {
        btn.addEventListener("click", () => saveMeal(parseInt(btn.dataset.id)));
    });
}

function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

// --- API Calls ---

async function loadDay() {
    try {
        const res = await fetch(`/day/${state.currentDate}`);
        if (res.status === 401) { showAuthScreen(); return; }
        const data = await res.json();
        if (data.targets) state.targets = data.targets;
        updateBars(data.totals);
        renderEntries(data.entries);
    } catch (err) {
        console.error("Failed to load day:", err);
    }
}

async function logFood() {
    const input = $("#food-input");
    const text = input.value.trim();
    if (!text) return;

    const logBtn = $("#log-btn");
    const saveBtn = $("#save-template-btn");
    const loading = $("#loading");
    const error = $("#error");
    const clarify = $("#clarify");

    logBtn.disabled = true;
    saveBtn.disabled = true;
    input.disabled = true;
    loading.classList.remove("hidden");
    error.classList.add("hidden");
    clarify.classList.add("hidden");

    try {
        const res = await fetch("/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, meal_type: state.selectedMealType }),
        });

        if (res.status === 401) { showAuthScreen(); return; }

        if (!res.ok) {
            let msg = "Failed to log food";
            try {
                const err = await res.json();
                msg = err.detail || msg;
            } catch {}
            throw new Error(msg);
        }

        const data = await res.json();

        if (data.status === "clarify") {
            clarify.textContent = data.message;
            clarify.classList.remove("hidden");
            return;
        }

        input.value = "";
        await loadDay();
    } catch (err) {
        error.textContent = err.message;
        error.classList.remove("hidden");
    } finally {
        logBtn.disabled = false;
        saveBtn.disabled = false;
        input.disabled = false;
        loading.classList.add("hidden");
        input.focus();
    }
}

async function saveAsTemplate() {
    const input = $("#food-input");
    const text = input.value.trim();
    if (!text) return;

    const name = prompt("Name this meal template:");
    if (!name || !name.trim()) return;

    const logBtn = $("#log-btn");
    const saveBtn = $("#save-template-btn");
    const loading = $("#loading");
    const error = $("#error");
    const clarify = $("#clarify");

    logBtn.disabled = true;
    saveBtn.disabled = true;
    input.disabled = true;
    loading.classList.remove("hidden");
    error.classList.add("hidden");
    clarify.classList.add("hidden");

    try {
        const res = await fetch("/meals/save-direct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, name: name.trim() }),
        });

        if (res.status === 401) { showAuthScreen(); return; }

        if (!res.ok) {
            let msg = "Failed to save meal";
            try {
                const err = await res.json();
                msg = err.detail || msg;
            } catch {}
            throw new Error(msg);
        }

        const data = await res.json();

        if (data.status === "clarify") {
            clarify.textContent = data.message;
            clarify.classList.remove("hidden");
            return;
        }

        input.value = "";
        await loadSavedMeals();
    } catch (err) {
        error.textContent = err.message;
        error.classList.remove("hidden");
    } finally {
        logBtn.disabled = false;
        saveBtn.disabled = false;
        input.disabled = false;
        loading.classList.add("hidden");
        input.focus();
    }
}

async function deleteEntry(id) {
    try {
        await fetch(`/entry/${id}`, { method: "DELETE" });
        await loadDay();
    } catch (err) {
        console.error("Delete failed:", err);
    }
}

async function saveMeal(entryId) {
    const name = prompt("Name this meal (e.g. 'My ground beef quinoa bowl'):");
    if (!name || !name.trim()) return;

    try {
        const res = await fetch("/meals/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), entry_id: entryId }),
        });
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Failed to save meal");
            return;
        }
        loadSavedMeals();
    } catch (err) {
        console.error("Save meal failed:", err);
    }
}

async function deleteSavedMeal(id) {
    try {
        await fetch(`/meals/saved/${id}`, { method: "DELETE" });
        loadSavedMeals();
    } catch (err) {
        console.error("Delete saved meal failed:", err);
    }
}

async function loadSavedMeals() {
    try {
        const res = await fetch("/meals/saved");
        if (res.status === 401) return;
        const meals = await res.json();
        const section = $("#saved-meals-section");
        const list = $("#saved-meals-list");

        if (meals.length === 0) {
            section.classList.add("hidden");
            return;
        }

        section.classList.remove("hidden");
        list.innerHTML = "";

        meals.forEach((m) => {
            const card = document.createElement("div");
            card.className = "saved-meal-card";
            const calPerServing = Math.round((m.calories_per_100g / 100) * m.default_serving_g);
            const pPerServing = Math.round((m.protein_per_100g / 100) * m.default_serving_g);
            const cPerServing = Math.round((m.carbs_per_100g / 100) * m.default_serving_g);
            const fPerServing = Math.round((m.fat_per_100g / 100) * m.default_serving_g);
            card.innerHTML = `
                <div class="saved-meal-info">
                    <strong>${esc(m.name)}</strong>
                    <span class="saved-macros">${m.default_serving_g}g serving: ${calPerServing} cal | ${pPerServing}P ${cPerServing}C ${fPerServing}F</span>
                </div>
                <button type="button" data-id="${m.id}">&times;</button>
            `;
            card.querySelector("button").addEventListener("click", () => deleteSavedMeal(m.id));
            list.appendChild(card);
        });
    } catch (err) {
        console.error("Load saved meals failed:", err);
    }
}

// --- Settings ---

function openSettings() {
    if (!state.targets) return;
    $("#set-calories").value = state.targets.calories_target;
    $("#set-protein").value = state.targets.protein_target;
    $("#set-carbs").value = state.targets.carbs_target;
    $("#set-fat").value = state.targets.fat_target;
    $("#settings-overlay").classList.remove("hidden");
}

function closeSettings() {
    $("#settings-overlay").classList.add("hidden");
}

async function saveSettings() {
    const settings = {
        calories_target: parseFloat($("#set-calories").value) || 2000,
        protein_target: parseFloat($("#set-protein").value) || 150,
        carbs_target: parseFloat($("#set-carbs").value) || 250,
        fat_target: parseFloat($("#set-fat").value) || 65,
    };

    try {
        const res = await fetch("/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings),
        });
        if (res.ok) {
            state.targets = settings;
            closeSettings();
            await loadDay();
        }
    } catch (err) {
        console.error("Save settings failed:", err);
    }
}

// --- Event Listeners ---

$("#auth-login-btn").addEventListener("click", login);
$("#auth-register-btn").addEventListener("click", register);
$("#auth-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); login(); }
});

$("#log-btn").addEventListener("click", logFood);
$("#save-template-btn").addEventListener("click", saveAsTemplate);
$("#food-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        logFood();
    }
});
$("#prev-day").addEventListener("click", () => shiftDate(-1));
$("#next-day").addEventListener("click", () => shiftDate(1));

$("#logout-btn").addEventListener("click", logout);
$("#settings-btn").addEventListener("click", openSettings);
$("#settings-save-btn").addEventListener("click", saveSettings);
$("#settings-cancel-btn").addEventListener("click", closeSettings);

// --- Init ---

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/static/sw.js");
}

checkAuth();
