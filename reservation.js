import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2dRglUE8f8slzGrON90JXUv_lJFh2eb8",
  authDomain: "alfies-pizzeria-47711.firebaseapp.com",
  projectId: "alfies-pizzeria-47711",
  storageBucket: "alfies-pizzeria-47711.appspot.com",
  messagingSenderId: "546884170927",
  appId: "1:546884170927:web:0887c8ada543729dfd105a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const themeSwitch = document.getElementById("theme-switch");
const reservationForm = document.getElementById("reservation-form");
const statusMessageEl = document.getElementById("status-message");
const submitButton = document.getElementById("submit-button");

let currentUser = null;

function setDarkMode(isDark) { document.body.classList.toggle('dark', isDark); localStorage.setItem('theme', isDark ? 'dark' : 'light'); }
function showStatusMessage(message, isSuccess) { statusMessageEl.textContent = message; statusMessageEl.className = 'status-message'; statusMessageEl.classList.add(isSuccess ? 'success' : 'error'); statusMessageEl.style.display = 'block'; }
function getTodayDateString() { const today = new Date(); const year = today.getFullYear(); const month = String(today.getMonth() + 1).padStart(2, '0'); const day = String(today.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }

themeSwitch.addEventListener("change", () => setDarkMode(themeSwitch.checked));

reservationForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = 'Booking...';
  statusMessageEl.style.display = 'none';

  const dateInput = document.getElementById("reservation-date").value;
  const timeInput = document.getElementById("reservation-time").value;
  const seatsInput = document.getElementById("reservation-seats").value;

  if (!currentUser) { showStatusMessage("You must be logged in to book.", false); submitButton.disabled = false; submitButton.textContent = 'Book Now'; return; }
  if (!dateInput || !timeInput || !seatsInput) { showStatusMessage("Please fill out all fields.", false); submitButton.disabled = false; submitButton.textContent = 'Book Now'; return; }
  if (dateInput < getTodayDateString()) { showStatusMessage("You cannot book a reservation for a past date.", false); submitButton.disabled = false; submitButton.textContent = 'Book Now'; return; }

  try {
    const reservationsRef = collection(db, "reservations");
    const q = query(reservationsRef, where("date", "==", dateInput), where("time", "==", timeInput));
    const existing = await getDocs(q);
    if (existing.docs.length >= 10) { showStatusMessage("This time slot is fully booked. Please select another.", false); submitButton.disabled = false; submitButton.textContent = 'Book Now'; return; }

    // --- FIXED: The 'status' field is now correctly added ---
    await addDoc(reservationsRef, {
      userId: currentUser.uid,
      date: dateInput,
      time: timeInput,
      seats: Number(seatsInput),
      createdAt: new Date(),
      status: 'active' 
    });
    
    showStatusMessage("Reservation successful! Redirecting...", true);
    setTimeout(() => {
        window.location.href = "reservation-confirmation.html";
    }, 2000);

  } catch (error) {
    console.error("Error making reservation:", error);
    showStatusMessage("Something went wrong. Please try again.", false);
    submitButton.disabled = false;
    submitButton.textContent = 'Book Now';
  }
});

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    document.getElementById("reservation-date").setAttribute('min', getTodayDateString());
  } else {
    if (!window.location.pathname.endsWith('login.html')) { window.location.href = "login.html"; }
  }
});

const savedTheme = localStorage.getItem('theme') === 'dark';
themeSwitch.checked = savedTheme;
setDarkMode(savedTheme);