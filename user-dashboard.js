import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, deleteDoc, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyA2dRglUE8f8slzGrON90JXUv_lJFh2eb8", authDomain: "alfies-pizzeria-47711.firebaseapp.com", projectId: "alfies-pizzeria-47711", storageBucket: "alfies-pizzeria-47711.appspot.com", messagingSenderId: "546884170927", appId: "1:546884170927:web:0887c8ada543729dfd105a" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
const userNameEl = document.getElementById('user-name');
const customerInfoEl = document.getElementById('customer-info');
const allergyDropdown = document.getElementById('allergy-dropdown');
const allergyTags = document.getElementById('allergy-tags');
const favouriteInput = document.getElementById('favourite-input');
const favouriteTags = document.getElementById('favourite-tags');
const logoutBtn = document.getElementById('logout-btn');
const themeSwitch = document.getElementById('theme-switch');
const mainContent = document.querySelector('.dashboard-main');
const reviewModal = document.getElementById('review-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const reviewForm = document.getElementById('review-form');
const submitReviewBtn = document.getElementById('submit-review-btn');
const eventRequestsList = document.getElementById('event-requests-list');
const memberSinceEl = document.getElementById('member-since');
const totalVisitsEl = document.getElementById('total-visits');
const goToDishEl = document.getElementById('go-to-dish');
const topRatingEl = document.getElementById('top-rating');
const cancellationModal = document.getElementById('cancellation-modal');
const closeCancelModalBtn = document.getElementById('close-cancel-modal-btn');
const cancellationForm = document.getElementById('cancellation-form');

// --- GLOBAL STATE ---
let currentUser, userDocRef;
let currentEditingReservationId = null;
let currentReservationIdToReview = null;
let currentReservationIdToCancel = null;
let pastReservationsCache = [];
let userDataCache = {};
const availableTimes = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

// --- HELPER FUNCTIONS ---
function setDarkMode(enabled) { document.body.classList.toggle('dark', enabled); localStorage.setItem('theme', enabled ? 'true' : 'false'); }
function renderUserInfo(data) { customerInfoEl.innerHTML = `<p><strong>Name:</strong> ${data.name || 'N/A'}</p><p><strong>Email:</strong> ${currentUser.email || 'N/A'}</p><p><strong>Travel Distance:</strong> ${data.travelDistance || 'N/A'}</p>`; }
function updateTags(items, container, type) { container.innerHTML = ''; items.forEach(item => { const tag = document.createElement('span'); tag.className = 'tag'; tag.innerHTML = `${item} <button data-item="${item}" data-type="${type}" class="remove-tag-btn">×</button>`; container.appendChild(tag); }); }
function getTodayDateString() { const today = new Date(); const year = today.getFullYear(); const month = String(today.getMonth() + 1).padStart(2, '0'); const day = String(today.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };

// --- DATA FETCHING AND RENDERING ---
async function loadAndCategorizeReservations() {
    if (!currentUser || !currentUser.uid) return [];
    const reservationsList = document.getElementById('reservations-list');
    const pastReservationsList = document.getElementById('past-reservations-list');
    reservationsList.innerHTML = '<li>Loading reservations...</li>';
    pastReservationsList.innerHTML = '<li>Loading history...</li>';

    const reservationsQuery = query(collection(db, 'reservations'), where('userId', '==', currentUser.uid));
    const reviewsQuery = query(collection(db, 'reviews'), where('userId', '==', currentUser.uid));
    
    try {
        const [reservationSnapshot, reviewSnapshot] = await Promise.all([getDocs(reservationsQuery), getDocs(reviewsQuery)]);
        const reviewedReservationIds = new Set(reviewSnapshot.docs.map(doc => doc.data().reservationId));
        const upcoming = [], past = [];
        const today = new Date(); today.setHours(0, 0, 0, 0);

        reservationSnapshot.forEach(doc => {
            const reservation = { id: doc.id, ...doc.data() };
            reservation.hasReview = reviewedReservationIds.has(reservation.id);
            const reservationDate = new Date(reservation.date + 'T00:00:00');
            
            if (reservation.status === 'cancelled') {
                past.push(reservation);
            } else if (reservationDate < today) {
                past.push(reservation);
            } else {
                upcoming.push(reservation);
            }
        });
        
        renderReservationList(upcoming, reservationsList, false);
        renderReservationList(past, pastReservationsList, true);
        
        pastReservationsCache = past.filter(res => res.status !== 'cancelled');
        return pastReservationsCache;
    } catch (error) {
        console.error("Error loading reservations:", error);
        return [];
    }
}

function renderReservationList(list, container, isPast) {
    container.innerHTML = '';
    if (list.length === 0) { container.innerHTML = `<li>No ${isPast ? 'history' : 'upcoming reservations'} found.</li>`; return; }
    list.sort((a,b) => new Date(b.date) - new Date(a.date));
    list.forEach(resData => {
        const li = document.createElement('li');
        li.setAttribute('data-reservation-id', resData.id);
        let actionButtons = '';

        if (resData.status === 'cancelled') {
            li.classList.add('reservation-cancelled');
            actionButtons = `<span class="status-badge denied">Cancelled on ${new Date(resData.cancelledAt.seconds * 1000).toLocaleDateString()}</span>`;
        } else if (isPast) {
            actionButtons = resData.hasReview ? `<button class="action-btn" disabled>✔ Review Submitted</button>` : `<button data-id="${resData.id}" class="action-btn leave-review-btn">⭐ Leave Review</button>`;
        } else {
            actionButtons = `<button data-id="${resData.id}" class="action-btn edit-res-btn">✏️ Edit</button> <button data-id="${resData.id}" class="delete-btn action-btn">🗑 Cancel</button>`;
        }

        li.innerHTML = `<div class="reservation-details"><strong>Date:</strong> <span class="res-date">${resData.date}</span><br/><strong>Time:</strong> <span class="res-time">${resData.time}</span><br/><strong>Guests:</strong> <span class="res-seats">${resData.seats || 'N/A'}</span></div><div class="reservation-actions">${actionButtons}</div><div class="edit-reservation-form" style="display:none;"></div>`;
        container.appendChild(li);
    });
}

async function updateDinerSnapshot(pastReservations, userData) {
    if (!userData || !currentUser) return;
    if (userData.createdAt && userData.createdAt.toDate) {
        const date = userData.createdAt.toDate();
        memberSinceEl.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else { memberSinceEl.textContent = 'A while ago'; }
    totalVisitsEl.textContent = pastReservations.length;
    goToDishEl.textContent = userData.favouriteDishes && userData.favouriteDishes.length > 0 ? userData.favouriteDishes[0] : 'Not set';
    const reviewsQuery = query(collection(db, 'reviews'), where('userId', '==', currentUser.uid), orderBy('rating', 'desc'), limit(1));
    try {
        const reviewSnapshot = await getDocs(reviewsQuery);
        if (!reviewSnapshot.empty) {
            const topReview = reviewSnapshot.docs[0].data();
            topRatingEl.textContent = '★'.repeat(topReview.rating) + '☆'.repeat(5 - topReview.rating);
        } else { topRatingEl.textContent = 'No ratings yet'; }
    } catch { topRatingEl.textContent = 'N/A'; }
}

async function loadEventRequests() {
    if (!currentUser || !currentUser.uid) return;
    eventRequestsList.innerHTML = '<li>Loading event requests...</li>';
    const eventsQuery = query(collection(db, 'eventBookings'), where('userId', '==', currentUser.uid));
    try {
        const querySnapshot = await getDocs(eventsQuery);
        eventRequestsList.innerHTML = '';
        if (querySnapshot.empty) { eventRequestsList.innerHTML = '<li>You have not requested any events.</li>'; return; }
        const events = [];
        querySnapshot.forEach(doc => { events.push({ id: doc.id, ...doc.data() }); });
        events.sort((a,b) => b.requestedAt.toMillis() - a.requestedAt.toMillis());
        events.forEach(eventData => {
            const li = document.createElement('li');
            let statusClass = eventData.status || 'pending';
            li.innerHTML = `<div class="reservation-details"><strong>Date:</strong> ${eventData.date}<br/><strong>Time:</strong> ${eventData.time}<br/><strong>Guests:</strong> ${eventData.guests}</div><div class="reservation-actions"><span class="status-badge ${statusClass}">${eventData.status}</span></div>`;
            eventRequestsList.appendChild(li);
        });
    } catch (error) { console.error("Error loading event requests:", error); }
}

function openReviewModal(reservationId) { currentReservationIdToReview = reservationId; reviewForm.reset(); reviewModal.style.display = 'flex'; }
function closeReviewModal() { reviewModal.style.display = 'none'; currentReservationIdToReview = null; }

function toggleEditForm(listItem, reservationId) {
    const editFormContainer = listItem.querySelector('.edit-reservation-form');
    const detailsContainer = listItem.querySelector('.reservation-details');
    const editButton = listItem.querySelector('.edit-res-btn');
    const isEditingThis = currentEditingReservationId === reservationId;
    if (currentEditingReservationId && !isEditingThis) { const otherItem = document.querySelector(`li[data-reservation-id="${currentEditingReservationId}"]`); if (otherItem) { otherItem.querySelector('.edit-reservation-form').style.display = 'none'; otherItem.querySelector('.reservation-details').style.display = 'block'; otherItem.querySelector('.edit-res-btn').textContent = '✏️ Edit'; } }
    if (isEditingThis) { editFormContainer.style.display = 'none'; detailsContainer.style.display = 'block'; editButton.textContent = '✏️ Edit'; currentEditingReservationId = null; }
    else { const currentDate = listItem.querySelector('.res-date').textContent; const currentTime = listItem.querySelector('.res-time').textContent; const currentSeats = listItem.querySelector('.res-seats').textContent; let seatOptions = ''; for (let i = 1; i <= 8; i++) { seatOptions += `<option value="${i}" ${i == currentSeats ? 'selected' : ''}>${i} ${i > 1 ? 'People' : 'Person'}</option>`; } editFormContainer.innerHTML = `<h4>Edit Reservation</h4><div class="form-group-inline"><label>Date:</label><input type="date" id="edit-date-${reservationId}" value="${currentDate}" min="${getTodayDateString()}"></div><div class="form-group-inline"><label>Time:</label><select id="edit-time-${reservationId}">${availableTimes.map(t => `<option value="${t}" ${t === currentTime ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="form-group-inline"><label>Guests:</label><select id="edit-seats-${reservationId}">${seatOptions}</select></div><div class="form-actions"><button class="action-btn save-edit-btn" data-id="${reservationId}">💾 Save</button><button class="action-btn cancel-edit-btn" data-id="${reservationId}">❌ Cancel</button></div><div id="edit-error-${reservationId}" class="error-message" style="margin-top:0.5em;"></div>`; editFormContainer.style.display = 'block'; detailsContainer.style.display = 'none'; editButton.textContent = '✖️ Cancel Edit'; currentEditingReservationId = reservationId; }
}

async function handleSaveEdit(reservationId) {
    const errorEl = document.getElementById(`edit-error-${reservationId}`);
    errorEl.textContent = '';
    const newDate = document.getElementById(`edit-date-${reservationId}`).value;
    const newTime = document.getElementById(`edit-time-${reservationId}`).value;
    const newSeats = document.getElementById(`edit-seats-${reservationId}`).value;
    if (!newDate || !newTime || !newSeats) { errorEl.textContent = 'Please fill out all fields.'; return; }
    try { await updateDoc(doc(db, 'reservations', reservationId), { date: newDate, time: newTime, seats: Number(newSeats) }); alert('Reservation updated successfully!'); const past = await loadAndCategorizeReservations(); await updateDinerSnapshot(past, userDataCache); }
    catch (error) { console.error("Error updating reservation:", error); errorEl.textContent = 'Failed to update reservation.'; }
}

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
themeSwitch.addEventListener('change', e => setDarkMode(e.target.checked));
logoutBtn.addEventListener('click', e => { e.preventDefault(); signOut(auth).catch(error => console.error("Logout error:", error)); });

// --- NEW: EVENT LISTENER FOR ALLERGY DROPDOWN ---
allergyDropdown.addEventListener('change', async (e) => {
    const allergy = e.target.value;
    // Do nothing if the user selects the disabled placeholder or if user data isn't loaded
    if (!allergy || !userDocRef) {
        return;
    }

    try {
        allergyDropdown.disabled = true; // Prevent multiple submissions
        // Add the selected allergy to the user's document in Firestore
        await updateDoc(userDocRef, {
            allergies: arrayUnion(allergy)
        });

        // Refresh the local user data and update the tags on screen
        const userSnap = await getDoc(userDocRef);
        userDataCache = userSnap.data();
        updateTags(userDataCache.allergies || [], allergyTags, 'allergy');

        // Reset the dropdown to the placeholder
        e.target.value = '';
    } catch (err) {
        console.error("Error adding allergy:", err);
        alert("There was an error adding the allergy. Please try again.");
    } finally {
        allergyDropdown.disabled = false; // Re-enable the dropdown
    }
});
// --------------------------------------------------

favouriteInput.addEventListener('keypress', async e => { const dish = favouriteInput.value.trim(); if (e.key === 'Enter' && dish && userDocRef) { try { await updateDoc(userDocRef, { favouriteDishes: arrayUnion(dish) }); const userSnap = await getDoc(userDocRef); userDataCache = userSnap.data(); updateTags(userDataCache.favouriteDishes || [], favouriteTags, 'favourite'); await updateDinerSnapshot(pastReservationsCache, userDataCache); favouriteInput.value = ''; } catch (err) { console.error("Error adding favourite:", err); } } });
document.addEventListener('click', async e => { if (e.target.matches('.remove-tag-btn')) { const item = e.target.dataset.item; const type = e.target.dataset.type; const field = type === 'allergy' ? 'allergies' : 'favouriteDishes'; const container = type === 'allergy' ? allergyTags : favouriteTags; if (!userDocRef) return; try { await updateDoc(userDocRef, { [field]: arrayRemove(item) }); const userSnap = await getDoc(userDocRef); userDataCache = userSnap.data(); updateTags(userDataCache[field] || [], container, type); await updateDinerSnapshot(pastReservationsCache, userDataCache); } catch (err) { console.error("Error removing tag:", err); } } });

mainContent.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button || !button.dataset.id) return;
    const reservationId = button.dataset.id;
    const listItem = button.closest('li');
    if (button.classList.contains('delete-btn')) { openCancellationModal(reservationId); }
    else if (button.classList.contains('edit-res-btn') || button.classList.contains('cancel-edit-btn')) { toggleEditForm(listItem, reservationId); } 
    else if (button.classList.contains('leave-review-btn')) { openReviewModal(reservationId); } 
    else if (button.classList.contains('save-edit-btn')) { await handleSaveEdit(reservationId); }
});

closeCancelModalBtn.addEventListener('click', closeCancellationModal);
cancellationModal.addEventListener('click', (e) => { if (e.target === cancellationModal) closeCancellationModal(); });

cancellationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentReservationIdToCancel) return;
    const reason = cancellationForm.reason.value;
    if (!reason) { alert("Please select a reason."); return; }
    try {
        const reservationDocRef = doc(db, 'reservations', currentReservationIdToCancel);
        await updateDoc(reservationDocRef, { status: 'cancelled', cancellationReason: reason, cancelledAt: serverTimestamp() });
        closeCancellationModal();
        alert("Your reservation has been cancelled.");
        const past = await loadAndCategorizeReservations();
        await updateDinerSnapshot(past, userDataCache);
    } catch (error) { console.error("Error cancelling reservation:", error); alert("Failed to cancel."); }
});

reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentReservationIdToReview) return;
    const rating = reviewForm.rating.value;
    const text = reviewForm.review.value;
    if (!rating) { alert("Please select a star rating."); return; }
    submitReviewBtn.disabled = true;
    submitReviewBtn.textContent = 'Submitting...';
    try {
        await addDoc(collection(db, 'reviews'), { userId: currentUser.uid, userName: userNameEl.textContent, reservationId: currentReservationIdToReview, rating: Number(rating), text: text.trim(), createdAt: serverTimestamp() });
        closeReviewModal();
        alert("Thank you for your review!");
        const past = await loadAndCategorizeReservations();
        await updateDinerSnapshot(past, userDataCache);
    } catch (error) { console.error("Error submitting review:", error); } finally { submitReviewBtn.disabled = false; submitReviewBtn.textContent = 'Submit Review'; }
});

// --- INITIALIZATION ---
const savedTheme = localStorage.getItem('theme') === 'true';
themeSwitch.checked = savedTheme;
setDarkMode(savedTheme);
onAuthStateChanged(auth, async user => {
    if (user) {
        currentUser = user;
        userDocRef = doc(db, 'users', user.uid);
        try {
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                userDataCache = userSnap.data();
                userNameEl.textContent = userDataCache.name || 'User';
                renderUserInfo(userDataCache);
                updateTags(userDataCache.allergies || [], allergyTags, 'allergy');
                updateTags(userDataCache.favouriteDishes || [], favouriteTags, 'favourite');
                const pastReservations = await loadAndCategorizeReservations();
                await loadEventRequests();
                await updateDinerSnapshot(pastReservations, userDataCache);
            } else { signOut(auth); }
        } catch (error) { console.error("Error fetching user data:", error); }
    } else {
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    }
});