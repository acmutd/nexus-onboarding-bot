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
    const querySnapshot = await usersRef.where('discordId', '==', discordId).get();
    //If user is not verified in Nexus/discord, throw errors
    console.log('QuerySnapshot:', querySnapshot);
    if (querySnapshot.empty)
        throw new FirestoreError('not-found', "User not found");

    querySnapshot.forEach((doc) => {
        console.log(doc.id, " => ", doc.data());
    });
    return querySnapshot.docs[0].data();

};

module.exports = getUser;
