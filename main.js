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
  updateDoc,
  serverTimestamp,
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
const habitList = document.getElementById("habit-list");
const openHabitModalBtn = document.getElementById("open-habit-modal");
const habitModal = document.getElementById("habit-modal");
const habitTableBody = document.getElementById("habit-table-body");
const addHabitBtn = document.getElementById("add-habit-btn");
const newHabitName = document.getElementById("new-habit-name");
const newHabitType = document.getElementById("new-habit-type");
const newHabitUnit = document.getElementById("new-habit-unit");
const newHabitActive = document.getElementById("new-habit-active");
const habitModalClose = document.getElementById("habit-modal-close");

todayLabel.textContent = `今日は ${currentViewingDate} です`;

let cachedHabits = [];
let cachedAllHabits = [];

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

openHabitModalBtn?.addEventListener("click", async () => {
  await refreshHabitTable();
  habitModal?.showModal();
});

habitModalClose?.addEventListener("click", () => {
  habitModal?.close();
});

addHabitBtn?.addEventListener("click", async () => {
  const name = newHabitName.value.trim();
  const type = newHabitType.value.trim();
  const unit = newHabitUnit.value.trim();
  const active = newHabitActive.checked;
  if (!name || !type || !unit) {
    return;
  }

  const habits = await fetchAllHabits();
  const maxOrder = habits.reduce((max, h) => Math.max(max, h.order ?? 0), 0);
  const nextOrder = maxOrder + 1;
  await addDoc(collection(db, "habits"), {
    name,
    type,
    unit,
    active,
    order: nextOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  newHabitName.value = "";
  newHabitType.value = "";
  newHabitUnit.value = "";
  newHabitActive.checked = true;

  await reloadHabits();
  await refreshHabitTable();
  renderHabitList();
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

async function reloadHabits() {
  const q = query(
    collection(db, "habits"),
    where("active", "==", true),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  cachedHabits = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderHabitList();
}

function renderHabitList() {
  if (!habitList) return;
  habitList.innerHTML = "";
  cachedHabits.forEach((habit) => {
    const li = document.createElement("li");
    li.textContent = habit.name;
    habitList.appendChild(li);
  });
}

async function fetchAllHabits() {
  const q = query(collection(db, "habits"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  cachedAllHabits = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  return cachedAllHabits;
}

async function refreshHabitTable() {
  if (!habitTableBody) return;
  const habits = await fetchAllHabits();
  habitTableBody.innerHTML = "";
  habits.forEach((habit) => {
    const tr = document.createElement("tr");

    const nameCell = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = habit.name ?? "";
    nameCell.appendChild(nameInput);

    const typeCell = document.createElement("td");
    const typeInput = document.createElement("input");
    typeInput.type = "text";
    typeInput.value = habit.type ?? "";
    typeCell.appendChild(typeInput);

    const unitCell = document.createElement("td");
    const unitInput = document.createElement("input");
    unitInput.type = "text";
    unitInput.value = habit.unit ?? "";
    unitCell.appendChild(unitInput);

    const activeCell = document.createElement("td");
    const activeInput = document.createElement("input");
    activeInput.type = "checkbox";
    activeInput.checked = habit.active ?? false;
    activeCell.appendChild(activeInput);

    const actionCell = document.createElement("td");
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "保存";
    saveButton.addEventListener("click", async () => {
      await updateDoc(doc(db, "habits", habit.id), {
        name: nameInput.value.trim(),
        type: typeInput.value.trim(),
        unit: unitInput.value.trim(),
        active: activeInput.checked,
        updatedAt: serverTimestamp(),
      });
      await reloadHabits();
      await refreshHabitTable();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", async () => {
      await updateDoc(doc(db, "habits", habit.id), {
        active: false,
        updatedAt: serverTimestamp(),
      });
      await reloadHabits();
      await refreshHabitTable();
    });

    actionCell.appendChild(saveButton);
    actionCell.appendChild(deleteButton);

    if (!habit.active) {
      tr.style.opacity = "0.5";
    }

    tr.appendChild(nameCell);
    tr.appendChild(typeCell);
    tr.appendChild(unitCell);
    tr.appendChild(activeCell);
    tr.appendChild(actionCell);

    habitTableBody.appendChild(tr);
  });
}

reloadHabits().catch((err) => console.error(err));
