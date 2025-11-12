
import * as admin from 'firebase-admin'
import {GuildMember} from 'discord.js'
const { FIREBASE_PROJECT_ID } = process.env;
const serviceAccount = require('../../service-account.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
    });
    console.log(' Firebase Admin initialized');
}
export async function getUserSnapshot(discordId:string):Promise<admin.firestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>>{
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('discord.id', '==', discordId).get();
    console.log(`QuerySnapshot size for ${discordId}:`, querySnapshot.size);

    if (querySnapshot.empty) {
        const err = new Error("User not found");
        throw err;
    }

    return querySnapshot.docs[0];
}

export async function getUserData(discordId:string):Promise<admin.firestore.DocumentData>{
    const userSnapshot = await getUserSnapshot(discordId);
    return userSnapshot.data();
}

export async function manUser(discordId:string, callback:Function):Promise<any>{
  const userSnapshot = await getUserSnapshot(discordId);
  const userRef = userSnapshot.ref;
  return await callback(userRef, userSnapshot);
}

export async function makeUserByDiscord(member:GuildMember){
    const usersRef = admin.firestore().collection('users');
    await usersRef.add({
        discord: {
            username: member.user.username,
            id: member.user.id,
            avatarHash: member.user.avatar,
            globalName: member.user.globalName,
            linkedAt: new Date().toISOString()
        },
        email: "tempd@email.com", // Temporary email as seen in your structure
        lastUpdated: new Date().toISOString(),
        servers: [member.guild.id]
    });
    console.log(` Guest user created for ${member.user.tag}`);
}