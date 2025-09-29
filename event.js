import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyA2dRglUE8f8slzGrON90JXUv_lJFh2eb8", authDomain: "alfies-pizzeria-47711.firebaseapp.com", projectId: "alfies-pizzeria-47711", storageBucket: "alfies-pizzeria-47711.appspot.com", messagingSenderId: "546884170927", appId: "1:546884170927:web:0887c8ada543729dfd105a" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const themeSwitch = document.getElementById("theme-switch");
const eventForm = document.getElementById("event-form");
const statusMessageEl = document.getElementById("status-message");
const submitButton = document.getElementById("submit-button");
let currentUser = null;

function setDarkMode(isDark) { document.body.classList.toggle('dark', isDark); localStorage.setItem('theme', isDark ? 'dark' : 'light'); }
function showStatusMessage(message, isSuccess) { statusMessageEl.textContent = message; statusMessageEl.className = 'status-message'; statusMessageEl.classList.add(isSuccess ? 'success' : 'error'); statusMessageEl.style.display = 'block'; }
function getTodayDateString() { const today = new Date(); const year = today.getFullYear(); const month = String(today.getMonth() + 1).padStart(2, '0'); const day = String(today.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }

themeSwitch.addEventListener("change", () => { setDarkMode(themeSwitch.checked); });

eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting Request...';
  statusMessageEl.style.display = 'none';
  const date = document.getElementById("event-date").value;
  const guests = document.getElementById("event-guests").value;
  const time = document.getElementById("event-time").value;

  if (!currentUser) { showStatusMessage("You must be logged in to book an event.", false); submitButton.disabled = false; submitButton.textContent = 'Request Booking'; return; }
  if (!date || !guests || !time) { showStatusMessage("Please fill out all fields to request an event.", false); submitButton.disabled = false; submitButton.textContent = 'Request Booking'; return; }
  if (date < getTodayDateString()) { showStatusMessage("You cannot book an event for a past date.", false); submitButton.disabled = false; submitButton.textContent = 'Request Booking'; return; }
  if (parseInt(guests, 10) < 10) { showStatusMessage("Events require a minimum of 10 guests.", false); submitButton.disabled = false; submitButton.textContent = 'Request Booking'; return; }

  try {
    await addDoc(collection(db, "eventBookings"), { userId: currentUser.uid, date: date, time: time, guests: Number(guests), status: 'pending', requestedAt: new Date() });
    showStatusMessage("Your event request has been submitted! A staff member will contact you within 24 hours to confirm the details.", true);
    eventForm.reset();
    setTimeout(() => { window.location.href = "user-dashboard.html"; }, 4000);
  } catch (error) {
    console.error("Error submitting event request:", error);
    showStatusMessage("Something went wrong. Please try again.", false);
    submitButton.disabled = false;
    submitButton.textContent = 'Request Booking';
  }
});

onAuthStateChanged(auth, user => {
  if (user) { currentUser = user; document.getElementById("event-date").setAttribute('min', getTodayDateString()); }
  else { if (!window.location.pathname.endsWith('login.html')) { window.location.href = "login.html"; } }
});

const savedTheme = localStorage.getItem('theme') === 'dark';
themeSwitch.checked = savedTheme;
setDarkMode(savedTheme);