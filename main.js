import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const REQUIRED_FIREBASE_CONFIG_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];


function validateFirebaseConfig(config) {
  const missingKeys = REQUIRED_FIREBASE_CONFIG_KEYS.filter((key) => {
    const value = config?.[key];
    return value === undefined || value === null || value === "";
  });

  if (missingKeys.length) {
    const message = `[Firebase] firebaseConfig is missing required keys: ${missingKeys.join(", ")}`;
    console.error(message);
    throw new Error(message);
  }

  const hasWindow = typeof window !== "undefined";
  const hostname = hasWindow ? window.location.hostname : "";
  const environment = hostname === "localhost" ? "development" : "production";
  const origin = hasWindow ? window.location.origin : "";

  const diagnostics = {
    environment,
    origin,
    authDomain: config.authDomain ?? "",
    projectId: config.projectId ?? "",
    matchesAuthDomainProject:
      typeof config.authDomain === "string" && typeof config.projectId === "string"
        ? config.authDomain.toLowerCase().includes(config.projectId.toLowerCase())
        : false,
  };

  if (!diagnostics.matchesAuthDomainProject) {
    console.warn(
      `[Firebase] authDomain (${diagnostics.authDomain}) does not appear to include projectId (${diagnostics.projectId}).`
    );
  }

  if (hasWindow) {
    window.__FIREBASE_CONFIG_DIAGNOSTICS__ = diagnostics;
  }

  const canGroup = typeof console.groupCollapsed === "function" && typeof console.groupEnd === "function";
  if (canGroup) {
    console.groupCollapsed(`[Firebase] Config loaded (${diagnostics.environment})`);
  }
  console.info("origin:", diagnostics.origin);
  console.info("authDomain:", diagnostics.authDomain);
  console.info("projectId:", diagnostics.projectId);
  if (canGroup) {
    console.groupEnd();
  }

  return diagnostics;
}

// 🔧 自分の firebaseConfig を貼る
const firebaseConfig = {
  apiKey: "AIzaSyCMJft6BfWUx8FSEt76O4iaCE13axt0dzY",
  authDomain: "habit-9e26c.firebaseapp.com",
  projectId: "habit-9e26c",
  storageBucket: "habit-9e26c.firebasestorage.app",
  messagingSenderId: "536564377863",
  appId: "1:536564377863:web:c2d91a99d7e0f0369abda2",
};

const firebaseDiagnostics = validateFirebaseConfig(firebaseConfig);
if (typeof document !== "undefined" && document.documentElement) {
  document.documentElement.dataset.firebaseEnv = firebaseDiagnostics.environment;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== 日付処理 =====
function formatDate(d) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(dateStr) {
  if (typeof dateStr !== "string") {
    return null;
  }
  const parts = dateStr.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const [yearPart, monthPart, dayPart] = parts;
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("ja-JP", { weekday: "short" });

function formatDisplayDate(input) {
  let date = null;
  if (input instanceof Date) {
    date = new Date(input.getTime());
  } else if (typeof input === "string") {
    date = parseISODate(input);
  }
  if (!date) {
    return typeof input === "string" ? input : "";
  }
  return `${DISPLAY_DATE_FORMATTER.format(date)}（${WEEKDAY_FORMATTER.format(date)}）`;
}

const today = new Date();
today.setHours(0, 0, 0, 0);
let currentViewingDate = formatDate(today);

const todayLabel = document.getElementById("today-label");
const diaryInput = document.getElementById("diary");
const memoInput = document.getElementById("memo");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const prevBtn = document.getElementById("prev-btn");
const todayBtn = document.getElementById("today-btn");
const nextBtn = document.getElementById("next-btn");
const datePicker = document.getElementById("date-picker");
const viewingDateLabel = document.getElementById("viewing-date");
const debugOutput = document.getElementById("debug-output");
if (debugOutput) {
  const lines = [
    "Firebase 設定を確認しました",
    `環境: ${firebaseDiagnostics.environment}`,
    firebaseDiagnostics.origin ? `origin: ${firebaseDiagnostics.origin}` : null,
    firebaseDiagnostics.authDomain ? `authDomain: ${firebaseDiagnostics.authDomain}` : null,
    "データを読み込み中...",
  ].filter(Boolean);
  debugOutput.textContent = lines.join("\n");
}
const exportBtn = document.getElementById("export-btn");
const exportModal = document.getElementById("export-modal");
const exportForm = document.getElementById("export-form");
const exportFromInput = document.getElementById("export-from");
const exportToInput = document.getElementById("export-to");
const exportError = document.getElementById("export-error");
const habitListElement = document.getElementById("habit-list");
const editHabitsBtn = document.getElementById("edit-habits-btn");
const habitModal = document.getElementById("habit-modal");
const habitEditorList = document.getElementById("habit-editor-list");
const habitEditorEmpty = document.getElementById("habit-editor-empty");
const newHabitForm = document.getElementById("new-habit-form");
const habitEditorError = document.getElementById("habit-editor-error");
const historyBtn = document.getElementById("history-btn");
const historyModal = document.getElementById("history-modal");
const historyHabitSelect = document.getElementById("history-habit-select");
const historyEmptyMessage = document.getElementById("history-empty");
const historyStatus = document.getElementById("history-status");
const historyChartCanvas = document.getElementById("history-chart");
const historyChartContainer = document.getElementById("history-chart-container");
const historyChartEmpty = document.getElementById("history-chart-empty");
const historyCalendar = document.getElementById("history-calendar");
const historyCalendarEmpty = document.getElementById("history-calendar-empty");
const toastElement = document.getElementById("app-toast");
const offlineWarning = document.getElementById("offline-warning");

let habitEditorCache = [];
let activeHabitsCache = [];
let historyChartInstance = null;
let recentEntriesCache = null;
let currentEntryData = null;
let habitInputState = {};
let toastHideTimer = null;
let toastRemoveTimer = null;

const HISTORY_RANGE_DAYS = 30;

if (todayLabel) {
  todayLabel.textContent = `今日は ${formatDisplayDate(today)} です`;
}

function parseOrder(order) {
  const value = Number(order);
  return Number.isFinite(value) ? value : 0;
}

function sortHabitsByOrder(habits) {
  return habits.slice().sort((a, b) => parseOrder(a.order) - parseOrder(b.order));
}

function updateActiveHabitsCache(habits) {
  activeHabitsCache = habits.filter((habit) => habit.active !== false);
}

function renderActiveHabits(habits) {
  if (!habitListElement) return;
  habitListElement.innerHTML = "";
  const sorted = sortHabitsByOrder(habits);
  if (!sorted.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "habit-list__item habit-list__item--empty";
    emptyItem.textContent = "アクティブな習慣がありません";
    habitListElement.appendChild(emptyItem);
    habitInputState = {};
    return;
  }

  sorted.forEach((habit) => {
    const item = document.createElement("li");
    item.className = "habit-list__item";
    if (habit?.id) {
      item.dataset.habitId = habit.id;
    }

    const mode = getHabitMode(habit);
    if (habit?.id && habitInputState[habit.id] === undefined) {
      let initialValue = null;
      if (currentEntryData) {
        const extracted = extractHabitValue(currentEntryData, habit);
        if (mode === "boolean") {
          initialValue = normalizeBooleanValue(extracted);
        } else {
          initialValue = normalizeNumericValue(extracted);
        }
      }
      habitInputState[habit.id] = initialValue ?? null;
    }

    if (mode === "boolean") {
      const label = document.createElement("label");
      label.className = "habit-toggle";

      const input = document.createElement("input");
      input.className = "habit-toggle__input";
      input.type = "checkbox";
      input.id = `habit-${habit.id}`;

      input.addEventListener("change", () => {
        if (!habit?.id) return;
        habitInputState[habit.id] = input.checked;
        input.indeterminate = false;
      });

      input.addEventListener("contextmenu", (event) => {
        if (!habit?.id) return;
        event.preventDefault();
        habitInputState[habit.id] = null;
        updateHabitInputsFromState();
      });

      const span = document.createElement("span");
      span.className = "habit-toggle__label";
      span.textContent = habit.name || "(名称未設定)";

      label.appendChild(input);
      label.appendChild(span);
      item.appendChild(label);
    } else {
      const wrapper = document.createElement("label");
      wrapper.className = "habit-number";

      const nameElement = document.createElement("span");
      nameElement.className = "habit-number__label";
      nameElement.textContent = habit.name || "(名称未設定)";

      const control = document.createElement("div");
      control.className = "habit-number__control";

      const input = document.createElement("input");
      input.className = "habit-number__input";
      input.type = "number";
      input.inputMode = "decimal";
      input.step = "any";
      input.id = `habit-${habit.id}`;

      input.addEventListener("input", () => {
        if (!habit?.id) return;
        const raw = input.value.trim();
        if (raw === "") {
          habitInputState[habit.id] = null;
          return;
        }
        const parsed = parseFloat(raw);
        habitInputState[habit.id] = Number.isFinite(parsed) ? parsed : null;
      });

      input.addEventListener("change", () => {
        if (!habit?.id) return;
        const raw = input.value.trim();
        if (raw === "") {
          habitInputState[habit.id] = null;
        } else {
          const parsed = parseFloat(raw);
          habitInputState[habit.id] = Number.isFinite(parsed) ? parsed : null;
        }
        updateHabitInputsFromState();
      });

      const unitElement = document.createElement("span");
      unitElement.className = "habit-number__unit";
      unitElement.textContent = habit.unit ? habit.unit : "";

      control.appendChild(input);
      control.appendChild(unitElement);

      wrapper.appendChild(nameElement);
      wrapper.appendChild(control);
      item.appendChild(wrapper);
    }

    habitListElement.appendChild(item);
  });

  updateHabitInputsFromState();
}

function setHabitInputStateFromEntry(entry) {
  habitInputState = {};
  if (!entry) return;

  if (entry.values && typeof entry.values === "object") {
    habitInputState = { ...entry.values };
  }

  activeHabitsCache.forEach((habit) => {
    if (!habit?.id || habitInputState[habit.id] !== undefined) return;
    const mode = getHabitMode(habit);
    const extracted = extractHabitValue(entry, habit);
    if (mode === "boolean") {
      habitInputState[habit.id] = normalizeBooleanValue(extracted);
    } else {
      habitInputState[habit.id] = normalizeNumericValue(extracted);
    }
  });
}

function updateHabitInputsFromState() {
  if (!habitListElement) return;
  const items = habitListElement.querySelectorAll("[data-habit-id]");
  items.forEach((item) => {
    if (!(item instanceof HTMLElement)) return;
    const habitId = item.dataset.habitId;
    if (!habitId) return;
    const habit = activeHabitsCache.find((candidate) => candidate.id === habitId);
    if (!habit) return;
    const mode = getHabitMode(habit);
    if (mode === "boolean") {
      const input = item.querySelector(".habit-toggle__input");
      if (!(input instanceof HTMLInputElement)) return;
      const normalized = normalizeBooleanValue(habitInputState[habitId]);
      if (normalized == null) {
        habitInputState[habitId] = null;
        input.checked = false;
        input.indeterminate = true;
      } else {
        habitInputState[habitId] = normalized;
        input.checked = normalized;
        input.indeterminate = false;
      }
    } else {
      const input = item.querySelector(".habit-number__input");
      if (!(input instanceof HTMLInputElement)) return;
      const numeric = normalizeNumericValue(habitInputState[habitId]);
      if (numeric == null) {
        habitInputState[habitId] = null;
        input.value = "";
      } else {
        habitInputState[habitId] = numeric;
        input.value = Number.isInteger(numeric) ? String(numeric) : String(numeric);
      }
    }
  });
}

function showToast(message, variant = "success") {
  if (!toastElement) return;
  const variants = ["success", "error", "info"];
  toastElement.hidden = false;
  variants.forEach((name) => toastElement.classList.remove(`toast--${name}`));
  if (variants.includes(variant)) {
    toastElement.classList.add(`toast--${variant}`);
  } else {
    toastElement.classList.add("toast--success");
  }
  toastElement.textContent = message;
  // Force reflow so that successive toasts animate correctly
  void toastElement.offsetWidth;
  toastElement.classList.add("is-visible");

  if (toastHideTimer) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }
  if (toastRemoveTimer) {
    clearTimeout(toastRemoveTimer);
    toastRemoveTimer = null;
  }

  toastHideTimer = setTimeout(() => {
    toastElement.classList.remove("is-visible");
    toastRemoveTimer = setTimeout(() => {
      toastElement.hidden = true;
      toastRemoveTimer = null;
    }, 300);
    toastHideTimer = null;
  }, 2500);
}

function logAndToastError(logMessage, error, toastMessage = "エラーが発生しました") {
  console.error(logMessage, error);
  showToast(toastMessage, "error");
}

let lastKnownOnlineStatus = null;

function updateConnectivityState(isOnline, { silent = false } = {}) {
  if (offlineWarning) {
    offlineWarning.hidden = isOnline;
  }
  if (saveBtn) {
    saveBtn.disabled = !isOnline;
  }
  if (saveStatus) {
    if (!isOnline) {
      saveStatus.dataset.offlineMessage = "true";
      saveStatus.textContent = "オフラインのため保存できません";
    } else if (saveStatus.dataset.offlineMessage === "true") {
      saveStatus.textContent = "";
      delete saveStatus.dataset.offlineMessage;
    }
  }
  if (!silent && lastKnownOnlineStatus !== isOnline) {
    showToast(
      isOnline
        ? "オンラインに再接続しました"
        : "オフラインです。接続を確認してください。",
      isOnline ? "info" : "error"
    );
  }
  lastKnownOnlineStatus = isOnline;
}

function renderHabitEditorList(habits) {
  if (!habitEditorList || !habitEditorEmpty) return;
  habitEditorList.innerHTML = "";
  const sorted = sortHabitsByOrder(habits);

  if (!sorted.length) {
    habitEditorEmpty.hidden = false;
    return;
  }
  habitEditorEmpty.hidden = true;

  sorted.forEach((habit) => {
    const form = document.createElement("form");
    form.className = "habit-editor__item";
    form.dataset.habitId = habit.id;

    const grid = document.createElement("div");
    grid.className = "habit-editor__grid";

    const nameLabel = document.createElement("label");
    nameLabel.className = "field-group";
    const nameSpan = document.createElement("span");
    nameSpan.className = "field-group__label";
    nameSpan.textContent = "名前";
    const nameInput = document.createElement("input");
    nameInput.className = "field-group__input";
    nameInput.name = "name";
    nameInput.required = true;
    nameInput.value = habit.name || "";
    nameLabel.appendChild(nameSpan);
    nameLabel.appendChild(nameInput);

    const typeLabel = document.createElement("label");
    typeLabel.className = "field-group";
    const typeSpan = document.createElement("span");
    typeSpan.className = "field-group__label";
    typeSpan.textContent = "タイプ";
    const typeInput = document.createElement("input");
    typeInput.className = "field-group__input";
    typeInput.name = "type";
    typeInput.required = true;
    typeInput.value = habit.type || "";
    typeLabel.appendChild(typeSpan);
    typeLabel.appendChild(typeInput);

    const unitLabel = document.createElement("label");
    unitLabel.className = "field-group";
    const unitSpan = document.createElement("span");
    unitSpan.className = "field-group__label";
    unitSpan.textContent = "単位";
    const unitInput = document.createElement("input");
    unitInput.className = "field-group__input";
    unitInput.name = "unit";
    unitInput.value = habit.unit || "";
    unitLabel.appendChild(unitSpan);
    unitLabel.appendChild(unitInput);

    const activeLabel = document.createElement("label");
    activeLabel.className = "habit-editor__checkbox";
    const activeInput = document.createElement("input");
    activeInput.type = "checkbox";
    activeInput.name = "active";
    activeInput.checked = habit.active !== false;
    const activeSpan = document.createElement("span");
    activeSpan.textContent = "アクティブ";
    activeLabel.appendChild(activeInput);
    activeLabel.appendChild(activeSpan);

    const orderInput = document.createElement("input");
    orderInput.type = "hidden";
    orderInput.name = "order";
    orderInput.value = parseOrder(habit.order);

    grid.appendChild(nameLabel);
    grid.appendChild(typeLabel);
    grid.appendChild(unitLabel);
    grid.appendChild(activeLabel);

    const actions = document.createElement("div");
    actions.className = "habit-editor__actions";

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "habit-editor__save";
    saveButton.textContent = "保存";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "habit-editor__delete";
    deleteButton.dataset.action = "deactivate";
    deleteButton.textContent = "削除";

    const status = document.createElement("span");
    status.className = "habit-editor__status";
    status.setAttribute("aria-live", "polite");

    actions.appendChild(saveButton);
    actions.appendChild(deleteButton);
    actions.appendChild(status);

    form.appendChild(grid);
    form.appendChild(orderInput);
    form.appendChild(actions);

    habitEditorList.appendChild(form);
  });
}

async function fetchHabits({ activeOnly = false } = {}) {
  const habitsRef = collection(db, "habits");
  let habitsQuery;
  if (activeOnly) {
    habitsQuery = query(habitsRef, where("active", "==", true), orderBy("order"));
  } else {
    habitsQuery = query(habitsRef, orderBy("order"));
  }
  const snap = await getDocs(habitsQuery);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

async function refreshActiveHabitList() {
  try {
    const activeHabits = await fetchHabits({ activeOnly: true });
    updateActiveHabitsCache(activeHabits);
    renderActiveHabits(activeHabits);
  } catch (error) {
    logAndToastError("Failed to load active habits", error, "習慣の読み込みに失敗しました");
  }
}

async function loadHabitsForEditor() {
  try {
    habitEditorCache = await fetchHabits({ activeOnly: false });
    updateActiveHabitsCache(habitEditorCache);
    renderHabitEditorList(habitEditorCache);
  } catch (error) {
    logAndToastError("Failed to load habits", error, "習慣の読み込みに失敗しました");
    if (habitEditorError) {
      habitEditorError.textContent = "習慣の読み込みに失敗しました";
    }
  }
}

async function loadEntry(dateStr) {
  const docId = `entry_${dateStr}`;
  const entryRef = doc(db, "entries", docId);
  const snap = await getDoc(entryRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function saveEntry(dateStr) {
  const values = { ...(currentEntryData?.values ?? {}) };
  activeHabitsCache.forEach((habit) => {
    if (!habit?.id) return;
    const mode = getHabitMode(habit);
    if (mode === "boolean") {
      const normalized = normalizeBooleanValue(habitInputState[habit.id]);
      values[habit.id] = normalized;
    } else {
      const rawValue = habitInputState[habit.id];
      let numericValue = null;
      if (rawValue == null) {
        numericValue = null;
      } else if (typeof rawValue === "number") {
        numericValue = Number.isFinite(rawValue) ? rawValue : null;
      } else if (typeof rawValue === "string" && rawValue.trim() !== "") {
        const parsed = parseFloat(rawValue);
        numericValue = Number.isFinite(parsed) ? parsed : null;
      } else {
        numericValue = normalizeNumericValue(rawValue);
      }
      values[habit.id] = numericValue;
    }
  });
  Object.keys(values).forEach((key) => {
    if (values[key] === undefined) {
      values[key] = null;
    }
  });
  const docId = `entry_${dateStr}`;
  const entryRef = doc(db, "entries", docId);
  const payload = {
    date: dateStr,
    diary: diaryInput.value || "",
    memo: memoInput.value || "",
    values,
    updatedAt: serverTimestamp(),
  };
  payload.study = deleteField();
  if (!currentEntryData?.id) {
    payload.createdAt = serverTimestamp();
  }
  await setDoc(entryRef, payload, { merge: true });
  const savedSnap = await getDoc(entryRef);
  if (savedSnap.exists()) {
    return { id: savedSnap.id, ...savedSnap.data() };
  }
  return { id: docId, ...payload };
}

function showEntry(dateStr, entry) {
  currentViewingDate = dateStr;
  const displayDate = formatDisplayDate(dateStr);
  if (viewingDateLabel) {
    viewingDateLabel.textContent = `表示中の日付: ${displayDate}`;
  }
  if (datePicker) {
    datePicker.value = dateStr;
  }
  if (saveStatus) {
    saveStatus.textContent = "";
  }

  if (!entry) {
    currentEntryData = null;
    if (diaryInput) {
      diaryInput.value = "";
    }
    if (memoInput) {
      memoInput.value = "";
    }
    if (debugOutput) {
      debugOutput.textContent = "(データなし)";
    }
    habitInputState = {};
    updateHabitInputsFromState();
  } else {
    const sanitizedEntry = { ...entry };
    if ("study" in sanitizedEntry) {
      delete sanitizedEntry.study;
    }
    currentEntryData = sanitizedEntry;
    if (diaryInput) {
      diaryInput.value = sanitizedEntry.diary ?? "";
    }
    if (memoInput) {
      memoInput.value = sanitizedEntry.memo ?? "";
    }
    if (debugOutput) {
      debugOutput.textContent = JSON.stringify(sanitizedEntry, null, 2);
    }
    setHabitInputStateFromEntry(sanitizedEntry);
    updateHabitInputsFromState();
  }
}

async function changeViewingDate(dateStr) {
  if (!dateStr) return;
  try {
    const entry = await loadEntry(dateStr);
    showEntry(dateStr, entry);
  } catch (error) {
    logAndToastError("Failed to load entry", error, "データの読み込みに失敗しました");
  }
}

saveBtn?.addEventListener("click", async () => {
  if (!navigator.onLine) {
    if (saveStatus) {
      saveStatus.dataset.offlineMessage = "true";
      saveStatus.textContent = "オフラインのため保存できません";
    }
    showToast("オフラインのため保存できません。接続後に再試行してください。", "error");
    return;
  }
  if (saveStatus) {
    saveStatus.textContent = "保存中...";
  }
  try {
    const saved = await saveEntry(currentViewingDate);
    const merged = currentEntryData ? { ...currentEntryData, ...saved } : saved;
    if (merged && typeof merged === "object" && "study" in merged) {
      delete merged.study;
    }
    currentEntryData = merged;
    if (debugOutput) {
      debugOutput.textContent = JSON.stringify(merged, null, 2);
    }
    setHabitInputStateFromEntry(merged);
    updateHabitInputsFromState();
    if (saveStatus) {
      saveStatus.textContent = "保存しました";
      setTimeout(() => {
        if (saveStatus.textContent === "保存しました") {
          saveStatus.textContent = "";
        }
      }, 1500);
    }
    showToast("保存しました", "success");
  } catch (error) {
    logAndToastError("Failed to save entry", error, "保存に失敗しました");
    if (saveStatus) {
      saveStatus.textContent = "保存に失敗しました";
    }
  }
});

prevBtn?.addEventListener("click", async () => {
  const baseDate = parseISODate(currentViewingDate);
  if (!baseDate) return;
  baseDate.setDate(baseDate.getDate() - 1);
  await changeViewingDate(formatDate(baseDate));
});

nextBtn?.addEventListener("click", async () => {
  const baseDate = parseISODate(currentViewingDate);
  if (!baseDate) return;
  baseDate.setDate(baseDate.getDate() + 1);
  await changeViewingDate(formatDate(baseDate));
});

todayBtn?.addEventListener("click", async () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  await changeViewingDate(formatDate(now));
});

datePicker?.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const value = target.value;
  if (!value) return;
  await changeViewingDate(value);
});

function toggleModal(show) {
  if (!exportModal) return;
  if (show) {
    exportModal.hidden = false;
  } else {
    exportModal.hidden = true;
  }
}

function toggleHabitModal(show) {
  if (!habitModal) return;
  habitEditorError && (habitEditorError.textContent = "");
  if (show) {
    habitModal.hidden = false;
  } else {
    habitModal.hidden = true;
  }
}

function csvEscape(value) {
  const stringValue = value == null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildDateRange(days, endDate = new Date()) {
  const range = [];
  const startDate = new Date(endDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (days - 1));
  const cursor = startDate;
  for (let i = 0; i < days; i += 1) {
    range.push(formatDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return range;
}

function getHabitMode(habit) {
  const type = (habit?.type ?? "").toString().toLowerCase();
  if (type.includes("bool") || type.includes("check")) {
    return "boolean";
  }
  if (type.includes("number") || type.includes("num") || type.includes("count") || type.includes("time")) {
    return "number";
  }
  return "number";
}

function normalizeBooleanValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "done"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "undone"].includes(normalized)) return false;
  }
  return null;
}

function normalizeNumericValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractHabitValue(entry, habit) {
  if (!entry || !habit) return null;
  const identifiers = [habit.id, habit.name].filter((identifier) => identifier != null);
  const candidates = [
    entry.values,
    entry.habits,
    entry.habitRecords,
    entry.habitEntries,
    entry.habitResults,
  ];

  const resolveFromCandidate = (candidate) => {
    if (!candidate) return undefined;
    if (Array.isArray(candidate)) {
      return candidate.find((item) =>
        identifiers.some((identifier) => {
          if (identifier == null) return false;
          const idString = identifier.toString();
          return (
            item?.habitId === identifier ||
            item?.habitId === idString ||
            item?.id === identifier ||
            item?.id === idString ||
            item?.name === identifier ||
            item?.name === idString
          );
        })
      );
    }
    if (typeof candidate === "object") {
      for (const identifier of identifiers) {
        if (identifier == null) continue;
        const idString = identifier.toString();
        if (Object.prototype.hasOwnProperty.call(candidate, identifier)) {
          return candidate[identifier];
        }
        if (Object.prototype.hasOwnProperty.call(candidate, idString)) {
          return candidate[idString];
        }
      }
    }
    return undefined;
  };

  for (const candidate of candidates) {
    const record = resolveFromCandidate(candidate);
    if (record !== undefined) {
      if (record === null) return null;
      if (typeof record === "object") {
        if (record.value !== undefined) return record.value;
        if (record.done !== undefined) return record.done;
        if (record.score !== undefined) return record.score;
      }
      return record;
    }
  }

  return null;
}

async function fetchRecentEntries(days = HISTORY_RANGE_DAYS) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (days - 1));
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  const entriesRef = collection(db, "entries");
  const entriesQuery = query(
    entriesRef,
    where("date", ">=", start),
    where("date", "<=", end),
    orderBy("date")
  );
  const snap = await getDocs(entriesQuery);
  const map = new Map();
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data?.date) {
      map.set(data.date, { id: docSnap.id, ...data });
    }
  });
  return { map, start, end };
}

function prepareHabitSeries(habit, entriesMap, dates) {
  const mode = getHabitMode(habit);
  const chartValues = [];
  const rawValues = [];

  dates.forEach((date) => {
    const entry = entriesMap.get(date);
    const value = extractHabitValue(entry, habit);
    if (mode === "boolean") {
      const normalized = normalizeBooleanValue(value);
      rawValues.push(normalized);
      chartValues.push(normalized == null ? null : normalized ? 1 : 0);
    } else {
      const numeric = normalizeNumericValue(value);
      rawValues.push(numeric);
      chartValues.push(numeric);
    }
  });

  return { mode, chartValues, rawValues };
}

function updateHistoryStatus(message = "", state = "info") {
  if (!historyStatus) return;
  historyStatus.textContent = message;
  if (message) {
    historyStatus.dataset.state = state;
  } else {
    historyStatus.dataset.state = "info";
  }
}

function renderHistoryChart(habit, dates, chartValues, rawValues, mode) {
  if (!historyChartCanvas || typeof Chart === "undefined") {
    return;
  }

  const hasData = chartValues.some((value) => value != null);
  if (historyChartContainer) {
    historyChartContainer.classList.toggle("is-hidden", !hasData);
  }
  if (historyChartEmpty) {
    historyChartEmpty.hidden = hasData;
  }

  if (!hasData) {
    if (historyChartInstance) {
      historyChartInstance.destroy();
      historyChartInstance = null;
    }
    return;
  }

  const ctx = historyChartCanvas.getContext("2d");
  if (!ctx) return;

  if (historyChartInstance) {
    historyChartInstance.destroy();
  }

  const displayLabels = dates.map((date) => date.slice(5));
  const chartType = mode === "boolean" ? "bar" : "line";
  const datasetLabel = habit?.name || "選択中の習慣";

  historyChartInstance = new Chart(ctx, {
    type: chartType,
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: datasetLabel,
          data: chartValues,
          backgroundColor: mode === "boolean" ? "rgba(84, 104, 255, 0.5)" : "rgba(84, 104, 255, 0.25)",
          borderColor: "#5468ff",
          borderWidth: 2,
          fill: mode !== "boolean",
          tension: mode === "boolean" ? 0 : 0.35,
          pointRadius: mode === "boolean" ? 0 : 4,
          pointHoverRadius: mode === "boolean" ? 0 : 6,
          spanGaps: true,
          borderRadius: mode === "boolean" ? 6 : undefined,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: mode === "boolean" ? 1 : undefined,
          max: mode === "boolean" ? 1 : undefined,
          ticks:
            mode === "boolean"
              ? {
                  stepSize: 1,
                  callback: (value) => (Number(value) === 1 ? "達成" : "未達"),
                }
              : undefined,
        },
      },
      plugins: {
        legend: {
          display: true,
        },
        tooltip: {
          callbacks: {
            title: (context) => {
              const index = context[0]?.dataIndex ?? 0;
              return dates[index] ?? "";
            },
            label: (context) => {
              const index = context.dataIndex ?? 0;
              const rawValue = rawValues[index];
              if (mode === "boolean") {
                if (rawValue === true) return "達成";
                if (rawValue === false) return "未達";
                return "記録なし";
              }
              if (rawValue == null) {
                return "記録なし";
              }
              return `${rawValue}`;
            },
          },
        },
      },
    },
  });
}

function renderHistoryCalendar(habit, dates, values, mode) {
  if (!historyCalendar) return;
  historyCalendar.innerHTML = "";

  const hasData = values.some((value) => value != null);
  historyCalendar.classList.toggle("is-hidden", !hasData);
  if (historyCalendarEmpty) {
    historyCalendarEmpty.hidden = hasData;
  }

  if (!hasData) {
    return;
  }

  let maxValue = 0;
  if (mode === "number") {
    values.forEach((value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        maxValue = Math.max(maxValue, Math.abs(value));
      }
    });
  }

  dates.forEach((date, index) => {
    const cell = document.createElement("div");
    cell.className = "history-calendar__item";
    cell.title = `${habit?.name ?? "習慣"} - ${date}`;

    const dateLabel = document.createElement("span");
    dateLabel.className = "history-calendar__date";
    dateLabel.textContent = date.slice(5);
    cell.appendChild(dateLabel);

    const value = values[index];
    if (mode === "boolean") {
      const icon = document.createElement("span");
      icon.className = "history-calendar__icon";
      if (value === true) {
        icon.textContent = "✓";
        cell.dataset.state = "true";
      } else if (value === false) {
        icon.textContent = "×";
        cell.dataset.state = "false";
      } else {
        icon.textContent = "–";
        cell.dataset.state = "empty";
      }
      cell.appendChild(icon);
    } else {
      const numericValue = typeof value === "number" && Number.isFinite(value) ? value : null;
      const valueElement = document.createElement("span");
      valueElement.className = "history-calendar__value";
      if (numericValue == null) {
        cell.dataset.state = "empty";
        valueElement.textContent = "—";
      } else {
        cell.dataset.state = "number";
        valueElement.textContent = Number.isInteger(numericValue)
          ? numericValue.toString()
          : numericValue.toFixed(1);
        const intensity = maxValue > 0 ? Math.min(Math.abs(numericValue) / maxValue, 1) : 0.2;
        const alpha = 0.2 + intensity * 0.6;
        cell.style.background = `rgba(84, 104, 255, ${alpha.toFixed(3)})`;
      }
      cell.appendChild(valueElement);
    }

    historyCalendar.appendChild(cell);
  });
}

function populateHistoryHabitSelect(habits) {
  if (!historyHabitSelect) return;
  const previousValue = historyHabitSelect.value;
  historyHabitSelect.innerHTML = "";

  if (!habits.length) {
    historyHabitSelect.disabled = true;
    if (historyEmptyMessage) {
      historyEmptyMessage.hidden = false;
    }
    return;
  }

  historyHabitSelect.disabled = false;
  if (historyEmptyMessage) {
    historyEmptyMessage.hidden = true;
  }

  habits.forEach((habit) => {
    const option = document.createElement("option");
    option.value = habit.id;
    option.textContent = habit.name || "(名称未設定)";
    historyHabitSelect.appendChild(option);
  });

  if (previousValue && habits.some((habit) => habit.id === previousValue)) {
    historyHabitSelect.value = previousValue;
  } else if (habits.length) {
    historyHabitSelect.value = habits[0].id;
  }
}

function updateHistoryView() {
  if (!historyHabitSelect) return;
  const habitId = historyHabitSelect.value;
  const habit = activeHabitsCache.find((item) => item.id === habitId);

  if (!habit) {
    renderHistoryChart(null, [], [], [], "number");
    renderHistoryCalendar(null, [], [], "number");
    return;
  }

  const entriesMap = recentEntriesCache?.map ?? new Map();
  const dates = buildDateRange(HISTORY_RANGE_DAYS);
  const { mode, chartValues, rawValues } = prepareHabitSeries(habit, entriesMap, dates);
  renderHistoryChart(habit, dates, chartValues, rawValues, mode);
  renderHistoryCalendar(habit, dates, rawValues, mode);
}

async function loadHistoryData() {
  updateHistoryStatus("読み込み中...", "loading");
  if (historyHabitSelect) {
    historyHabitSelect.disabled = true;
  }
  try {
    const [habits, entriesResult] = await Promise.all([
      fetchHabits({ activeOnly: true }),
      fetchRecentEntries(HISTORY_RANGE_DAYS),
    ]);
    updateActiveHabitsCache(habits);
    populateHistoryHabitSelect(activeHabitsCache);
    recentEntriesCache = entriesResult;
    updateHistoryStatus("", "info");
    updateHistoryView();
  } catch (error) {
    logAndToastError("Failed to load history data", error, "履歴の読み込みに失敗しました");
    updateHistoryStatus("履歴の読み込みに失敗しました", "error");
    if (historyChartContainer) {
      historyChartContainer.classList.add("is-hidden");
    }
    if (historyChartEmpty) {
      historyChartEmpty.hidden = false;
    }
    if (historyCalendar) {
      historyCalendar.classList.add("is-hidden");
    }
    if (historyCalendarEmpty) {
      historyCalendarEmpty.hidden = false;
    }
  }
}

function toggleHistoryModal(show) {
  if (!historyModal) return;
  if (!show) {
    if (historyChartInstance) {
      historyChartInstance.destroy();
      historyChartInstance = null;
    }
    recentEntriesCache = null;
    updateHistoryStatus("", "info");
  }
  historyModal.hidden = !show;
}

async function fetchEntriesBetween(fromDate, toDate) {
  const entriesRef = collection(db, "entries");
  const entriesQuery = query(
    entriesRef,
    where("date", ">=", fromDate),
    where("date", "<=", toDate),
    orderBy("date")
  );
  const snap = await getDocs(entriesQuery);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

async function exportCsv(fromDate, toDate) {
  const [entries, habits] = await Promise.all([
    fetchEntriesBetween(fromDate, toDate),
    fetchHabits({ activeOnly: false }),
  ]);

  const sortedHabits = sortHabitsByOrder(habits);
  const header = ["date", "diary", ...sortedHabits.map((habit) => habit.name || "(名称未設定)")];

  const sortedEntries = entries
    .filter((entry) => entry.date)
    .sort((a, b) => {
      const aDate = a.date ?? "";
      const bDate = b.date ?? "";
      return aDate.localeCompare(bDate);
    });

  const rows = [header];

  sortedEntries.forEach((entry) => {
    const row = [entry.date ?? "", entry.diary ?? ""];
    sortedHabits.forEach((habit) => {
      const mode = getHabitMode(habit);
      const rawValue = extractHabitValue(entry, habit);
      if (mode === "boolean") {
        const normalized = normalizeBooleanValue(rawValue);
        row.push(normalized == null ? "" : normalized ? "1" : "0");
      } else {
        const numeric = normalizeNumericValue(rawValue);
        row.push(numeric == null ? "" : String(numeric));
      }
    });
    rows.push(row);
  });

  const csvString = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `habitapp_${fromDate}_${toDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function resetExportFormDefaults() {
  if (!exportFromInput || !exportToInput) return;
  const todayStr = formatDate(new Date());
  exportFromInput.value = exportFromInput.value || todayStr;
  exportToInput.value = exportToInput.value || todayStr;
  if (exportError) {
    exportError.textContent = "";
  }
}

if (exportBtn && exportModal) {
  exportBtn.addEventListener("click", () => {
    resetExportFormDefaults();
    toggleModal(true);
  });
}

exportModal?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.modalClose !== undefined) {
    toggleModal(false);
  }
});

if (editHabitsBtn && habitModal) {
  editHabitsBtn.addEventListener("click", async () => {
    await loadHabitsForEditor();
    await refreshActiveHabitList();
    toggleHabitModal(true);
  });
}

habitModal?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.modalClose !== undefined) {
    toggleHabitModal(false);
  }
});

if (historyBtn && historyModal) {
  historyBtn.addEventListener("click", async () => {
    toggleHistoryModal(true);
    await loadHistoryData();
  });
}

historyModal?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.modalClose !== undefined) {
    toggleHistoryModal(false);
  }
});

historyHabitSelect?.addEventListener("change", () => {
  updateHistoryView();
});

habitEditorList?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const habitId = form.dataset.habitId;
  if (!habitId) return;

  const formData = new FormData(form);
  const name = (formData.get("name") ?? "").toString().trim();
  const type = (formData.get("type") ?? "").toString().trim();
  const unit = (formData.get("unit") ?? "").toString().trim();
  const orderValue = formData.get("order");
  const active = formData.get("active") === "on";

  if (!name || !type) {
    const status = form.querySelector(".habit-editor__status");
    if (status) {
      status.textContent = "名前とタイプは必須です";
    }
    return;
  }

  const order = parseOrder(orderValue);
  const updatePayload = {
    name,
    type,
    unit,
    active,
    order,
    updatedAt: serverTimestamp(),
  };

  const status = form.querySelector(".habit-editor__status");
  if (status) {
    status.textContent = "保存中...";
  }

  try {
    await setDoc(doc(db, "habits", habitId), updatePayload, { merge: true });
    habitEditorCache = habitEditorCache.map((habit) =>
      habit.id === habitId ? { ...habit, ...updatePayload } : habit
    );
    updateActiveHabitsCache(habitEditorCache);
    renderActiveHabits(activeHabitsCache);
    if (status) {
      status.textContent = "保存しました";
      setTimeout(() => {
        if (form.contains(status)) {
          status.textContent = "";
        }
      }, 1500);
    }
  } catch (error) {
    logAndToastError("Failed to update habit", error, "習慣の更新に失敗しました");
    if (status) {
      status.textContent = "保存に失敗しました";
    }
  }
});

habitEditorList?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.action !== "deactivate") return;

  const form = target.closest("form");
  if (!(form instanceof HTMLFormElement)) return;
  const habitId = form.dataset.habitId;
  if (!habitId) return;

  const status = form.querySelector(".habit-editor__status");
  if (status) {
    status.textContent = "削除中...";
  }

  try {
    await setDoc(
      doc(db, "habits", habitId),
      { active: false, updatedAt: serverTimestamp() },
      { merge: true }
    );
    habitEditorCache = habitEditorCache.map((habit) =>
      habit.id === habitId ? { ...habit, active: false } : habit
    );
    const activeInput = form.querySelector('input[name="active"]');
    if (activeInput instanceof HTMLInputElement) {
      activeInput.checked = false;
    }
    updateActiveHabitsCache(habitEditorCache);
    renderActiveHabits(activeHabitsCache);
    if (status) {
      status.textContent = "非アクティブにしました";
      setTimeout(() => {
        if (form.contains(status)) {
          status.textContent = "";
        }
      }, 1500);
    }
  } catch (error) {
    logAndToastError("Failed to deactivate habit", error, "習慣の更新に失敗しました");
    if (status) {
      status.textContent = "削除に失敗しました";
    }
  }
});

newHabitForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  habitEditorError && (habitEditorError.textContent = "");

  const formData = new FormData(newHabitForm);
  const name = (formData.get("name") ?? "").toString().trim();
  const type = (formData.get("type") ?? "").toString().trim();
  const unit = (formData.get("unit") ?? "").toString().trim();
  const active = formData.get("active") === "on";

  if (!name || !type) {
    if (habitEditorError) {
      habitEditorError.textContent = "名前とタイプを入力してください";
    }
    return;
  }

  const currentMaxOrder = habitEditorCache.reduce(
    (max, habit) => Math.max(max, parseOrder(habit.order)),
    0
  );
  const payload = {
    name,
    type,
    unit,
    active,
    order: currentMaxOrder + 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, "habits"), payload);
    await loadHabitsForEditor();
    renderActiveHabits(activeHabitsCache);
    newHabitForm.reset();
    const activeInput = newHabitForm.querySelector('input[name="active"]');
    if (activeInput instanceof HTMLInputElement) {
      activeInput.checked = true;
    }
  } catch (error) {
    logAndToastError("Failed to add habit", error, "習慣の追加に失敗しました");
    if (habitEditorError) {
      habitEditorError.textContent = "習慣の追加に失敗しました";
    }
  }
});

exportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (exportError) {
    exportError.textContent = "";
  }
  if (!exportFromInput || !exportToInput) {
    if (exportError) {
      exportError.textContent = "フォームの要素が見つかりません";
    }
    return;
  }
  const fromDate = exportFromInput.value;
  const toDate = exportToInput.value;

  if (!fromDate || !toDate) {
    if (exportError) {
      exportError.textContent = "開始日と終了日を入力してください";
    }
    return;
  }

  if (fromDate > toDate) {
    if (exportError) {
      exportError.textContent = "開始日は終了日以前の日付を指定してください";
    }
    return;
  }

  try {
    await exportCsv(fromDate, toDate);
    toggleModal(false);
    exportForm.reset();
  } catch (error) {
    logAndToastError("export failed", error, "エクスポートに失敗しました");
    if (exportError) {
      exportError.textContent = "エクスポートに失敗しました";
    }
  }
});

updateConnectivityState(navigator.onLine, { silent: true });
window.addEventListener("online", () => updateConnectivityState(true));
window.addEventListener("offline", () => updateConnectivityState(false));

refreshActiveHabitList();

// 起動時に今日のデータを読み込む
changeViewingDate(currentViewingDate);
