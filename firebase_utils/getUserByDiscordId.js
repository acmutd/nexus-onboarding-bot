const admin = require('firebase-admin');
const { query, where, getDocs, FirestoreError } = require('firebase/firestore');
const {
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    GOOGLE_APPLICATION_CREDENTIALS,
    FIREBASE_PROJECT_ID
} = process.env;

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccount = require('../service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
    });
    console.log('Firebase Admin initialized');
}

const getUser = async (discordId) => {
    const usersRef = admin.firestore().collection('users');
    const q = query(usersRef, where('discordId', '==', discordId));
    const querySnapshot = await getDocs(q);
    //If user is not verified in Nexus/discord, throw errors
    if (querySnapshot.empty)
        throw new FirestoreError('not-found',"User not found");

    //returns user's data
    querySnapshot.forEach((doc) => {
        // doc.data() is never undefined for query doc snapshots
        console.log(doc.id, " => ", doc.data());
        return doc.data();
    });
};

module.exports = getUser;
