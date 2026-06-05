const express = require('express');
const router = express.Router();
const { Category, Subcategory } = require('../models/Category');
const Brand = require('../models/Brand');
const { protectAdmin } = require('../middleware/auth');
const upload = require('../config/multer');

// GET categories by brand (public)
router.get('/brand/:brandId', async (req, res) => {
  try {
    const categories = await Category.find({ brand: req.params.brandId, status: 'published' })
      .populate('subcategories');
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all categories admin
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { brandId, search } = req.query;
    const query = {};
    if (brandId) query.brand = brandId;
    if (search) query.name = { $regex: search, $options: 'i' };
    const categories = await Category.find(query)
      .populate('brand', 'name logo')
      .populate('subcategories');
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CREATE category
router.post('/', protectAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, brandId, status } = req.body;
    const image = req.file ? `/uploads/categories/${req.file.filename}` : '';
    const category = await Category.create({ name, brand: brandId, image, status: status || 'published' });

    // Add to brand's category list
    res.status(201).json({ success: true, category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE category
router.put('/:id', protectAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, status } = req.body;
    const updateData = { name, status };
    if (req.file) updateData.image = `/uploads/categories/${req.file.filename}`;
    const category = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({ success: true, category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE category
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    await Subcategory.deleteMany({ category: req.params.id });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// STATUS update
router.patch('/:id/status', protectAdmin, async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, category: cat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======== SUBCATEGORY ========
router.post('/subcategory', protectAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, categoryId, brandId, status } = req.body;
    const image = req.file ? `/uploads/categories/${req.file.filename}` : '';
    const sub = await Subcategory.create({ name, category: categoryId, brand: brandId, image, status: status || 'published' });
    await Category.findByIdAndUpdate(categoryId, { $push: { subcategories: sub._id } });
    res.status(201).json({ success: true, subcategory: sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/subcategory/:id', protectAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, status } = req.body;
    const updateData = { name, status };
    if (req.file) updateData.image = `/uploads/categories/${req.file.filename}`;
    const sub = await Subcategory.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({ success: true, subcategory: sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/subcategory/:id', protectAdmin, async (req, res) => {
  try {
    const sub = await Subcategory.findByIdAndDelete(req.params.id);
    if (sub) await Category.findByIdAndUpdate(sub.category, { $pull: { subcategories: sub._id } });
    res.json({ success: true, message: 'Subcategory deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/subcategory/category/:categoryId', async (req, res) => {
  try {
    const subs = await Subcategory.find({ category: req.params.categoryId, status: 'published' });
    res.json({ success: true, subcategories: subs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
