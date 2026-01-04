import express from 'express'
import { authenticateApiKey } from '../middleware/auth.middleware';

const router = express.Router();

// Import controller functions
const { allocateToJoinedServer } = require('../controllers/course.allocator.contoller');
const { guildsFetch} = require('../controllers/guilds.fetch.controller');
const { removeUserAccess } = require('../controllers/remove.access.controller');
const { grantUserAccess } = require('../controllers/grant.access.controller');

// Apply API key authentication to all routes
router.use(authenticateApiKey);

// Protected routes - require valid API key
router.post('/allocate', allocateToJoinedServer);
router.get('/guilds', guildsFetch);
router.post('/remove-access', removeUserAccess);
router.post('/grant-access', grantUserAccess);

export default router;