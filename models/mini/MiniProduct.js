const mongoose = require('mongoose');

const miniProductSchema = new mongoose.Schema({
  miniUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MiniUser',
    default: null,
  },
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  brandName: {
    type: String,
    default: '',
  },
  categoryName: {
    type: String,
    default: '',
  },
  subCategoryName: {
    type: String,
    default: '',
  },
  media: [
    {
      url: String,
      type: {
        type: String,
        enum: ['image', 'video', 'document'],
      },
    },
  ],
  description: {
    type: String,
    default: '',
  },
  unit: {
    type: String,
    default: 'piece',
  },
  qty: {
    type: Number,
    default: 0,
  },
  price: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Validation: max 5 media items
miniProductSchema.pre('save', function (next) {
  if (this.media && this.media.length > 5) {
    throw new Error('Maximum 5 media items allowed');
  }
  next();
});

miniProductSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('MiniProduct', miniProductSchema);
