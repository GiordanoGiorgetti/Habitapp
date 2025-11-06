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
const exportOpenBtn = document.getElementById("export-open-btn");
const exportModal = document.getElementById("export-modal");
const exportCancelBtn = document.getElementById("export-cancel-btn");
const exportForm = document.getElementById("export-form");
const exportFromInput = document.getElementById("export-from");
const exportToInput = document.getElementById("export-to");
const exportStatus = document.getElementById("export-status");

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

function openExportModal() {
  exportStatus.textContent = "";
  exportModal.classList.add("show");
}

function closeExportModal() {
  exportStatus.textContent = "";
  exportModal.classList.remove("show");
}

function escapeCsvValue(value) {
  if (value == null) return "";
  const str = String(value).replace(/\r?\n/g, "\n");
  if (/[,"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function extractHabitStatuses(data) {
  if (!data || typeof data !== "object") return {};
  const candidates = ["habits", "items", "values", "statuses"];
  for (const key of candidates) {
    const target = data[key];
    if (target && typeof target === "object" && !Array.isArray(target)) {
      return target;
    }
  }
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (["id", "date", "createdAt", "updatedAt"].includes(key)) continue;
    if (typeof value === "object") continue;
    result[key] = value;
  }
  return result;
}

async function fetchEntriesBetween(fromDate, toDate) {
  const entriesQuery = query(
    collection(db, "entries"),
    orderBy("date"),
    where("date", ">=", fromDate),
    where("date", "<=", toDate)
  );
  const snap = await getDocs(entriesQuery);
  const map = new Map();
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data?.date) {
      map.set(data.date, data);
    }
  });
  return map;
}

async function fetchHabitsBetween(fromDate, toDate) {
  const habitsQuery = query(
    collection(db, "habits"),
    orderBy("date"),
    where("date", ">=", fromDate),
    where("date", "<=", toDate)
  );
  const snap = await getDocs(habitsQuery);
  const map = new Map();
  const habitNames = new Set();
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data?.date) return;
    const statuses = extractHabitStatuses(data);
    map.set(data.date, statuses);
    Object.keys(statuses || {}).forEach((name) => habitNames.add(name));
  });
  return { map, habitNames: Array.from(habitNames).sort() };
}

async function exportCsv(fromDate, toDate) {
  exportStatus.textContent = "エクスポート中...";
  try {
    const [entries, habitsResult] = await Promise.all([
      fetchEntriesBetween(fromDate, toDate),
      fetchHabitsBetween(fromDate, toDate),
    ]);

    const allDates = new Set([...entries.keys(), ...habitsResult.map.keys()]);
    const sortedDates = Array.from(allDates).sort();

    const header = ["date", "diary", ...habitsResult.habitNames];
    const rows = [header];

    sortedDates.forEach((date) => {
      const entry = entries.get(date) || {};
      const habitStatuses = habitsResult.map.get(date) || {};
      const row = [
        date,
        entry.diary ?? "",
        ...habitsResult.habitNames.map((name) => {
          const value = habitStatuses[name];
          if (typeof value === "boolean") {
            return value ? "1" : "0";
          }
          if (value == null) return "";
          return String(value);
        }),
      ];
      rows.push(row);
    });

    const csvString = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habit_entries_${fromDate}_${toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    exportStatus.textContent = "CSV をダウンロードしました";
  } catch (error) {
    console.error(error);
    exportStatus.textContent = `エラーが発生しました: ${error.message}`;
  }
}

saveBtn.addEventListener("click", async () => {
  saveStatus.textContent = "保存中...";
  const data = await saveEntry(currentViewingDate);
  saveStatus.textContent = "保存しました";
  debugOutput.textContent = JSON.stringify(data, null, 2);
  setTimeout(() => (saveStatus.textContent = ""), 1500);
});

exportOpenBtn.addEventListener("click", () => {
  const initialDate = currentViewingDate;
  exportFromInput.value = initialDate;
  exportToInput.value = initialDate;
  openExportModal();
});

exportCancelBtn.addEventListener("click", () => {
  closeExportModal();
});

exportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fromDate = exportFromInput.value;
  const toDate = exportToInput.value;
  if (!fromDate || !toDate) {
    exportStatus.textContent = "期間を入力してください";
    return;
  }
  if (fromDate > toDate) {
    exportStatus.textContent = "From は To 以前の日付を指定してください";
    return;
  }
  await exportCsv(fromDate, toDate);
});

exportModal.addEventListener("click", (event) => {
  if (event.target === exportModal) {
    closeExportModal();
  }
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

// 起動時に今日のデータを読み込む
loadEntry(currentViewingDate).then((entry) => showEntry(currentViewingDate, entry));
