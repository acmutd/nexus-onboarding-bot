import express from 'express'
const router = express.Router();

// Import controller functions
const { allocateToJoinedServer } = require('../controllers/course.allocator.contoller');
const { guildsFetch} = require('../controllers/guilds.fetch.controller');

// POST /auth/makeUserByDiscord
router.post('/allocate', allocateToJoinedServer);
router.get('/guilds',guildsFetch)

export default router;