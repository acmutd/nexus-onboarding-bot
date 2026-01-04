import express from 'express'
import { authenticateFirebaseUser } from '../middleware/auth.middleware';

const router = express.Router();

// Import controller functions
const { allocateToJoinedServer } = require('../controllers/course.allocator.contoller');
const { guildsFetch} = require('../controllers/guilds.fetch.controller');
const { removeUserAccess } = require('../controllers/remove.access.controller');
const { grantUserAccess } = require('../controllers/grant.access.controller');

// Apply Firebase authentication to all routes
// Users must provide a valid Firebase ID token in Authorization header
router.use(authenticateFirebaseUser);

// Protected routes require valid Firebase authentication
router.post('/allocate', allocateToJoinedServer);
router.get('/guilds', guildsFetch);
router.post('/remove-access', removeUserAccess);
router.post('/grant-access', grantUserAccess);

export default router;