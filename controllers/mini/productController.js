const mongoose = require('mongoose');
const MiniProduct = require('../../models/mini/MiniProduct');

// GET: Products for admin (with filters for userId, search, price)
const getAdminProducts = async (req, res) => {
  try {
    const { userId, q, minPrice, maxPrice } = req.query;
    let filter = {};

    if (userId && userId !== 'null') {
      filter.miniUserId = userId;
    }

    if (q) {
      filter.productName = new RegExp(q, 'i');
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const products = await MiniProduct.find(filter)
      .populate('miniUserId', 'miniId name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Create multiple products (admin - supports array submission)
const createProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'Products array is required' });
    }

    const createdProducts = [];

    for (const product of products) {
      const { miniUserId, productName, brandName, categoryName, subCategoryName, description, unit, qty, price } = product;

      if (!productName || !price) {
        return res.status(400).json({
          success: false,
          message: 'productName and price are required for all products',
        });
      }

      const isPublicProduct = !miniUserId || miniUserId === 'null' || miniUserId === null;
      const createdBy = req.admin?.id && mongoose.Types.ObjectId.isValid(req.admin.id)
        ? req.admin.id
        : new mongoose.Types.ObjectId().toHexString();

      const newProduct = await MiniProduct.create({
        miniUserId: miniUserId || null,
        productName,
        brandName: brandName || '',
        categoryName: categoryName || '',
        subCategoryName: subCategoryName || '',
        description: description || '',
        unit: unit || 'piece',
        qty: qty || 0,
        price,
        status: isPublicProduct ? 'published' : 'draft',
        createdBy,
        media: [],
      });

      createdProducts.push(newProduct);
    }

    res.status(201).json({
      success: true,
      message: `${createdProducts.length} product(s) created successfully`,
      data: createdProducts,
    });
  } catch (error) {
    console.error('Error creating products:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Upload media for a product
const uploadProductMedia = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const product = await MiniProduct.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const newMedia = req.files.map(file => {
      const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
      const mimetype = file.mimetype || '';

      let type = 'image';
      if (mimetype.startsWith('video/')) type = 'video';
      else if (
        ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'].includes(ext) ||
        mimetype.includes('pdf') ||
        mimetype.includes('word') ||
        mimetype.includes('sheet') ||
        mimetype.includes('presentation') ||
        mimetype.includes('text') ||
        mimetype.includes('csv')
      ) {
        type = 'document';
      }

      return {
        url: `/uploads/mini/products/${file.filename}`,
        type,
      };
    });

    // Check max 5 media items
    if (product.media.length + newMedia.length > 5) {
      return res.status(400).json({
        success: false,
        message: `Maximum 5 media items allowed. Current: ${product.media.length}, Adding: ${newMedia.length}`,
      });
    }

    product.media.push(...newMedia);
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      data: product,
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// PUT: Update a product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { productName, brandName, categoryName, subCategoryName, description, unit, qty, price } = req.body;

    const updateData = {};
    if (productName !== undefined) updateData.productName = productName;
    if (brandName !== undefined) updateData.brandName = brandName;
    if (categoryName !== undefined) updateData.categoryName = categoryName;
    if (subCategoryName !== undefined) updateData.subCategoryName = subCategoryName;
    if (description !== undefined) updateData.description = description;
    if (unit !== undefined) updateData.unit = unit;
    if (qty !== undefined) updateData.qty = qty;
    if (price !== undefined) updateData.price = price;

    const updatedProduct = await MiniProduct.findByIdAndUpdate(id, updateData, { new: true }).populate(
      'miniUserId',
      'miniId name'
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// DELETE: Delete a product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedProduct = await MiniProduct.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: deletedProduct,
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// PATCH: Update product status
const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'published'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updatedProduct = await MiniProduct.findByIdAndUpdate(id, { status }, { new: true }).populate(
      'miniUserId',
      'miniId name'
    );

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      message: `Product status updated to ${status}`,
      data: updatedProduct,
    });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET: Products visible to a mini user (public + their assigned sphere)
const getMiniUserProducts = async (req, res) => {
  try {
    const { q } = req.query;
    const miniUserId = req.miniUser?._id;

    const filter = {
      status: 'published',
      $or: [
        { miniUserId: null },
        { miniUserId: miniUserId },
      ],
    };

    if (q) {
      filter.productName = new RegExp(q, 'i');
    }

    const products = await MiniProduct.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Error fetching mini user products:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET: Public mini products (no auth required)
const getPublicProducts = async (req, res) => {
  try {
    const { q } = req.query;
    const isAdminRequest = !!req.admin;
    const filter = { miniUserId: null };

    if (!isAdminRequest) {
      filter.status = 'published';
    }

    if (q) {
      filter.productName = new RegExp(q, 'i');
    }

    const products = await MiniProduct.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Error fetching public products:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAdminProducts,
  createProducts,
  uploadProductMedia,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  getMiniUserProducts,
  getPublicProducts,
};
