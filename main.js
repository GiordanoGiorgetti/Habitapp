import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
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
const memoInput = document.getElementById("memo");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const todayBtn = document.getElementById("today-btn");
const viewingDateLabel = document.getElementById("viewing-date");
const debugOutput = document.getElementById("debug-output");
const datePicker = document.getElementById("date-picker");

todayLabel.textContent = `今日は ${currentViewingDate} です`;
datePicker.value = currentViewingDate;

function formatDateTime(value) {
  if (!value) return "";
  const d = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${y}-${m}-${day} ${hours}:${minutes}`;
}

async function loadEntry(dateStr) {
  const docId = `entry_${dateStr}`;
  const snap = await getDoc(doc(db, "entries", docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function saveEntry(dateStr) {
  const data = {
    date: dateStr,
    training: { done: trainingDoneInput.checked },
    study: { minutes: Number(studyMinutesInput.value || 0) },
    memo: memoInput.value || "",
    updatedAt: new Date(),
  };
  const docId = `entry_${dateStr}`;
  await setDoc(doc(db, "entries", docId), data, { merge: true });
  return data;
}

function showEntry(dateStr, entry) {
  currentViewingDate = dateStr;
  const updatedAt = formatDateTime(entry?.updatedAt);
  viewingDateLabel.textContent = updatedAt
    ? `表示中の日付: ${dateStr}（最終更新: ${updatedAt}）`
    : `表示中の日付: ${dateStr}`;
  if (datePicker.value !== dateStr) {
    datePicker.value = dateStr;
  }

  if (!entry) {
    trainingDoneInput.checked = false;
    studyMinutesInput.value = "";
    memoInput.value = "";
    debugOutput.textContent = "(データなし)";
  } else {
    trainingDoneInput.checked = !!entry.training?.done;
    studyMinutesInput.value = entry.study?.minutes ?? "";
    memoInput.value = entry.memo ?? "";
    const debugEntry = {
      ...entry,
      updatedAt: updatedAt || entry.updatedAt || null,
    };
    debugOutput.textContent = JSON.stringify(debugEntry, null, 2);
  }
}

let toastTimer = null;

function showToast(message) {
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  saveStatus.textContent = message;
  saveStatus.classList.add("visible");
  toastTimer = setTimeout(() => {
    saveStatus.classList.remove("visible");
    saveStatus.textContent = "";
  }, 2000);
}

async function updateForDate(dateStr) {
  const entry = await loadEntry(dateStr);
  showEntry(dateStr, entry);
}

function adjustDate(days) {
  const d = new Date(currentViewingDate);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

saveBtn.addEventListener("click", async () => {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  saveBtn.disabled = true;
  saveStatus.textContent = "保存中...";
  saveStatus.classList.add("visible");
  try {
    const data = await saveEntry(currentViewingDate);
    showEntry(currentViewingDate, data);
    showToast("保存しました");
  } catch (error) {
    console.error("Failed to save entry", error);
    showToast("保存に失敗しました");
  } finally {
    saveBtn.disabled = false;
  }
});

prevBtn.addEventListener("click", async () => {
  const dateStr = adjustDate(-1);
  await updateForDate(dateStr);
});

nextBtn.addEventListener("click", async () => {
  const dateStr = adjustDate(1);
  await updateForDate(dateStr);
});

todayBtn.addEventListener("click", async () => {
  const todayStr = formatDate(today);
  await updateForDate(todayStr);
});

datePicker.addEventListener("change", async (event) => {
  const value = event.target.value;
  if (!value) return;
  await updateForDate(value);
});

// 起動時に今日のデータを読み込む
updateForDate(currentViewingDate);
