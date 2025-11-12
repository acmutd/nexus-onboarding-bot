import express from 'express'
const router = express.Router();

// Import controller functions
const { allocateToJoinedServer } = require('../controllers/course.allocator.contoller');
const { guildsFetch} = require('../controllers/guilds.fetch.controller');
const { removeUserAccess } = require('../controllers/remove.access.controller');
const { grantUserAccess } = require('../controllers/grant.access.controller');

// POST /auth/makeUserByDiscord
router.post('/allocate', allocateToJoinedServer);
router.get('/guilds', guildsFetch);
router.post('/remove-access', removeUserAccess);
router.post('/grant-access', grantUserAccess);

export default router;