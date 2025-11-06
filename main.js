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
const trainingDoneInput = document.getElementById("training-done");
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

todayLabel.textContent = `今日は ${currentViewingDate} です`;

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
    training: { done: trainingDoneInput.checked },
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
    trainingDoneInput.checked = false;
    studyMinutesInput.value = "";
    diaryInput.value = "";
    memoInput.value = "";
    debugOutput.textContent = "(データなし)";
  } else {
    trainingDoneInput.checked = !!entry.training?.done;
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

// 起動時に今日のデータを読み込む
loadEntry(currentViewingDate).then((entry) => showEntry(currentViewingDate, entry));
