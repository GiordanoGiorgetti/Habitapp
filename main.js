import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  serverTimestamp,
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
const toast = document.getElementById("toast");
const networkWarning = document.getElementById("network-warning");
const prevBtn = document.getElementById("prev-btn");
const todayBtn = document.getElementById("today-btn");
const viewingDateLabel = document.getElementById("viewing-date");
const debugOutput = document.getElementById("debug-output");

todayLabel.textContent = `今日は ${currentViewingDate} です`;

function showToast(message, type = "info") {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("visible");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3000);
}

async function loadEntry(dateStr) {
  const docRef = doc(db, "entries", `entry_${dateStr}`);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function saveEntry(dateStr) {
  const docId = `entry_${dateStr}`;
  const docRef = doc(db, "entries", docId);
  let shouldSetCreatedAt = false;
  const existing = await getDoc(docRef);
  if (!existing.exists()) {
    shouldSetCreatedAt = true;
  }

  const data = {
    date: dateStr,
    training: { done: trainingDoneInput.checked },
    study: { minutes: Number(studyMinutesInput.value || 0) },
    memo: memoInput.value || "",
    updatedAt: serverTimestamp(),
  };

  if (shouldSetCreatedAt) {
    data.createdAt = serverTimestamp();
  }

  await setDoc(docRef, data, { merge: true });
  return data;
}

function updateNetworkWarning() {
  if (!networkWarning) return;
  if (navigator.onLine) {
    networkWarning.style.display = "none";
    networkWarning.setAttribute("aria-hidden", "true");
  } else {
    networkWarning.style.display = "block";
    networkWarning.setAttribute("aria-hidden", "false");
  }
}

window.addEventListener("online", () => {
  updateNetworkWarning();
  showToast("オンラインに復帰しました。", "info");
  loadEntry(currentViewingDate)
    .then((entry) => showEntry(currentViewingDate, entry))
    .catch((error) => {
      console.error("Failed to reload entry after reconnect", error);
      showToast("データの読み込みに失敗しました。", "error");
    });
});

window.addEventListener("offline", () => {
  updateNetworkWarning();
  showToast("現在オフラインです。", "error");
});

function showEntry(dateStr, entry) {
  currentViewingDate = dateStr;
  viewingDateLabel.textContent = `表示中の日付: ${dateStr}`;

  if (!entry) {
    trainingDoneInput.checked = false;
    studyMinutesInput.value = "";
    memoInput.value = "";
    debugOutput.textContent = "(データなし)";
  } else {
    trainingDoneInput.checked = !!entry.training?.done;
    studyMinutesInput.value = entry.study?.minutes ?? "";
    memoInput.value = entry.memo ?? "";
    debugOutput.textContent = JSON.stringify(entry, null, 2);
  }
}

saveBtn.addEventListener("click", async () => {
  if (!navigator.onLine) {
    showToast("オフラインのため保存できません。接続後に再試行してください。", "error");
    saveStatus.textContent = "保存に失敗しました";
    return;
  }

  saveStatus.textContent = "保存中...";
  try {
    const data = await saveEntry(currentViewingDate);
    saveStatus.textContent = "保存しました";
    debugOutput.textContent = JSON.stringify(data, null, 2);
    showToast("保存しました", "success");
    setTimeout(() => (saveStatus.textContent = ""), 1500);
  } catch (error) {
    console.error("Failed to save entry", error);
    saveStatus.textContent = "保存に失敗しました";
    showToast("データの保存に失敗しました。", "error");
  }
});

prevBtn.addEventListener("click", async () => {
  const d = new Date(currentViewingDate);
  d.setDate(d.getDate() - 1);
  const dateStr = formatDate(d);
  try {
    const entry = await loadEntry(dateStr);
    showEntry(dateStr, entry);
  } catch (error) {
    console.error("Failed to load previous entry", error);
    showToast("データの読み込みに失敗しました。", "error");
  }
});

todayBtn.addEventListener("click", async () => {
  try {
    const entry = await loadEntry(formatDate(today));
    showEntry(formatDate(today), entry);
  } catch (error) {
    console.error("Failed to load today's entry", error);
    showToast("データの読み込みに失敗しました。", "error");
  }
});

async function init() {
  updateNetworkWarning();
  if (!navigator.onLine) {
    showToast("現在オフラインです。", "error");
  }
  try {
    const entry = await loadEntry(currentViewingDate);
    showEntry(currentViewingDate, entry);
  } catch (error) {
    console.error("Failed to load initial entry", error);
    showToast("データの読み込みに失敗しました。", "error");
  }
}

init();
