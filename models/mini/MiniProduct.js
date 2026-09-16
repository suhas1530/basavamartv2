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
  hsnCode: {
    type: String,
    default: '',
  },
  accessLevel: {
    type: String,
    enum: ['user', 'member', 'both'],
    default: 'both',
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
  catalogs: [
    {
      url: String,
      name: String,
    },
  ],
  descriptions: [
    {
      heading: String,
      subHeading: String,
      paragraph: String,
    },
  ],
  videoLinks: [
    {
      title: String,
      url: String,
    },
  ],
  tags: {
    type: [String],
    default: [],
  },
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

// Validation: max 5 media items and 3 catalogues
miniProductSchema.pre('save', function (next) {
  if (this.media && this.media.length > 5) {
    throw new Error('Maximum 5 media items allowed');
  }
  if (this.catalogs && this.catalogs.length > 3) {
    throw new Error('Maximum 3 catalogues allowed');
  }
  next();
});

miniProductSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('MiniProduct', miniProductSchema);
