import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, getCountFromServer, orderBy } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-functions.js";

const firebaseConfig = { apiKey: "AIzaSyA2dRglUE8f8slzGrON90JXUv_lJFh2eb8", authDomain: "alfies-pizzeria-47711.firebaseapp.com", projectId: "alfies-pizzeria-47711", storageBucket: "alfies-pizzeria-47711.appspot.com", messagingSenderId: "546884170927", appId: "1:546884170927:web:0887c8ada543729dfd105a" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');

// --- DOM ELEMENTS ---
const mainDashboard = document.querySelector('.dashboard-main');
const logoutBtn = document.getElementById('logout-btn');
const themeSwitch = document.getElementById('theme-switch');
const createStaffForm = document.getElementById('create-staff-form');
const staffList = document.getElementById('staff-list');
const createStatusMessageEl = document.getElementById('create-status-message');
const togglePasswordBtn = document.getElementById('toggle-password');
const loadingModal = document.getElementById('loading-modal');
const totalCustomersEl = document.getElementById('total-customers');
const totalReservationsEl = document.getElementById('total-reservations');
const totalEventsEl = document.getElementById('total-events');
const generateReportBtn = document.getElementById('generate-report-btn');
const reportResultsContainer = document.getElementById('report-results-container');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const topCustomersCountInput = document.getElementById('top-customers-count');
const generateTopCustomersBtn = document.getElementById('generate-top-customers-btn');
const topCustomersResultsContainer = document.getElementById('top-customers-results');
const generateExperienceReportBtn = document.getElementById('generate-experience-report-btn');
const experienceReportResultsContainer = document.getElementById('experience-report-results');

// --- GLOBAL STATE ---
let bookingChart = null;

// --- HELPER FUNCTIONS ---
function setDarkMode(enabled) { document.body.classList.toggle('dark', enabled); localStorage.setItem('theme', enabled ? 'true' : 'false'); }
function showCreateStatusMessage(message, isSuccess) { createStatusMessageEl.textContent = message; createStatusMessageEl.className = 'status-message'; createStatusMessageEl.classList.add(isSuccess ? 'success' : 'error'); createStatusMessageEl.style.display = 'block'; }
function showLoading() { if (loadingModal) loadingModal.style.display = 'flex'; }
function hideLoading() { if (loadingModal) loadingModal.style.display = 'none'; }

// --- DATA FETCHING & RENDERING (Existing) ---
async function loadStaffAccounts() {
    staffList.innerHTML = '<li>Loading...</li>';
    const staffQuery = query(collection(db, 'users'), where('role', '==', 'staff'));
    try {
        const querySnapshot = await getDocs(staffQuery);
        staffList.innerHTML = '';
        if (querySnapshot.empty) { staffList.innerHTML = '<li>No staff accounts found.</li>'; return; }
        querySnapshot.forEach(doc => {
            const staff = doc.data();
            const li = document.createElement('li');
            li.className = 'report-item';
            li.innerHTML = `<span class="report-label">${staff.name} (${staff.email})</span><div class="reservation-actions"><button class="action-btn delete-btn delete-staff-btn" data-uid="${doc.id}" data-name="${staff.name}">🗑 Delete</button></div>`;
            staffList.appendChild(li);
        });
    } catch (error) { console.error("Error loading staff:", error); staffList.innerHTML = '<li>Error loading data.</li>'; }
}

async function generateReports() {
    try {
        const customerQuery = query(collection(db, 'users'), where('role', '==', 'customer'));
        const reservationQuery = query(collection(db, 'reservations'), where('status', '==', 'active'));
        const eventQuery = query(collection(db, 'eventBookings'), where('status', '==', 'pending'));
        const [customerSnap, reservationSnap, eventSnap] = await Promise.all([getCountFromServer(customerQuery), getCountFromServer(reservationQuery), getCountFromServer(eventQuery)]);
        totalCustomersEl.textContent = customerSnap.data().count;
        totalReservationsEl.textContent = reservationSnap.data().count;
        totalEventsEl.textContent = eventSnap.data().count;
    } catch (error) { console.error("Error generating reports:", error); }
}

// --- TOP CUSTOMERS REPORT FUNCTIONS ---
async function generateTopCustomersReport() {
    const limit = parseInt(topCustomersCountInput.value, 10);
    if (!limit || limit <= 0) { alert("Please enter a valid number of customers to show."); return; }
    showLoading();
    topCustomersResultsContainer.innerHTML = '';
    try {
        const reservationsQuery = query(collection(db, 'reservations'), where('status', '==', 'active'));
        const reservationSnapshot = await getDocs(reservationsQuery);
        if (reservationSnapshot.empty) { topCustomersResultsContainer.innerHTML = '<p style="text-align: center;">No booking data found.</p>'; return; }
        const bookingCounts = {};
        reservationSnapshot.forEach(doc => { const userId = doc.data().userId; if (userId) { bookingCounts[userId] = (bookingCounts[userId] || 0) + 1; } });
        const sortedCustomers = Object.entries(bookingCounts).sort(([, countA], [, countB]) => countB - countA).slice(0, limit);
        const customerPromises = sortedCustomers.map(([userId]) => getDoc(doc(db, 'users', userId)));
        const customerDocs = await Promise.all(customerPromises);
        const customerDataMap = {};
        customerDocs.forEach(doc => { if (doc.exists()) { customerDataMap[doc.id] = doc.data(); } });
        const finalReportData = sortedCustomers.map(([userId, count]) => ({ userId, count, name: customerDataMap[userId]?.name || 'Unknown User', email: customerDataMap[userId]?.email || 'N/A' }));
        renderTopCustomersList(finalReportData);
    } catch (error) { console.error("Error generating top customers report:", error); topCustomersResultsContainer.innerHTML = '<p class="status-message error">An error occurred while generating the report.</p>'; } finally { hideLoading(); }
}

function renderTopCustomersList(reportData) {
    if (reportData.length === 0) {
        topCustomersResultsContainer.innerHTML = '<p style="text-align: center;">No customer data to display.</p>';
        return;
    }
    const listItems = reportData.map((customer, index) => `
        <li>
            <span class="rank">#${index + 1}</span>
            <div class="customer-info">
                <div class="name">${customer.name}</div>
                <div class="email">${customer.email}</div>
            </div>
            <div class="booking-count">${customer.count} Bookings</div>
        </li>
    `).join('');
    topCustomersResultsContainer.innerHTML = `
        <button class="close-report-btn" aria-label="Close Report">&times;</button>
        <ol class="customer-list">${listItems}</ol>
    `;
}

// --- CHART.JS REPORTING FUNCTIONS ---
function createOrUpdateChart(timeCounts) {
    if (bookingChart) { bookingChart.destroy(); }
    const ctx = document.getElementById('bookingChartCanvas').getContext('2d');
    const labels = Object.keys(timeCounts).sort();
    const data = labels.map(label => timeCounts[label]);
    bookingChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Number of Bookings', data: data, backgroundColor: 'rgba(0, 123, 255, 0.6)', borderColor: 'rgba(0, 123, 255, 1)', borderWidth: 1 }] }, options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (context) { return `${context.dataset.label || ''}: ${context.parsed.y}`; } } } } } });
}

async function generateBookingReport() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    if (!startDate || !endDate) { alert('Please select both a start and end date.'); return; }
    showLoading();
    reportResultsContainer.innerHTML = '';
    try {
        const reservationsRef = collection(db, 'reservations');
        const q = query(reservationsRef, where('date', '>=', startDate), where('date', '<=', endDate), where('status', '==', 'active'));
        const snapshot = await getDocs(q);
        const bookings = snapshot.docs.map(doc => doc.data());
        if (bookings.length === 0) {
            reportResultsContainer.innerHTML = '<p style="text-align: center;">No bookings found for the selected date range.</p>';
            return;
        }
        const totalBookings = bookings.length;
        const totalGuests = bookings.reduce((sum, booking) => sum + booking.seats, 0);
        const averagePartySize = totalGuests / totalBookings;
        const dayCounts = {};
        const timeCounts = {};
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        bookings.forEach(booking => { const date = new Date(booking.date + 'T00:00:00'); const dayName = daysOfWeek[date.getDay()]; dayCounts[dayName] = (dayCounts[dayName] || 0) + 1; timeCounts[booking.time] = (timeCounts[booking.time] || 0) + 1; });
        const busiestDay = Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b, 'N/A');
        const busiestTimeSlot = Object.keys(timeCounts).reduce((a, b) => timeCounts[a] > timeCounts[b] ? a : b, 'N/A');
        const stats = { totalBookings, averagePartySize, busiestDay, busiestTimeSlot };
        reportResultsContainer.innerHTML = `
            <button class="close-report-btn" aria-label="Close Report">&times;</button>
            <div class="report-summary"><div class="summary-item"><div class="label">Total Bookings</div><div class="value">${stats.totalBookings}</div></div><div class="summary-item"><div class="label">Avg. Party Size</div><div class="value">${stats.averagePartySize.toFixed(1)}</div></div><div class="summary-item"><div class="label">Busiest Day</div><div class="value">${stats.busiestDay}</div></div><div class="summary-item"><div class="label">Busiest Time</div><div class="value">${stats.busiestTimeSlot}</div></div></div>
            <div class="chart-container"><h3 class="chart-title">Bookings by Time Slot</h3><canvas id="bookingChartCanvas"></canvas></div>
        `;
        createOrUpdateChart(timeCounts);
    } catch (error) { console.error("Error generating report:", error); reportResultsContainer.innerHTML = '<p class="status-message error">An error occurred while generating the report.</p>'; } finally { hideLoading(); }
}

// --- CUSTOMER EXPERIENCE REPORT FUNCTIONS ---
async function generateExperienceReport() {
    showLoading();
    experienceReportResultsContainer.innerHTML = '';
    try {
        const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
        const reviewSnapshot = await getDocs(reviewsQuery);
        if (reviewSnapshot.empty) { experienceReportResultsContainer.innerHTML = '<p style="text-align: center;">No customer reviews have been submitted yet.</p>'; return; }
        const reviews = reviewSnapshot.docs.map(doc => doc.data());
        const totalReviews = reviews.length;
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / totalReviews;
        const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(review => { ratingCounts[review.rating] = (ratingCounts[review.rating] || 0) + 1; });
        const latestReviews = reviews.slice(0, 5);
        const summaryHTML = renderExperienceSummary({ totalReviews, averageRating }, ratingCounts);
        const latestReviewsHTML = renderLatestReviews(latestReviews);
        experienceReportResultsContainer.innerHTML = `
            <button class="close-report-btn" aria-label="Close Report">&times;</button>
            ${summaryHTML}
            ${latestReviewsHTML}
        `;
    } catch (error) { console.error("Error generating experience report:", error); experienceReportResultsContainer.innerHTML = '<p class="status-message error">An error occurred while generating the report.</p>'; } finally { hideLoading(); }
}

function renderExperienceSummary(stats, ratingCounts) {
    return `<div class="report-summary"><div class="summary-item"><div class="label">Total Reviews</div><div class="value">${stats.totalReviews}</div></div><div class="summary-item"><div class="label">Average Rating</div><div class="value">${stats.averageRating.toFixed(2)} ★</div></div></div><div class="rating-distribution"><div class="summary-item"><div class="label">5 ★</div><div class="value">${ratingCounts[5]}</div></div><div class="summary-item"><div class="label">4 ★</div><div class="value">${ratingCounts[4]}</div></div><div class="summary-item"><div class="label">3 ★</div><div class="value">${ratingCounts[3]}</div></div><div class="summary-item"><div class="label">2 ★</div><div class="value">${ratingCounts[2]}</div></div><div class="summary-item"><div class="label">1 ★</div><div class="value">${ratingCounts[1]}</div></div></div>`;
}

function renderLatestReviews(latestReviews) {
    if (latestReviews.length === 0) { return ''; }
    const listItems = latestReviews.map(review => { const reviewDate = review.createdAt.toDate().toLocaleDateString(); const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating); const reviewText = review.text ? `"${review.text}"` : "No comment left."; return `<li class="review-item"><div class="review-rating">${stars}</div><p class="review-text">${reviewText}</p><div class="review-meta">By: ${review.userName || 'Anonymous'} on ${reviewDate}</div></li>`; }).join('');
    return `<h3 class="chart-title" style="margin-top: 2rem;">Recent Reviews</h3><ul class="review-list">${listItems}</ul>`;
}

// --- ACTION HANDLERS (Existing) ---
async function handleCreateStaff(e) { e.preventDefault(); showCreateStatusMessage('', true); const name = document.getElementById('staff-name').value; const email = document.getElementById('staff-email').value; const password = document.getElementById('staff-password').value; try { if (!name || !email || !password) { throw new Error('Please fill out all fields.'); } showLoading(); const createStaffUser = httpsCallable(functions, 'createStaffUser'); await createStaffUser({ name, email, password }); showCreateStatusMessage(`Staff account for ${name} created successfully!`, true); createStaffForm.reset(); await loadStaffAccounts(); } catch (error) { const errorMessage = error?.details?.message || error.message; showCreateStatusMessage(errorMessage, false); console.error("Error creating staff:", error); } finally { hideLoading(); } }
async function handleDeleteStaff(staffUid, staffName) { if (!confirm(`Are you sure you want to permanently delete the staff account for ${staffName}?`)) return; try { showLoading(); const deleteStaffUser = httpsCallable(functions, 'deleteStaffUser'); await deleteStaffUser({ uid: staffUid }); showCreateStatusMessage(`Successfully deleted ${staffName}.`, true); await loadStaffAccounts(); } catch (error) { const errorMessage = error?.details?.message || error.message; showCreateStatusMessage(errorMessage, false); console.error("Error deleting staff:", error); } finally { hideLoading(); } }

// --- EVENT LISTENERS ---
logoutBtn.addEventListener('click', e => { e.preventDefault(); signOut(auth); });
themeSwitch.addEventListener('change', () => setDarkMode(themeSwitch.checked));
createStaffForm.addEventListener('submit', handleCreateStaff);
staffList.addEventListener('click', (e) => { const button = e.target.closest('.delete-staff-btn'); if (button) { handleDeleteStaff(button.dataset.uid, button.dataset.name); } });
generateReportBtn.addEventListener('click', generateBookingReport);
generateTopCustomersBtn.addEventListener('click', generateTopCustomersReport);
generateExperienceReportBtn.addEventListener('click', generateExperienceReport);

// Event listener for all 'close report' buttons
mainDashboard.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-report-btn')) {
        const resultsContainer = e.target.parentElement;
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
    }
});

const passwordInput = document.getElementById('staff-password');
const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" x2="22" y1="2" y2="22"></line></svg>`;
if (togglePasswordBtn) { togglePasswordBtn.innerHTML = eyeIcon; togglePasswordBtn.addEventListener('click', () => { const isPassword = passwordInput.type === 'password'; passwordInput.type = isPassword ? 'text' : 'password'; togglePasswordBtn.innerHTML = isPassword ? eyeOffIcon : eyeIcon; }); }

// --- INITIALIZATION ---
onAuthStateChanged(auth, async (user) => { if (user) { const userDocRef = doc(db, 'users', user.uid); const userDocSnap = await getDoc(userDocRef); if (!userDocSnap.exists() || userDocSnap.data().role !== 'admin') { alert('Access denied.'); signOut(auth); window.location.href = 'login.html'; return; } await loadStaffAccounts(); await generateReports(); } else { window.location.href = 'login.html'; } });
const savedTheme = localStorage.getItem('theme') === 'true';
themeSwitch.checked = savedTheme;
setDarkMode(savedTheme);