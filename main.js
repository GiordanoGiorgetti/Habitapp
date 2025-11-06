import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  addDoc,
  getDoc,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// 🔧 自分の firebaseConfig を貼る
const firebaseConfig = {
  apiKey: "AIzaSyCMJft6BfWUx8FSEt76O4iaCE13axt0dzY",
  authDomain: "habit-9e26c.firebaseapp.com",
  projectId: "habit-9e26c",
  storageBucket: "habit-9e26c.firebasestorage.app",
  messagingSenderId: "536564377863",
  appId: "1:536564377863:web:c2d91a99d7e0f0369abda2",
};

function validateFirebaseConfig(config) {
  const requiredKeys = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];
  const missingKeys = requiredKeys.filter((key) => !config[key]);
  if (missingKeys.length > 0) {
    throw new Error(`firebaseConfig の必須キーが不足しています: ${missingKeys.join(", ")}`);
  }
}

validateFirebaseConfig(firebaseConfig);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== DOM 要素参照 =====
const todayLabel = document.getElementById("today-label");
const trainingDoneInput = document.getElementById("training-done");
const studyMinutesInput = document.getElementById("study-minutes");
const memoInput = document.getElementById("memo");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const prevBtn = document.getElementById("prev-btn");
const todayBtn = document.getElementById("today-btn");
const viewingDateLabel = document.getElementById("viewing-date");
const debugOutput = document.getElementById("debug-output");
const habitsList = document.getElementById("habits-list");
const habitsEmptyMessage = document.getElementById("habits-empty");
const addHabitForm = document.getElementById("add-habit-form");
const newHabitInput = document.getElementById("new-habit-name");
const habitStatus = document.getElementById("habit-status");
const exportBtn = document.getElementById("export-btn");
const exportStatus = document.getElementById("export-status");
const configStatus = document.getElementById("config-status");
const chartEmptyMessage = document.getElementById("chart-empty-message");
const chartCanvas = document.getElementById("habit-chart");

// ===== 日付処理 =====
function formatDate(d) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const today = new Date();
let currentViewingDate = formatDate(today);
let habits = [];
let currentEntryHabits = {};
let habitChart = null;

todayLabel.textContent = `今日は ${currentViewingDate} です`;

function updateConfigStatus() {
  if (!configStatus) return;
  const currentHost = window.location.origin;
  const authDomain = firebaseConfig.authDomain || "(未設定)";
  const authDomainUrl = authDomain.startsWith("http") ? authDomain : `https://${authDomain}`;
  const hostMatches = authDomain && currentHost.includes(authDomain);
  const messageLines = [
    `現在のホスト: ${currentHost}`,
    `firebaseConfig.authDomain: ${authDomainUrl}`,
    hostMatches
      ? "✅ 現在のホストは firebaseConfig.authDomain と一致しています。"
      : "ℹ️ 現在のホストは firebaseConfig.authDomain と完全一致しません (GitHub Pages などのカスタムドメインでは正常なケースです)。",
  ];
  configStatus.innerHTML = messageLines.join("<br />");
}

updateConfigStatus();

// ===== Firestore からの読み込み =====
async function loadEntry(dateStr) {
  const docRef = doc(db, "entries", `entry_${dateStr}`);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: docRef.id, ...snap.data() };
}

async function saveEntry(dateStr) {
  const data = {
    date: dateStr,
    training: { done: trainingDoneInput.checked },
    study: { minutes: Number(studyMinutesInput.value || 0) },
    memo: memoInput.value || "",
    habits: collectHabitStates(),
    updatedAt: new Date().toISOString(),
  };
  const docId = `entry_${dateStr}`;
  await setDoc(doc(db, "entries", docId), data, { merge: true });
  return data;
}

async function loadHabits() {
  const q = query(collection(db, "habits"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  habits = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderHabits();
}

async function addHabit(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const docRef = await addDoc(collection(db, "habits"), {
    name: trimmed,
    createdAt: new Date(),
  });
  await loadHabits();
  return docRef;
}

async function fetchAllEntries() {
  const q = query(collection(db, "entries"), orderBy("date", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

// ===== 画面更新 =====
function renderHabits() {
  habitsList.innerHTML = "";
  if (habits.length === 0) {
    habitsEmptyMessage.hidden = false;
    return;
  }
  habitsEmptyMessage.hidden = true;

  habits.forEach((habit) => {
    if (!currentEntryHabits[habit.id]) {
      currentEntryHabits[habit.id] = { name: habit.name, done: false };
    } else {
      currentEntryHabits[habit.id].name = habit.name;
    }

    const item = document.createElement("div");
    item.className = "habit-item";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!currentEntryHabits[habit.id].done;
    checkbox.addEventListener("change", () => {
      currentEntryHabits[habit.id].done = checkbox.checked;
    });

    const nameSpan = document.createElement("span");
    nameSpan.textContent = habit.name;

    label.appendChild(checkbox);
    label.appendChild(nameSpan);
    item.appendChild(label);
    habitsList.appendChild(item);
  });
}

function collectHabitStates() {
  const result = {};
  habits.forEach((habit) => {
    const state = currentEntryHabits[habit.id] || { name: habit.name, done: false };
    result[habit.id] = {
      name: habit.name,
      done: !!state.done,
    };
  });
  return result;
}

function showEntry(dateStr, entry) {
  currentViewingDate = dateStr;
  viewingDateLabel.textContent = `表示中の日付: ${dateStr}`;

  if (!entry) {
    trainingDoneInput.checked = false;
    studyMinutesInput.value = "";
    memoInput.value = "";
    currentEntryHabits = {};
    renderHabits();
    debugOutput.textContent = "(データなし)";
    return;
  }

  trainingDoneInput.checked = !!entry.training?.done;
  studyMinutesInput.value = entry.study?.minutes ?? "";
  memoInput.value = entry.memo ?? "";

  currentEntryHabits = {};
  if (entry.habits) {
    Object.entries(entry.habits).forEach(([habitId, value]) => {
      currentEntryHabits[habitId] = {
        name: value?.name ?? habits.find((habit) => habit.id === habitId)?.name ?? "",
        done: !!value?.done,
      };
    });
  }
  renderHabits();

  debugOutput.textContent = JSON.stringify(entry, null, 2);
}

async function refreshVisualization() {
  if (!chartCanvas || typeof Chart === "undefined") {
    console.warn("Chart.js が読み込まれていません。可視化をスキップします。");
    return;
  }
  const entries = await fetchAllEntries();
  if (!entries.length) {
    chartEmptyMessage.hidden = false;
    if (habitChart) {
      habitChart.destroy();
      habitChart = null;
    }
    return;
  }

  chartEmptyMessage.hidden = true;

  const labels = entries.map((entry) => entry.date);
  const studyMinutes = entries.map((entry) => Number(entry.study?.minutes ?? 0));
  const habitCompletionRate = entries.map((entry) => {
    const habitStates = entry.habits ? Object.values(entry.habits) : [];
    if (!habitStates.length) return 0;
    const doneCount = habitStates.filter((state) => !!state.done).length;
    return Math.round((doneCount / habitStates.length) * 100);
  });

  const ctx = chartCanvas.getContext("2d");
  if (habitChart) {
    habitChart.destroy();
  }

  habitChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "学習時間 (分)",
          data: studyMinutes,
          backgroundColor: "rgba(37, 99, 235, 0.6)",
          borderRadius: 6,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "習慣達成率 (%)",
          data: habitCompletionRate,
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.2)",
          tension: 0.3,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "分" },
        },
        y1: {
          beginAtZero: true,
          max: 100,
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: "%" },
        },
      },
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function delayClearStatus(element) {
  setTimeout(() => {
    if (element) element.textContent = "";
  }, 1800);
}

// ===== イベントハンドラ =====
addHabitForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = newHabitInput.value.trim();
  if (!name) {
    habitStatus.textContent = "習慣名を入力してください";
    delayClearStatus(habitStatus);
    return;
  }

  try {
    addHabitForm.querySelector("button").disabled = true;
    habitStatus.textContent = "追加中...";
    await addHabit(name);
    newHabitInput.value = "";
    habitStatus.textContent = "追加しました";
  } catch (error) {
    console.error(error);
    habitStatus.textContent = "追加に失敗しました";
  } finally {
    addHabitForm.querySelector("button").disabled = false;
    delayClearStatus(habitStatus);
  }
});

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  saveStatus.textContent = "保存中...";
  try {
    const data = await saveEntry(currentViewingDate);
    debugOutput.textContent = JSON.stringify(data, null, 2);
    saveStatus.textContent = "保存しました";
    await refreshVisualization();
  } catch (error) {
    console.error(error);
    saveStatus.textContent = "保存に失敗しました";
  } finally {
    saveBtn.disabled = false;
    delayClearStatus(saveStatus);
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

exportBtn.addEventListener("click", async () => {
  exportBtn.disabled = true;
  exportStatus.textContent = "エクスポート中...";
  try {
    const entries = await fetchAllEntries();
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const now = new Date();
    const fileDate = `${now.getFullYear()}${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;
    link.download = `habit-entries-${fileDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    exportStatus.textContent = "ダウンロードしました";
  } catch (error) {
    console.error(error);
    exportStatus.textContent = "エクスポートに失敗しました";
  } finally {
    exportBtn.disabled = false;
    delayClearStatus(exportStatus);
  }
});

// ===== 初期化 =====
async function bootstrap() {
  await loadHabits();
  const entry = await loadEntry(currentViewingDate);
  showEntry(currentViewingDate, entry);
  await refreshVisualization();
}

bootstrap();
