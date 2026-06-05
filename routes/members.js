const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const { MembershipApplication } = require('../models/Misc');
const User = require('../models/User');
const { protectAdmin, protectUser, protectMember } = require('../middleware/auth');
const upload = require('../config/multer');

// Helper: generate member ID
async function generateMemberId() {
  const count = await Member.countDocuments();
  return `BM${String(count + 1).padStart(3, '0')}`;
}

// Helper: generate password
function generatePassword(name, count) {
  const firstLetter = name.charAt(0).toUpperCase();
  return `BM${firstLetter}${String(count + 1).padStart(3, '0')}`;
}

// ===== USER: Apply for membership =====
router.post('/apply', protectUser, async (req, res) => {
  try {
    const { businessName, gstNumber, address, phone } = req.body;
    const existing = await MembershipApplication.findOne({ user: req.user._id, status: 'pending' });
    if (existing) return res.status(400).json({ success: false, message: 'Application already pending' });

    const application = await MembershipApplication.create({
      user: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone: req.user.phone || phone,
      businessName, gstNumber, address, phone,
    });

    await User.findByIdAndUpdate(req.user._id, { membershipStatus: 'pending' });
    res.status(201).json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== USER: Check membership status =====
router.get('/status', protectUser, async (req, res) => {
  try {
    const application = await MembershipApplication.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, application, user: { membershipStatus: req.user.membershipStatus } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Get all applications =====
router.get('/admin/applications', protectAdmin, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.$or = [{ userName: { $regex: search, $options: 'i' } }, { userEmail: { $regex: search, $options: 'i' } }];

    const applications = await MembershipApplication.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('user', 'name email avatar phone');

    const total = await MembershipApplication.countDocuments(query);
    res.json({ success: true, applications, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Approve membership =====
router.post('/admin/approve/:applicationId', protectAdmin, async (req, res) => {
  try {
    const application = await MembershipApplication.findById(req.params.applicationId).populate('user');
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const count = await Member.countDocuments();
    const memberId = req.body.memberId || await generateMemberId();
    const plainPassword = req.body.password || generatePassword(application.userName, count);

    // Create member account
    const member = await Member.create({
      memberId,
      password: plainPassword,
      name: application.userName,
      email: application.userEmail,
      phone: application.userPhone,
      userId: application.user._id,
    });

    // Update application
    await MembershipApplication.findByIdAndUpdate(req.params.applicationId, {
      status: 'approved',
      approvedMemberId: memberId,
      processedAt: new Date(),
      adminNote: req.body.adminNote || '',
    });

    // Update user status
    await User.findByIdAndUpdate(application.user._id, {
      membershipStatus: 'approved',
    });

    res.json({ success: true, member: { ...member.toObject(), plainPassword }, memberId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Reject application =====
router.post('/admin/reject/:applicationId', protectAdmin, async (req, res) => {
  try {
    const application = await MembershipApplication.findByIdAndUpdate(
      req.params.applicationId,
      { status: 'rejected', adminNote: req.body.adminNote, processedAt: new Date() },
      { new: true }
    );
    await User.findByIdAndUpdate(application.user, { membershipStatus: 'rejected' });
    res.json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Get all members =====
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { memberId: { $regex: search, $options: 'i' } }];
    const members = await Member.find(query).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await Member.countDocuments(query);
    res.json({ success: true, members, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Update business profile =====
router.put('/profile', protectMember, upload.fields([
  { name: 'companyLogo', maxCount: 1 },
  { name: 'gstCertificate', maxCount: 1 },
  { name: 'aadhaarCard', maxCount: 1 },
]), async (req, res) => {
  try {
    const body = req.body;
    const businessProfile = {
      companyName: body.companyName,
      companyLogoText: body.companyLogoText,
      companyDescription: body.companyDescription,
      gstNumber: body.gstNumber,
      address: body.address,
    };
    if (req.files?.companyLogo) businessProfile.companyLogo = `/uploads/members/${req.files.companyLogo[0].filename}`;
    if (req.files?.gstCertificate) businessProfile.gstCertificate = `/uploads/members/${req.files.gstCertificate[0].filename}`;
    if (req.files?.aadhaarCard) businessProfile.aadhaarCard = `/uploads/members/${req.files.aadhaarCard[0].filename}`;

    const member = await Member.findByIdAndUpdate(req.member._id, { businessProfile }, { new: true }).select('-password');
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Add address =====
router.post('/address', protectMember, async (req, res) => {
  try {
    const member = await Member.findByIdAndUpdate(
      req.member._id,
      { $push: { addresses: req.body } },
      { new: true }
    ).select('-password');
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
