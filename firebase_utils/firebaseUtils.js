const admin = require('firebase-admin');
const {signInAnonymously } =require('firebase/auth');
const { query, where, getDocs, FirestoreError } = require('firebase/firestore');
const {
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    GOOGLE_APPLICATION_CREDENTIALS,
    FIREBASE_PROJECT_ID
} = process.env;
// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: FIREBASE_PROJECT_ID
});

const auth = admin.auth();

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccount = require('../service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
    });
    console.log('Firebase Admin initialized');
}


const getUserSnapshot = async(discordId)=>{
    const usersRef = await admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('discordId', '==', discordId).get();
    //If user is not verified in Nexus/discord, throw error
    console.log('QuerySnapshot:', querySnapshot);
    if (querySnapshot.empty)
        throw new FirestoreError('not-found', "User not found");
    return querySnapshot.docs[0]
}
const getUserData = async (discordId) => {
    const userSnapshot = await getUserSnapshot(discordId)
    return userSnapshot.data();
};

//function that lets you manipulate user data via userref however you want
const manUser = async (discordId,callback) =>{
    const userSnapshot = await getUserSnapshot(discordId);
    const userRef = await userSnapshot.getReference();
    const result = await callback(userRef); 
    return result   
}

const makeUserByDiscord = async(member) =>{
    const usersRef = await admin.firestore().collection('users'); 
    await usersRef.add({
        discordUsername: member.user.username,
        discordId: member.user.id,
        discordAvatar: member.user.avatar,
        createdAt: new Date().toISOString(),
        servers:[member.guild.id]
    })

}
module.exports = {getUserSnapshot,getUserData,manUser,makeUserByDiscord}

