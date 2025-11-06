import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// 🔧 自分の firebaseConfig を貼る
const firebaseConfig = {
  apiKey: "AIzaSyCMJft6BfWUx8FSEt76O4iaCE13axt0dzY",
  authDomain: "habit-9e26c.firebaseapp.com",
  projectId: "habit-9e26c",
  storageBucket: "habit-9e26c.firebasestorage.app",
  messagingSenderId: "536564377863",
  appId: "1:536564377863:web:c2d91a99d7e0f0369abda2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== 日付処理 =====
function formatDate(d) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const today = new Date();
let currentViewingDate = formatDate(today);

const todayLabel = document.getElementById("today-label");
const habitListContainer = document.getElementById("habit-list");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const prevBtn = document.getElementById("prev-btn");
const todayBtn = document.getElementById("today-btn");
const viewingDateLabel = document.getElementById("viewing-date");
const debugOutput = document.getElementById("debug-output");
const exportBtn = document.getElementById("export-btn");

let habits = [];
let habitInputs = {};
let localValues = {};

let resolveHabitsReady;
const habitsReady = new Promise((resolve) => {
  resolveHabitsReady = resolve;
});

todayLabel.textContent = `今日は ${currentViewingDate} です`;

async function loadHabits() {
  const snap = await getDocs(collection(db, "habits"));
  const loaded = snap.docs.map((docSnap) => {
    const data = docSnap.data();
    const rawType = (data.type || "Boolean").toString().toLowerCase();
    const type = rawType === "number" ? "Number" : "Boolean";
    const order =
      typeof data.order === "number" ? data.order : Number.POSITIVE_INFINITY;
    return {
      id: docSnap.id,
      name: data.name || docSnap.id,
      type,
      unit: data.unit || "",
      order,
    };
  });

  loaded.sort((a, b) => {
    if (a.order === b.order) {
      return a.name.localeCompare(b.name);
    }
    return a.order - b.order;
  });

  return loaded;
}

function ensureLocalDefaults() {
  habits.forEach((habit) => {
    if (!(habit.id in localValues)) {
      localValues[habit.id] = habit.type === "Boolean" ? false : null;
    }
  });
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function updateInputsFromLocalValues() {
  habits.forEach((habit) => {
    const input = habitInputs[habit.id];
    if (!input) return;

    const value = localValues[habit.id];
    if (habit.type === "Boolean") {
      input.checked = !!value;
    } else if (habit.type === "Number") {
      if (value === null || value === undefined || Number.isNaN(value)) {
        input.value = "";
      } else {
        input.value = value;
      }
    }
  });
}

function renderHabits() {
  habitListContainer.innerHTML = "";
  habitInputs = {};

  if (!habits.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "習慣が登録されていません。";
    habitListContainer.appendChild(emptyMessage);
    return;
  }

  habits.forEach((habit) => {
    const item = document.createElement("div");
    item.className = "habit-item";

    if (habit.type === "Boolean") {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.habitInput = habit.id;
      input.addEventListener("change", () => {
        localValues[habit.id] = input.checked;
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(` ${habit.name}`));
      habitInputs[habit.id] = input;
      item.appendChild(label);
    } else if (habit.type === "Number") {
      const label = document.createElement("label");

      const titleSpan = document.createElement("span");
      titleSpan.textContent = `${habit.name}: `;
      label.appendChild(titleSpan);

      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.dataset.habitInput = habit.id;
      const handleNumberChange = () => {
        const raw = input.value.trim();
        if (raw === "") {
          localValues[habit.id] = null;
        } else {
          const parsed = parseFloat(raw);
          localValues[habit.id] = Number.isNaN(parsed) ? null : parsed;
        }
      };
      input.addEventListener("input", handleNumberChange);
      input.addEventListener("change", handleNumberChange);
      label.appendChild(input);

      if (habit.unit) {
        const unitSpan = document.createElement("span");
        unitSpan.className = "habit-unit";
        unitSpan.textContent = ` ${habit.unit}`;
        label.appendChild(unitSpan);
      }

      habitInputs[habit.id] = input;
      item.appendChild(label);
    } else {
      const label = document.createElement("span");
      label.textContent = habit.name;
      item.appendChild(label);
    }

    habitListContainer.appendChild(item);
  });

  ensureLocalDefaults();
  updateInputsFromLocalValues();
}

async function loadEntry(dateStr) {
  const docId = `entry_${dateStr}`;
  const docSnap = await getDoc(doc(db, "entries", docId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

async function saveEntry(dateStr) {
  await habitsReady;

  const values = {};
  habits.forEach((habit) => {
    const input = habitInputs[habit.id];
    if (!input) return;

    if (habit.type === "Boolean") {
      const checked = input.checked;
      values[habit.id] = checked;
      localValues[habit.id] = checked;
    } else if (habit.type === "Number") {
      const raw = input.value.trim();
      if (raw === "") {
        values[habit.id] = null;
        localValues[habit.id] = null;
      } else {
        const parsed = parseFloat(raw);
        values[habit.id] = Number.isNaN(parsed) ? null : parsed;
        localValues[habit.id] = Number.isNaN(parsed) ? null : parsed;
      }
    }
  });

  const data = {
    date: dateStr,
    values,
    updatedAt: new Date(),
  };
  const docId = `entry_${dateStr}`;
  await setDoc(doc(db, "entries", docId), data, { merge: true });
  return data;
}

function showEntry(dateStr, entry) {
  currentViewingDate = dateStr;
  viewingDateLabel.textContent = `表示中の日付: ${dateStr}`;

  const values = entry?.values ?? {};
  localValues = {};

  habits.forEach((habit) => {
    if (habit.type === "Boolean") {
      localValues[habit.id] = normalizeBoolean(values[habit.id]);
    } else if (habit.type === "Number") {
      const rawValue = values[habit.id];
      let numericValue = null;
      if (typeof rawValue === "number" && !Number.isNaN(rawValue)) {
        numericValue = rawValue;
      } else if (
        typeof rawValue === "string" && rawValue.trim() !== ""
      ) {
        const parsed = parseFloat(rawValue);
        numericValue = Number.isNaN(parsed) ? null : parsed;
      }
      localValues[habit.id] = numericValue;
    } else {
      localValues[habit.id] = values[habit.id] ?? null;
    }
  });

  ensureLocalDefaults();
  updateInputsFromLocalValues();

  debugOutput.textContent = entry
    ? JSON.stringify(entry, null, 2)
    : "(データなし)";
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function exportCsv() {
  await habitsReady;
  const snap = await getDocs(collection(db, "entries"));
  const entries = snap.docs.map((docSnap) => docSnap.data());

  entries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const header = ["date", ...habits.map((habit) => habit.name)];
  const rows = [header];

  entries.forEach((entry) => {
    const row = [entry.date ?? ""];
    const values = entry.values ?? {};

    habits.forEach((habit) => {
      const rawValue = values[habit.id];
      if (habit.type === "Boolean") {
        row.push(normalizeBoolean(rawValue) ? "1" : "0");
      } else if (habit.type === "Number") {
        if (rawValue === null || rawValue === undefined) {
          row.push("");
        } else {
          row.push(rawValue);
        }
      } else {
        row.push(rawValue ?? "");
      }
    });

    rows.push(row);
  });

  const csvContent = rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "habit_entries.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

saveBtn.addEventListener("click", async () => {
  saveStatus.textContent = "保存中...";
  const data = await saveEntry(currentViewingDate);
  saveStatus.textContent = "保存しました";
  debugOutput.textContent = JSON.stringify(data, null, 2);
  setTimeout(() => (saveStatus.textContent = ""), 1500);
});

prevBtn.addEventListener("click", async () => {
  await habitsReady;
  const d = new Date(currentViewingDate);
  d.setDate(d.getDate() - 1);
  const dateStr = formatDate(d);
  const entry = await loadEntry(dateStr);
  showEntry(dateStr, entry);
});

todayBtn.addEventListener("click", async () => {
  await habitsReady;
  const todayStr = formatDate(today);
  const entry = await loadEntry(todayStr);
  showEntry(todayStr, entry);
});

exportBtn.addEventListener("click", exportCsv);

async function init() {
  habits = await loadHabits();
  renderHabits();
  resolveHabitsReady();
  const entry = await loadEntry(currentViewingDate);
  showEntry(currentViewingDate, entry);
}

init();
