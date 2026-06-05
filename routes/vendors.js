const express = require('express');
const router = express.Router();
const { Vendor } = require('../models/Basket');
const { BasketItem } = require('../models/Basket');

// Public: get vendor form info (by token + item ids)
router.get('/form/:token', async (req, res) => {
  try {
    const { items } = req.query;
    const itemIds = items ? items.split(',') : [];
    const basketItems = await BasketItem.find({ _id: { $in: itemIds } })
      .populate('product', 'name images')
      .select('productSnapshot variant quantity product');
    res.json({ success: true, basketItems });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public: submit vendor price
router.post('/submit', async (req, res) => {
  try {
    const { formToken, vendorName, vendorEmail, vendorPhone, prices } = req.body;
    const results = [];
    for (const price of prices) {
      const { basketItemId, ...priceData } = price;
      const vendor = await Vendor.findOneAndUpdate(
        { formToken: `${formToken}-${basketItemId}`, basketItem: basketItemId },
        { vendorName, vendorEmail, vendorPhone, submittedPrices: priceData, submitted: true, submittedAt: new Date() },
        { new: true, upsert: true }
      );
      results.push(vendor);
    }
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
