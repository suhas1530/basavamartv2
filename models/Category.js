const mongoose = require('mongoose');

const subcategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  image: { type: String, default: '' },
  status: { type: String, enum: ['published', 'draft', 'hold'], default: 'published' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
}, { timestamps: true });

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  image: { type: String, default: '' },
  status: { type: String, enum: ['published', 'draft', 'hold'], default: 'published' },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  subcategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subcategory' }],
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);
const Subcategory = mongoose.model('Subcategory', subcategorySchema);

module.exports = { Category, Subcategory };
