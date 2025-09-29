import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, collection, query, where, getDocs, updateDoc, getDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyA2dRglUE8f8slzGrON90JXUv_lJFh2eb8", authDomain: "alfies-pizzeria-47711.firebaseapp.com", projectId: "alfies-pizzeria-47711", storageBucket: "alfies-pizzeria-47711.appspot.com", messagingSenderId: "546884170927", appId: "1:546884170927:web:0887c8ada543729dfd105a" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
const logoutBtn = document.getElementById('logout-btn');
const themeSwitch = document.getElementById('theme-switch');
const todayList = document.getElementById('today-reservations-list');
const tomorrowList = document.getElementById('tomorrow-reservations-list');
const eventList = document.getElementById('event-requests-list');
const confirmedEventList = document.getElementById('confirmed-events-list');
const mainContent = document.querySelector('.dashboard-main');
const customerModal = document.getElementById('customer-details-modal');
const customerModalContent = document.getElementById('customer-details-content');
const closeCustomerModalBtn = document.getElementById('close-customer-modal-btn');
const createReservationForm = document.getElementById('create-reservation-form');
const customerSelect = document.getElementById('customer-select');
const createStatusMessageEl = document.getElementById('create-status-message');
const cancellationModal = document.getElementById('cancellation-modal');
const closeCancelModalBtn = document.getElementById('close-cancel-modal-btn');
const cancellationForm = document.getElementById('cancellation-form');

// --- GLOBAL STATE ---
let currentEditingReservationId = null;
let currentReservationIdToCancel = null;
const availableTimes = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

// --- HELPER FUNCTIONS ---
function setDarkMode(enabled) { document.body.classList.toggle('dark', enabled); localStorage.setItem('theme', enabled ? 'true' : 'false'); }
function getDateStrings() { const today = new Date(); const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1); const toYYYYMMDD = (date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }; return { todayString: toYYYYMMDD(today), tomorrowString: toYYYYMMDD(tomorrow) }; }
function showCreateStatusMessage(message, isSuccess) { createStatusMessageEl.textContent = message; createStatusMessageEl.className = 'status-message'; createStatusMessageEl.classList.add(isSuccess ? 'success' : 'error'); createStatusMessageEl.style.display = 'block'; }

// --- DATA FETCHING & RENDERING ---
async function populateCustomerDropdown() {
    const usersQuery = query(collection(db, 'users'), where('role', '==', 'customer'));
    try {
        const querySnapshot = await getDocs(usersQuery);
        customerSelect.innerHTML = '<option value="" disabled selected>Select a customer</option>';
        querySnapshot.forEach(doc => {
            const user = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${user.name} (${user.email})`;
            customerSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating customers:", error);
        customerSelect.innerHTML = '<option value="" disabled>Could not load customers</option>';
    }
}

async function loadReservations() {
    const { todayString, tomorrowString } = getDateStrings();
    const todayQuery = query(collection(db, 'reservations'), where('date', '==', todayString), where('status', '==', 'active'));
    const tomorrowQuery = query(collection(db, 'reservations'), where('date', '==', tomorrowString), where('status', '==', 'active'));
    try {
        const [todaySnapshot, tomorrowSnapshot] = await Promise.all([getDocs(todayQuery), getDocs(tomorrowQuery)]);
        renderReservationList(todaySnapshot, todayList, "today");
        renderReservationList(tomorrowSnapshot, tomorrowList, "tomorrow");
    } catch (error) { console.error("Error loading reservations:", error); }
}

async function renderReservationList(snapshot, container, day) {
    container.innerHTML = '';
    if (snapshot.empty) { container.innerHTML = `<li>No reservations for ${day}.</li>`; return; }
    for (const docSnap of snapshot.docs) {
        const res = docSnap.data();
        const userSnap = await getDoc(doc(db, 'users', res.userId));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const userName = userData.name || 'Unknown User';
        const userTravel = userData.travelDistance || 'N/A';
        const userAllergies = userData.allergies && userData.allergies.length > 0 ? userData.allergies.join(', ') : 'None';
        const li = document.createElement('li');
        li.setAttribute('data-reservation-id', docSnap.id);
        li.innerHTML = `
            <div class="reservation-details">
                <strong>Time:</strong> <span class="res-time">${res.time}</span> | <strong>Guests:</strong> <span class="res-seats">${res.seats}</span><br/>
                <strong>Booked by:</strong> <a href="#" class="customer-link" data-userid="${res.userId}">${userName}</a><br/>
                <strong>Travels:</strong> ${userTravel} | <strong>Allergies:</strong> <span style="font-weight: bold; color: var(--error-color);">${userAllergies}</span>
                <span class="res-date" style="display:none;">${res.date}</span>
            </div>
            <div class="reservation-actions">
                <button class="action-btn edit-res-btn" data-id="${docSnap.id}">✏️ Edit</button>
                <button class="action-btn delete-btn cancel-res-btn" data-id="${docSnap.id}">🗑 Cancel</button>
            </div>
            <div class="edit-reservation-form" style="display:none;"></div>`;
        container.appendChild(li);
    }
}

async function loadEventRequests() {
    const { todayString } = getDateStrings();
    const pendingQuery = query(collection(db, 'eventBookings'), where('status', '==', 'pending'));
    const confirmedQuery = query(collection(db, 'eventBookings'), where('status', '==', 'confirmed'), where('date', '>=', todayString));
    try {
        const [pendingSnapshot, confirmedSnapshot] = await Promise.all([getDocs(pendingQuery), getDocs(confirmedQuery)]);
        renderEventList(pendingSnapshot, eventList, true);
        renderEventList(confirmedSnapshot, confirmedEventList, false);
    } catch (error) { console.error("Error loading events:", error); }
}

async function renderEventList(snapshot, container, isPendingList) {
    container.innerHTML = '';
    if (snapshot.empty) { container.innerHTML = `<li>No ${isPendingList ? 'pending requests' : 'confirmed events'} found.</li>`; return; }
    for (const eventDoc of snapshot.docs) {
        const event = eventDoc.data();
        const userSnap = await getDoc(doc(db, 'users', event.userId));
        const userName = userSnap.exists() ? userSnap.data().name : 'Unknown User';
        const li = document.createElement('li');
        let actionButtons = '';
        if (isPendingList) { actionButtons = `<button class="action-btn confirm-event-btn" data-id="${eventDoc.id}">✔ Confirm</button><button class="action-btn deny-event-btn" data-id="${eventDoc.id}">✖ Deny</button>`; }
        li.innerHTML = `<div class="reservation-details"><strong>Date:</strong> ${event.date} | <strong>Time:</strong> ${event.time} | <strong>Guests:</strong> ${event.guests}<br/><strong>Requested by:</strong> <a href="#" class="customer-link" data-userid="${event.userId}">${userName}</a></div><div class="reservation-actions">${actionButtons}</div>`;
        container.appendChild(li);
    }
}

// --- ACTION HANDLERS ---
async function handleCreateReservation(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('create-reservation-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
    createStatusMessageEl.style.display = 'none';
    const userId = document.getElementById('customer-select').value;
    const date = document.getElementById('new-reservation-date').value;
    const seats = document.getElementById('new-reservation-seats').value;
    const time = document.getElementById('new-reservation-time').value;
    if (!userId || !date || !seats || !time) { showCreateStatusMessage('Please fill out all fields.', false); submitBtn.disabled = false; submitBtn.textContent = 'Create Reservation'; return; }
    try {
        await addDoc(collection(db, 'reservations'), { userId, date, seats: Number(seats), time, createdAt: new Date(), status: 'active' });
        createReservationForm.reset();
        const { todayString, tomorrowString } = getDateStrings();
        if (date === todayString || date === tomorrowString) { showCreateStatusMessage('Reservation created successfully!', true); await loadReservations(); }
        else { showCreateStatusMessage(`Reservation for ${date} created successfully.`, true); }
        setTimeout(() => { createStatusMessageEl.style.display = 'none'; }, 4000);
    } catch (error) {
        console.error("Error creating reservation:", error);
        showCreateStatusMessage('Failed to create reservation.', false);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Reservation';
    }
}

async function handleUpdateEventStatus(bookingId, newStatus) {
    const confirmationText = newStatus === 'confirmed' ? 'Are you sure you want to confirm this event?' : 'Are you sure you want to deny this event request?';
    if (!confirm(confirmationText)) return;
    try {
        await updateDoc(doc(db, 'eventBookings', bookingId), { status: newStatus });
        alert(`Event ${newStatus}!`);
        await loadEventRequests();
    } catch (error) { console.error(`Error updating event:`, error); alert('Failed to update event status.'); }
}

async function openCustomerDetailsModal(userId) {
    customerModalContent.innerHTML = '<p>Loading details...</p>';
    customerModal.style.display = 'flex';
    try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
            const data = userSnap.data();
            const allergies = data.allergies && data.allergies.length > 0 ? data.allergies.join(', ') : 'None listed';
            const favorites = data.favouriteDishes && data.favouriteDishes.length > 0 ? data.favouriteDishes.join(', ') : 'None listed';
            customerModalContent.innerHTML = `<p><strong>Name:</strong> ${data.name || 'N/A'}</p><p><strong>Email:</strong> ${data.email || 'N/A'}</p><p><strong>Travel Distance:</strong> ${data.travelDistance || 'N/A'}</p><p><strong>Allergies:</strong> ${allergies}</p><p><strong>Favorite Dishes:</strong> ${favorites}</p>`;
        } else { customerModalContent.innerHTML = '<p>Could not find customer details.</p>'; }
    } catch (error) { console.error("Error fetching customer details:", error); customerModalContent.innerHTML = '<p>Error loading details.</p>'; }
}

function closeCustomerModal() { customerModal.style.display = 'none'; }

function toggleEditForm(listItem, reservationId) {
    const editFormContainer = listItem.querySelector('.edit-reservation-form');
    const detailsContainer = listItem.querySelector('.reservation-details');
    const editButton = listItem.querySelector('.edit-res-btn');
    const isEditingThis = currentEditingReservationId === reservationId;
    if (currentEditingReservationId && !isEditingThis) { const otherItem = document.querySelector(`li[data-reservation-id="${currentEditingReservationId}"]`); if (otherItem) { otherItem.querySelector('.edit-reservation-form').style.display = 'none'; otherItem.querySelector('.reservation-details').style.display = 'block'; otherItem.querySelector('.edit-res-btn').textContent = '✏️ Edit'; } }
    if (isEditingThis) {
        editFormContainer.style.display = 'none';
        detailsContainer.style.display = 'block';
        editButton.textContent = '✏️ Edit';
        currentEditingReservationId = null;
    } else {
        const currentTime = detailsContainer.querySelector('.res-time').textContent;
        const currentSeats = detailsContainer.querySelector('.res-seats').textContent;
        const currentDate = detailsContainer.querySelector('.res-date').textContent;
        let seatOptions = '';
        for (let i = 1; i <= 8; i++) { seatOptions += `<option value="${i}" ${i == currentSeats ? 'selected' : ''}>${i} ${i > 1 ? 'People' : 'Person'}</option>`; }
        editFormContainer.innerHTML = `<h4>Edit Reservation</h4><div class="form-group-inline"><label>Date:</label><input type="date" id="edit-date-${reservationId}" value="${currentDate}"></div><div class="form-group-inline"><label>Time:</label><select id="edit-time-${reservationId}">${availableTimes.map(t => `<option value="${t}" ${t === currentTime ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="form-group-inline"><label>Guests:</label><select id="edit-seats-${reservationId}">${seatOptions}</select></div><div class="form-actions"><button class="action-btn save-edit-btn" data-id="${reservationId}">💾 Save</button><button class="action-btn cancel-edit-btn" data-id="${reservationId}">❌ Cancel</button></div><div id="edit-error-${reservationId}" class="error-message" style="margin-top:0.5em;"></div>`;
        editFormContainer.style.display = 'block';
        detailsContainer.style.display = 'none';
        editButton.textContent = '✖️ Cancel Edit';
        currentEditingReservationId = reservationId;
    }
}

async function handleSaveEdit(reservationId) {
    const errorEl = document.getElementById(`edit-error-${reservationId}`);
    errorEl.textContent = '';
    const newDate = document.getElementById(`edit-date-${reservationId}`).value;
    const newTime = document.getElementById(`edit-time-${reservationId}`).value;
    const newSeats = document.getElementById(`edit-seats-${reservationId}`).value;
    if (!newDate || !newTime || !newSeats) { errorEl.textContent = 'Please fill out all fields.'; return; }
    try {
        await updateDoc(doc(db, 'reservations', reservationId), { date: newDate, time: newTime, seats: Number(newSeats) });
        alert('Reservation updated successfully!');
        await loadReservations();
    } catch (error) {
        console.error("Error updating reservation:", error);
        errorEl.textContent = 'Failed to update reservation.';
    }
}

// NEW: Handlers for the staff cancellation modal
function openCancellationModal(reservationId) {
    currentReservationIdToCancel = reservationId;
    cancellationForm.reset();
    cancellationModal.style.display = 'flex';
}

function closeCancellationModal() {
    cancellationModal.style.display = 'none';
    currentReservationIdToCancel = null;
}

// --- EVENT LISTENERS ---
logoutBtn.addEventListener('click', e => { e.preventDefault(); signOut(auth); });
themeSwitch.addEventListener('change', () => setDarkMode(themeSwitch.checked));
closeCustomerModalBtn.addEventListener('click', closeCustomerModal);
customerModal.addEventListener('click', (e) => { if (e.target === customerModal) closeCustomerModal(); });
createReservationForm.addEventListener('submit', handleCreateReservation);
closeCancelModalBtn.addEventListener('click', closeCancellationModal);
cancellationModal.addEventListener('click', (e) => { if (e.target === cancellationModal) closeCancellationModal(); });

// NEW: Listener for the staff cancellation form
cancellationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentReservationIdToCancel) return;
    const reason = cancellationForm.reason.value;
    if (!reason) { alert("Please select a reason."); return; }
    
    try {
        const reservationDocRef = doc(db, 'reservations', currentReservationIdToCancel);
        await updateDoc(reservationDocRef, {
            status: 'cancelled',
            cancellationReason: reason,
            cancelledBy: 'staff',
            cancelledAt: serverTimestamp()
        });
        closeCancellationModal();
        alert("Reservation has been cancelled.");
        await loadReservations();
    } catch (error) {
        console.error("Error cancelling reservation:", error);
        alert("Failed to cancel reservation.");
    }
});

mainContent.addEventListener('click', (e) => {
    const target = e.target.closest('button, a');
    if (!target) return;
    
    if (target.matches('a') || target.matches('button:not([type="submit"])')) {
        e.preventDefault();
    }

    const reservationId = target.dataset.id;
    const listItem = target.closest('li');

    if (target.matches('.confirm-event-btn')) { handleUpdateEventStatus(target.dataset.id, 'confirmed'); }
    if (target.matches('.deny-event-btn')) { handleUpdateEventStatus(target.dataset.id, 'denied'); }
    if (target.matches('.customer-link')) { openCustomerDetailsModal(target.dataset.userid); }
    if (target.matches('.edit-res-btn') || target.matches('.cancel-edit-btn')) {
        toggleEditForm(listItem, reservationId);
    }
    if (target.matches('.save-edit-btn')) {
        handleSaveEdit(reservationId);
    }
    // FIXED: This now opens the modal instead of hard-deleting
    if (target.matches('.cancel-res-btn')) {
        openCancellationModal(reservationId);
    }
});

// --- INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists() || userDocSnap.data().role !== 'staff') {
            alert('Access denied. You do not have staff permissions.');
            signOut(auth);
            window.location.href = 'login.html';
            return;
        }
        await populateCustomerDropdown();
        await loadReservations();
        await loadEventRequests();
    } else {
        window.location.href = 'login.html';
    }
});

const savedTheme = localStorage.getItem('theme') === 'true';
themeSwitch.checked = savedTheme;
setDarkMode(savedTheme);