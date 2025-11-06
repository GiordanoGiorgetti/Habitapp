import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ★ここに Firebase コンソールで表示されていた firebaseConfig を貼る
const firebaseConfig = {
  apiKey: "AIzaSyCMJft6BfWUx8FSEt76O4iaCE13axt0dzY",
  authDomain: "habit-9e26c.firebaseapp.com",
  projectId: "habit-9e26c",
  storageBucket: "habit-9e26c.firebasestorage.app",
  messagingSenderId: "536564377863",
  appId: "1:536564377863:web:c2d91a99d7e0f0369abda2"
};
//   「const firebaseConfig = { ... }」をそのままコピペでOK
const firebaseConfig = {
  // 例:
  // apiKey: "XXX",
  // authDomain: "habit-xxxx.firebaseapp.com",
  // ...
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== DOM 取得 =====
const loginSection = document.getElementById("login-section");
const appSection = document.getElementById("app-section");

const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

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
const logoutBtn = document.getElementById("logout-btn");

// ===== 日付処理 =====
function formatDate(d) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const today = new Date();
let currentViewingDate = formatDate(today);

const entriesCol = collection(db, "entries");

async function loadEntry(userId, dateStr) {
  const q = query(
    entriesCol,
    where("userId", "==", userId),
    where("date", "==", dateStr)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  let data = null;
  snap.forEach((doc) => {
    data = { id: doc.id, ...doc.data() };
  });
  return data;
}

async function saveEntry(userId, dateStr) {
  const data = {
    userId,
    date: dateStr,
    training: { done: trainingDoneInput.checked },
    study: { minutes: Number(studyMinutesInput.value || 0) },
    memo: memoInput.value || "",
    updatedAt: new Date(),
  };

  const docId = `${userId}_${dateStr}`;
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

// ===== 認証状態の監視 =====
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginSection.style.display = "none";
    appSection.style.display = "block";

    const todayStr = formatDate(today);
    todayLabel.textContent = `今日は ${todayStr} です`;

    const entry = await loadEntry(user.uid, todayStr);
    showEntry(todayStr, entry);
  } else {
    loginSection.style.display = "block";
    appSection.style.display = "none";
  }
});

// ===== イベント =====
loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value,
      passInput.value
    );
  } catch (e) {
    loginError.textContent = e.message;
  }
});

saveBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  saveStatus.textContent = "保存中...";
  try {
    const data = await saveEntry(user.uid, currentViewingDate);
    saveStatus.textContent = "保存しました";
    debugOutput.textContent = JSON.stringify(data, null, 2);
    setTimeout(() => (saveStatus.textContent = ""), 1500);
  } catch (e) {
    console.error(e);
    saveStatus.textContent = "保存に失敗しました";
  }
});

prevBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const d = new Date(currentViewingDate);
  d.setDate(d.getDate() - 1);
  const dateStr = formatDate(d);
  const entry = await loadEntry(user.uid, dateStr);
  showEntry(dateStr, entry);
});

todayBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const todayStr = formatDate(today);
  const entry = await loadEntry(user.uid, todayStr);
  showEntry(todayStr, entry);
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});
