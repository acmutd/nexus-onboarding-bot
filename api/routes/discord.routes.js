const express = require('express');
const router = express.Router();

// Import controller functions
const { allocateToJoinedServer } = require('../controllers/course.allocator.contoller.js');

// POST /auth/makeUserByDiscord
router.post('/allocateToJoinedServer', allocateToJoinedServer);

module.exports = router;