const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Member = require('../models/Member');

// Get all users
router.get('/users', protectAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = search ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] } : {};
    const users = await User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await User.countDocuments(query);
    res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
