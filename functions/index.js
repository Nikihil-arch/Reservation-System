const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Creates a staff user. Secured by verifying the admin's ID token.
 */
exports.createStaffUser = functions.https.onRequest(async (req, res) => {
  // This block handles CORS permissions to allow your local site to call the live function
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    // Verify the user is an admin
    const idToken = req.headers.authorization.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const adminDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();

    if (!adminDoc.exists || adminDoc.data().role !== "admin") {
      return res.status(403).send({error: "Permission denied. You must be an admin."});
    }

    const {name, email, password} = req.body.data;
    
    // Create the user in Firebase Authentication
    const userRecord = await admin.auth().createUser({email, password, displayName: name});

    // Create the user document in Firestore
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      name, email, role: "staff", createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).send({data: {result: `Successfully created staff user ${email}`}});
  } catch (error) {
    console.error("Error in createStaffUser:", error);
    
    // --- NEW: Better Error Handling ---
    // This catches the weak password error and sends a clear message.
    if (error.code === 'auth/invalid-password') {
      return res.status(400).send({ error: { message: 'Password is too weak. It must be at least 6 characters long.' } });
    }
    // This catches if the email is already in use.
    if (error.code === 'auth/email-already-exists') {
        return res.status(400).send({ error: { message: 'This email address is already in use by another account.' } });
    }
    // For all other errors, send a generic server error.
    return res.status(500).send({error: { message: 'An internal server error occurred.'} });
    // ------------------------------------
  }
});

/**
 * Deletes a staff user.
 */
exports.deleteStaffUser = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const idToken = req.headers.authorization.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const adminDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();

    if (!adminDoc.exists || adminDoc.data().role !== "admin") {
        return res.status(403).send({error: "Permission denied. You must be an admin."});
    }
      
    const staffUidToDelete = req.body.data.uid;
    if (!staffUidToDelete) {
        return res.status(400).send({error: "Missing user ID."});
    }

    if (staffUidToDelete === decodedToken.uid) {
        return res.status(400).send({error: "Admins cannot delete their own account."});
    }

    await admin.auth().deleteUser(staffUidToDelete);
    await admin.firestore().collection("users").doc(staffUidToDelete).delete();

    return res.status(200).send({data: {result: `Successfully deleted user ${staffUidToDelete}`}});
  } catch (error) {
    console.error("Error in deleteStaffUser:", error);
    return res.status(500).send({error: error.message});
  }
});