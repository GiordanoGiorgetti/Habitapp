import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  setDoc,
  addDoc,
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
const studyMinutesInput = document.getElementById("study-minutes");
const diaryInput = document.getElementById("diary");
const memoInput = document.getElementById("memo");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const prevBtn = document.getElementById("prev-btn");
const todayBtn = document.getElementById("today-btn");
const viewingDateLabel = document.getElementById("viewing-date");
const debugOutput = document.getElementById("debug-output");
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

let habitEditorCache = [];

todayLabel.textContent = `今日は ${currentViewingDate} です`;

function parseOrder(order) {
  const value = Number(order);
  return Number.isFinite(value) ? value : 0;
}

function sortHabitsByOrder(habits) {
  return habits.slice().sort((a, b) => parseOrder(a.order) - parseOrder(b.order));
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
    return;
  }

  sorted.forEach((habit) => {
    const item = document.createElement("li");
    item.className = "habit-list__item";

    const label = document.createElement("label");
    label.className = "habit-toggle";

    const input = document.createElement("input");
    input.className = "habit-toggle__input";
    input.type = "checkbox";
    input.id = `habit-${habit.id}`;

    const span = document.createElement("span");
    span.className = "habit-toggle__label";
    span.textContent = habit.name || "(名称未設定)";

    label.appendChild(input);
    label.appendChild(span);
    item.appendChild(label);
    habitListElement.appendChild(item);
  });
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
    renderActiveHabits(activeHabits);
  } catch (error) {
    console.error("Failed to load active habits", error);
  }
}

async function loadHabitsForEditor() {
  try {
    habitEditorCache = await fetchHabits({ activeOnly: false });
    renderHabitEditorList(habitEditorCache);
  } catch (error) {
    console.error("Failed to load habits", error);
    if (habitEditorError) {
      habitEditorError.textContent = "習慣の読み込みに失敗しました";
    }
  }
}

async function loadEntry(dateStr) {
  const q = query(collection(db, "entries"), where("date", "==", dateStr));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  let data = null;
  snap.forEach((docSnap) => (data = { id: docSnap.id, ...docSnap.data() }));
  return data;
}

async function saveEntry(dateStr) {
  const data = {
    date: dateStr,
    study: { minutes: Number(studyMinutesInput.value || 0) },
    diary: diaryInput.value || "",
    memo: memoInput.value || "",
    updatedAt: new Date(),
  };
  const docId = `entry_${dateStr}`;
  await setDoc(doc(db, "entries", docId), data, { merge: true });
  return data;
}

function showEntry(dateStr, entry) {
  currentViewingDate = dateStr;
  viewingDateLabel.textContent = `表示中の日付: ${dateStr}`;

  if (!entry) {
    studyMinutesInput.value = "";
    diaryInput.value = "";
    memoInput.value = "";
    debugOutput.textContent = "(データなし)";
  } else {
    studyMinutesInput.value = entry.study?.minutes ?? "";
    diaryInput.value = entry.diary ?? "";
    memoInput.value = entry.memo ?? "";
    debugOutput.textContent = JSON.stringify(entry, null, 2);
  }
}

saveBtn.addEventListener("click", async () => {
  saveStatus.textContent = "保存中...";
  const data = await saveEntry(currentViewingDate);
  saveStatus.textContent = "保存しました";
  debugOutput.textContent = JSON.stringify(data, null, 2);
  setTimeout(() => (saveStatus.textContent = ""), 1500);
});

prevBtn.addEventListener("click", async () => {
  const d = new Date(currentViewingDate);
  d.setDate(d.getDate() - 1);
  const dateStr = formatDate(d);
  const entry = await loadEntry(dateStr);
  showEntry(dateStr, entry);
});

todayBtn.addEventListener("click", async () => {
  const entry = await loadEntry(formatDate(today));
  showEntry(formatDate(today), entry);
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

async function fetchHabitsBetween(fromDate, toDate) {
  const habitsRef = collection(db, "habits");
  const habitsQuery = query(
    habitsRef,
    where("date", ">=", fromDate),
    where("date", "<=", toDate),
    orderBy("date")
  );
  const snap = await getDocs(habitsQuery);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

async function exportCsv(fromDate, toDate) {
  const [entries, habits] = await Promise.all([
    fetchEntriesBetween(fromDate, toDate),
    fetchHabitsBetween(fromDate, toDate),
  ]);

  const dateSet = new Set();
  const entryMap = new Map();
  entries.forEach((entry) => {
    if (entry.date) {
      dateSet.add(entry.date);
      entryMap.set(entry.date, entry);
    }
  });

  const habitNamesSet = new Set();
  const habitMap = new Map();
  habits.forEach((habit) => {
    if (!habit.date || !habit.name) return;
    dateSet.add(habit.date);
    habitNamesSet.add(habit.name);
    if (!habitMap.has(habit.date)) {
      habitMap.set(habit.date, new Map());
    }
    habitMap.get(habit.date).set(habit.name, habit);
  });

  const sortedDates = Array.from(dateSet).sort();
  const habitNames = Array.from(habitNamesSet).sort();

  const rows = [];
  rows.push(["date", "diary", ...habitNames]);

  sortedDates.forEach((date) => {
    const entry = entryMap.get(date) ?? {};
    const diary = entry.diary ?? "";
    const row = [date, diary];
    habitNames.forEach((habitName) => {
      const habitRecord = habitMap.get(date)?.get(habitName);
      if (habitRecord == null || habitRecord.done == null) {
        row.push("");
      } else {
        row.push(habitRecord.done ? "TRUE" : "FALSE");
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
    updatedAt: new Date(),
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
    renderActiveHabits(habitEditorCache.filter((habit) => habit.active !== false));
    if (status) {
      status.textContent = "保存しました";
      setTimeout(() => {
        if (form.contains(status)) {
          status.textContent = "";
        }
      }, 1500);
    }
  } catch (error) {
    console.error("Failed to update habit", error);
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
      { active: false, updatedAt: new Date() },
      { merge: true }
    );
    habitEditorCache = habitEditorCache.map((habit) =>
      habit.id === habitId ? { ...habit, active: false } : habit
    );
    const activeInput = form.querySelector('input[name="active"]');
    if (activeInput instanceof HTMLInputElement) {
      activeInput.checked = false;
    }
    renderActiveHabits(habitEditorCache.filter((habit) => habit.active !== false));
    if (status) {
      status.textContent = "非アクティブにしました";
      setTimeout(() => {
        if (form.contains(status)) {
          status.textContent = "";
        }
      }, 1500);
    }
  } catch (error) {
    console.error("Failed to deactivate habit", error);
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
  const timestamp = new Date();
  const payload = {
    name,
    type,
    unit,
    active,
    order: currentMaxOrder + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    await addDoc(collection(db, "habits"), payload);
    await loadHabitsForEditor();
    renderActiveHabits(habitEditorCache.filter((habit) => habit.active !== false));
    newHabitForm.reset();
    const activeInput = newHabitForm.querySelector('input[name="active"]');
    if (activeInput instanceof HTMLInputElement) {
      activeInput.checked = true;
    }
  } catch (error) {
    console.error("Failed to add habit", error);
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
    console.error("export failed", error);
    if (exportError) {
      exportError.textContent = "エクスポートに失敗しました";
    }
  }
});

refreshActiveHabitList();

// 起動時に今日のデータを読み込む
loadEntry(currentViewingDate).then((entry) => showEntry(currentViewingDate, entry));
