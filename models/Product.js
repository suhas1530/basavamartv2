const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stock: { type: Number, default: 0 },
  unit: { type: String, default: 'pcs' },
  weight: { type: Number, default: 0 },
  listPrice: { type: Number, required: true },
  discountPercent: { type: Number, default: 0 },
  profitPercent: { type: Number, default: 0 },
  gstType: { type: String, enum: ['CGST+SGST', 'IGST'], default: 'CGST+SGST' },
  gstPercent: { type: Number, default: 0 },
  // Calculated fields
  basePrice: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  profitAmount: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  finalPrice: { type: Number, default: 0 },
  // Packaging thresholds
  primaryThreshold: { type: Number, default: 0 },
  secondaryThreshold: { type: Number, default: 0 },
  tertiaryThreshold: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

const descriptionSchema = new mongoose.Schema({
  heading: String,
  subHeading: String,
  paragraph: String,
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  hsnCode: { type: String, default: '' },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcategory' },
  accessLevel: { type: String, enum: ['user', 'member', 'both'], default: 'both' },

  descriptions: [descriptionSchema],
  videoLinks: [{ title: String, url: String }],

  images: [{ type: String }], // file paths
  catalogs: [{ name: String, path: String }], // PDF/docs

  variants: [variantSchema],

  tags: [String], // AI-generated tags

  status: { type: String, enum: ['published', 'draft', 'hold'], default: 'published' },

  totalViews: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

// Text index for search
productSchema.index({ name: 'text', tags: 'text', hsnCode: 'text' });

module.exports = mongoose.model('Product', productSchema);
