import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
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
const memoInput = document.getElementById("memo");
const saveBtn = document.getElementById("save-btn");
const saveStatus = document.getElementById("save-status");
const prevBtn = document.getElementById("prev-btn");
const todayBtn = document.getElementById("today-btn");
const viewingDateLabel = document.getElementById("viewing-date");
const debugOutput = document.getElementById("debug-output");
const historyBtn = document.getElementById("history-btn");
const historyModal = document.getElementById("history-modal");
const historyCloseBtn = document.getElementById("history-close");
const habitSelect = document.getElementById("habit-select");
const historyCalendar = document.getElementById("history-calendar");
const historyChartCanvas = document.getElementById("history-chart");

const habits = [
  {
    id: "training",
    label: "トレーニング完了",
    type: "boolean",
    path: ["training", "done"],
    chartType: "bar",
  },
  {
    id: "study",
    label: "勉強時間（分）",
    type: "number",
    path: ["study", "minutes"],
    chartType: "line",
  },
];

let historyChart = null;

function getValueByPath(data, path) {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), data);
}

function createDateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const range = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    range.push({ date, label: formatDate(date) });
  }
  return range;
}

async function fetchRecentEntries(days = 30) {
  const range = createDateRange(days);
  const startLabel = range[0]?.label;
  if (!startLabel) {
    return { range: [], map: new Map() };
  }

  const entriesQuery = query(
    collection(db, "entries"),
    orderBy("date"),
    where("date", ">=", startLabel),
    limit(days * 2)
  );
  const snapshot = await getDocs(entriesQuery);
  const map = new Map();
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data?.date) {
      map.set(data.date, data);
    }
  });
  return { range, map };
}

function formatDayDisplay(date) {
  return date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function ensureChart(habit, labels, datasetValues) {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js が読み込まれていません");
    return;
  }
  const ctx = historyChartCanvas.getContext("2d");
  const chartType = habit.chartType;
  const colors = {
    border: "rgba(54, 162, 235, 1)",
    background: habit.type === "boolean" ? "rgba(75, 192, 192, 0.7)" : "rgba(54, 162, 235, 0.4)",
  };

  if (historyChart) {
    historyChart.destroy();
  }

  historyChart = new Chart(ctx, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: habit.label,
          data: datasetValues,
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 2,
          tension: 0.3,
          fill: habit.type === "number",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y:
          habit.type === "boolean"
            ? {
                suggestedMin: 0,
                suggestedMax: 1,
                ticks: {
                  stepSize: 1,
                },
              }
            : {
                beginAtZero: true,
              },
      },
    },
  });
}

function renderCalendar(habit, range, values) {
  historyCalendar.innerHTML = "";
  if (!range.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "データがありません";
    emptyMessage.style.gridColumn = "span 7";
    historyCalendar.appendChild(emptyMessage);
    return;
  }
  const maxValue = habit.type === "number" ? Math.max(...values.filter((v) => typeof v === "number"), 0) : 0;

  range.forEach((item, index) => {
    const cell = document.createElement("div");
    cell.classList.add("calendar-cell");
    const dateLabel = document.createElement("div");
    dateLabel.className = "date-label";
    dateLabel.textContent = formatDayDisplay(item.date);

    const valueLabel = document.createElement("div");
    valueLabel.className = "value-label";
    const value = values[index];

    if (habit.type === "boolean") {
      if (value === 1) {
        valueLabel.textContent = "✓";
        cell.classList.add("boolean-true");
      } else if (value === 0) {
        valueLabel.textContent = "×";
        cell.classList.add("boolean-false");
      } else {
        valueLabel.textContent = "–";
      }
    } else if (typeof value === "number") {
      valueLabel.textContent = value;
      const intensity = maxValue > 0 ? value / maxValue : 0;
      const alpha = 0.15 + intensity * 0.65;
      cell.style.backgroundColor = `rgba(54, 162, 235, ${alpha.toFixed(2)})`;
      cell.style.color = intensity > 0.5 ? "#fff" : "#123";
    } else {
      valueLabel.textContent = "–";
    }

    cell.appendChild(dateLabel);
    cell.appendChild(valueLabel);
    historyCalendar.appendChild(cell);
  });
}

async function updateHistoryView() {
  const selectedId = habitSelect.value;
  const habit = habits.find((h) => h.id === selectedId);
  if (!habit) return;

  const { range, map } = await fetchRecentEntries(30);
  const labels = range.map((item) => formatDayDisplay(item.date));
  const datasetValues = range.map((item) => {
    const entry = map.get(item.label);
    const rawValue = entry ? getValueByPath(entry, habit.path) : undefined;
    if (habit.type === "boolean") {
      if (rawValue === undefined || rawValue === null) {
        return null;
      }
      return rawValue ? 1 : 0;
    }
    if (typeof rawValue === "number") {
      return rawValue;
    }
    return null;
  });

  ensureChart(habit, labels, datasetValues);
  renderCalendar(habit, range, datasetValues);
}

function openHistoryModal() {
  historyModal.classList.add("active");
  updateHistoryView();
}

function closeHistoryModal() {
  historyModal.classList.remove("active");
}

function populateHabitSelect() {
  habitSelect.innerHTML = "";
  habits.forEach((habit) => {
    const option = document.createElement("option");
    option.value = habit.id;
    option.textContent = habit.label;
    habitSelect.appendChild(option);
  });
  if (habits.length > 0) {
    habitSelect.value = habits[0].id;
  }
}

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

historyBtn.addEventListener("click", () => {
  openHistoryModal();
});

historyCloseBtn.addEventListener("click", () => {
  closeHistoryModal();
});

historyModal.addEventListener("click", (event) => {
  if (event.target === historyModal) {
    closeHistoryModal();
  }
});

habitSelect.addEventListener("change", () => {
  updateHistoryView();
});

populateHabitSelect();

// 起動時に今日のデータを読み込む
loadEntry(currentViewingDate).then((entry) => showEntry(currentViewingDate, entry));
