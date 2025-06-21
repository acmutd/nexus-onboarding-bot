const admin = require('firebase-admin');

const { FIREBASE_PROJECT_ID } = process.env;
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
    });
    console.log('✅ Firebase Admin initialized');
}

const getUserSnapshot = async (discordId) => {
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('discordId', '==', discordId).get();
    console.log(`QuerySnapshot size for ${discordId}:`, querySnapshot.size);

    if (querySnapshot.empty) {
        const err = new Error("User not found");
        err.code = 'not-found';
        throw err;
    }

    return querySnapshot.docs[0];
};

const getUserData = async (discordId) => {
    const userSnapshot = await getUserSnapshot(discordId);
    return userSnapshot.data();
};

const manUser = async (discordId, callback) => {
  const userSnapshot = await getUserSnapshot(discordId);
  const userRef = userSnapshot.ref;
  return await callback(userRef, userSnapshot);
};

const makeUserByDiscord = async (member) => {
    const usersRef = admin.firestore().collection('users');
    await usersRef.add({
        discordUsername: member.user.username,
        discordId: member.user.id,
        discordAvatar: member.user.avatar,
        createdAt: new Date().toISOString(),
        servers: [member.guild.id]
    });
    console.log(`✅ Guest user created for ${member.user.tag}`);
};

module.exports = { getUserSnapshot, getUserData, manUser, makeUserByDiscord };
