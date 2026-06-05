const express = require('express');
const router = express.Router();
const { Site } = require('../models/Misc');
const { protectMember, protectAdmin } = require('../middleware/auth');

// Member: create site
router.post('/', protectMember, async (req, res) => {
  try {
    const { siteName, siteLocation, timeline, estimatedBudget, notes, selectedProducts } = req.body;
    const site = await Site.create({
      member: req.member._id,
      siteName, siteLocation, timeline, estimatedBudget, notes, selectedProducts,
      statusUpdates: [{ status: 'submitted', note: 'Site creation request submitted', updatedAt: new Date() }],
    });
    res.status(201).json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Member: get my sites
router.get('/my', protectMember, async (req, res) => {
  try {
    const sites = await Site.find({ member: req.member._id }).sort({ createdAt: -1 });
    res.json({ success: true, sites });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: get all sites
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { memberId, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (memberId) query.member = memberId;
    if (status) query.status = status;
    const sites = await Site.find(query)
      .populate('member', 'name memberId email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Site.countDocuments(query);
    res.json({ success: true, sites, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: update site status
router.put('/admin/:id/status', protectAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const site = await Site.findByIdAndUpdate(req.params.id, {
      status,
      $push: { statusUpdates: { status, note, updatedAt: new Date() } },
    }, { new: true });
    res.json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
