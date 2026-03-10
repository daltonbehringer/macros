const state = {
    currentDate: new Date().toISOString().split("T")[0],
    selectedMealType: "breakfast",
    targets: { calories: 2305, protein: 190, carbs: 240, fat: 65 },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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
    const macros = [
        { key: "calories", current: totals.calories, target: state.targets.calories, unit: "" },
        { key: "protein", current: totals.protein_g, target: state.targets.protein, unit: "g" },
        { key: "carbs", current: totals.carbs_g, target: state.targets.carbs, unit: "g" },
        { key: "fat", current: totals.fat_g, target: state.targets.fat, unit: "g" },
    ];

    macros.forEach(({ key, current, target, unit }) => {
        const bar = $(`.macro-bar[data-macro="${key}"]`);
        const pct = Math.min((current / target) * 100, 100);
        bar.querySelector(".bar-fill").style.width = pct + "%";

        const cur = key === "calories" ? Math.round(current).toLocaleString() : Math.round(current);
        const tgt = key === "calories" ? target.toLocaleString() : target;
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
                        <button class="btn-save" title="Save meal" data-id="${entry.id}">Save</button>
                        <button class="btn-delete" title="Delete" data-id="${entry.id}">&times;</button>
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

    // Attach event listeners
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
        const data = await res.json();
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
    const loading = $("#loading");
    const error = $("#error");
    const clarify = $("#clarify");

    logBtn.disabled = true;
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
                <button data-id="${m.id}">&times;</button>
            `;
            card.querySelector("button").addEventListener("click", () => deleteSavedMeal(m.id));
            list.appendChild(card);
        });
    } catch (err) {
        console.error("Load saved meals failed:", err);
    }
}

// --- Event Listeners ---

$("#log-btn").addEventListener("click", logFood);
$("#food-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        logFood();
    }
});
$("#prev-day").addEventListener("click", () => shiftDate(-1));
$("#next-day").addEventListener("click", () => shiftDate(1));

// --- Init ---

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/static/sw.js");
}

$("#current-date").textContent = formatDateDisplay(state.currentDate);
loadDay();
loadSavedMeals();
