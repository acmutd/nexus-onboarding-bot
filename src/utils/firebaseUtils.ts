
import * as admin from 'firebase-admin'
import {GuildMember} from 'discord.js'
const { FIREBASE_PROJECT_ID } = process.env;
const serviceAccount = require('../service-account.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID
    });
    console.log('✅ Firebase Admin initialized');
}
export async function getUserSnapshot(discordId:string):Promise<admin.firestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>>{
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('discordId', '==', discordId).get();
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
        discordUsername: member.user.username,
        discordId: member.user.id,
        discordAvatar: member.user.avatar,
        createdAt: new Date().toISOString(),
        servers: [member.guild.id]
    });
    console.log(`✅ Guest user created for ${member.user.tag}`);
}

