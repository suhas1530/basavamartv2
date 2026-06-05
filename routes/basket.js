const express = require('express');
const router = express.Router();
const { BasketItem, Vendor } = require('../models/Basket');
const Product = require('../models/Product');
const { protectMember, protectAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Helper: package breakdown
function calcPackageBreakdown(qty, t = 0, s = 0, p = 0) {
  let remaining = qty;
  const result = { tertiary: { qty: t, count: 0, total: 0 }, secondary: { qty: s, count: 0, total: 0 }, primary: { qty: p, count: 0, total: 0 }, remainder: { count: 0 } };
  if (t > 0) { result.tertiary.count = Math.floor(remaining / t); remaining %= t; result.tertiary.total = result.tertiary.count * t; }
  if (s > 0) { result.secondary.count = Math.floor(remaining / s); remaining %= s; result.secondary.total = result.secondary.count * s; }
  if (p > 0) { result.primary.count = Math.floor(remaining / p); remaining %= p; result.primary.total = result.primary.count * p; }
  result.remainder.count = remaining;
  return result;
}

// ===== MEMBER: Move product to basket ("Know the Price") =====
router.post('/add', protectMember, async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;
    const product = await Product.findById(productId).populate('brand', 'name').populate('category', 'name').populate('subcategory', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const variant = product.variants.id(variantId);
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });

    // Check if already in basket
    const existing = await BasketItem.findOne({ member: req.member._id, product: productId, 'variant.variantId': variantId });
    if (existing) {
      existing.quantity = quantity;
      await existing.save();
      return res.json({ success: true, basketItem: existing });
    }

    const orderCount = await BasketItem.countDocuments({ member: req.member._id });
    const basketItem = await BasketItem.create({
      member: req.member._id,
      product: productId,
      productSnapshot: {
        name: product.name,
        image: product.images[0] || '',
        brandName: product.brand?.name || '',
        categoryName: product.category?.name || '',
        subcategoryName: product.subcategory?.name || '',
      },
      variant: { variantId: variant._id, name: variant.name, unit: variant.unit, weight: variant.weight },
      quantity,
      orderNumber: `BM-BSKT-${req.member.memberId}-${String(orderCount + 1).padStart(3, '0')}`,
      packageBreakdown: calcPackageBreakdown(quantity, variant.tertiaryThreshold, variant.secondaryThreshold, variant.primaryThreshold),
    });

    res.status(201).json({ success: true, basketItem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Get basket =====
router.get('/my', protectMember, async (req, res) => {
  try {
    const items = await BasketItem.find({ member: req.member._id })
      .populate('product', 'name images brand category subcategory')
      .sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Remove basket item =====
router.delete('/:id', protectMember, async (req, res) => {
  try {
    await BasketItem.findOneAndDelete({ _id: req.params.id, member: req.member._id });
    res.json({ success: true, message: 'Removed from basket' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Get all basket items =====
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { memberId, status, page = 1, limit = 20, startDate, endDate } = req.query;
    const query = {};
    if (memberId) query.member = memberId;
    if (status) query.adminStatus = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const items = await BasketItem.find(query)
      .populate('member', 'name memberId email phone')
      .populate('product', 'name images')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await BasketItem.countDocuments(query);
    res.json({ success: true, items, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Update basket item status =====
router.put('/admin/:id/status', protectAdmin, async (req, res) => {
  try {
    const { adminStatus, adminStatusMessage } = req.body;
    const item = await BasketItem.findByIdAndUpdate(req.params.id, { adminStatus, adminStatusMessage }, { new: true });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Set vendor price and enable payment =====
router.put('/admin/:id/price', protectAdmin, async (req, res) => {
  try {
    const { vendorPrice, selectedVendorId, paymentEnabled } = req.body;

    // Calculate final price
    const { listPrice, discountPercent, profitPercent, gstPercent, gstType } = vendorPrice;
    const discountAmount = (listPrice * discountPercent) / 100;
    const priceAfterDiscount = listPrice - discountAmount;
    const profitAmount = (priceAfterDiscount * profitPercent) / 100;
    const basePrice = priceAfterDiscount + profitAmount;
    const gstAmount = (basePrice * gstPercent) / 100;
    const finalPrice = basePrice + gstAmount;

    const calculatedPrice = {
      ...vendorPrice,
      discountAmount: +discountAmount.toFixed(2),
      profitAmount: +profitAmount.toFixed(2),
      basePrice: +basePrice.toFixed(2),
      gstAmount: +gstAmount.toFixed(2),
      finalPrice: +finalPrice.toFixed(2),
    };

    const item = await BasketItem.findByIdAndUpdate(req.params.id, {
      vendorPrice: calculatedPrice,
      selectedVendorId,
      pricingSet: true,
      paymentEnabled: paymentEnabled !== undefined ? paymentEnabled : true,
      adminStatus: 'available',
    }, { new: true });

    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Generate vendor form link =====
router.post('/admin/vendor-form', protectAdmin, async (req, res) => {
  try {
    const { basketItemIds } = req.body;
    const token = uuidv4();
    const items = await BasketItem.find({ _id: { $in: basketItemIds } }).populate('product', 'name images');

    // Create vendor entries
    const vendorForms = await Promise.all(items.map(item =>
      Vendor.create({ basketItem: item._id, formToken: `${token}-${item._id}` })
    ));

    const shareLink = `${process.env.CLIENT_URL}/vendor-form/${token}?items=${basketItemIds.join(',')}`;
    res.json({ success: true, shareLink, token, vendorForms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== VENDOR: Submit price (public route) =====
router.post('/vendor/submit', async (req, res) => {
  try {
    const { formToken, vendorName, vendorEmail, vendorPhone, submittedPrices, basketItemId } = req.body;
    const vendor = await Vendor.findOneAndUpdate(
      { formToken, basketItem: basketItemId },
      { vendorName, vendorEmail, vendorPhone, submittedPrices, submitted: true, submittedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json({ success: true, vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Get vendors for a basket item =====
router.get('/admin/:id/vendors', protectAdmin, async (req, res) => {
  try {
    const vendors = await Vendor.find({ basketItem: req.params.id, submitted: true });
    res.json({ success: true, vendors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});





// ===== MEMBER: Update Payment Status =====
router.patch('/:id', protectMember, async (req, res) => {
  try {
    const item = await BasketItem.findOneAndUpdate(
      {
        _id: req.params.id,
        member: req.member._id
      },
      req.body,
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Basket item not found'
      });
    }

    res.json({
      success: true,
      item
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


// ===== MEMBER: Get paid basket orders =====
router.get('/my/orders', protectMember, async (req, res) => {
  try {
    const orders = await BasketItem.find({ member: req.member._id, paymentStatus: 'paid' })
      .populate('product', 'name images')
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Update member delivery status =====
router.put('/admin/:id/delivery', protectAdmin, async (req, res) => {
  try {
    const { status, message } = req.body;
    const item = await BasketItem.findByIdAndUpdate(req.params.id, {
      deliveryStatus: status,
      $push: { deliveryUpdates: { status, message, updatedAt: new Date() } },
    }, { new: true });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
