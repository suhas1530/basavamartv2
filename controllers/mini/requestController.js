const MiniRequest = require('../../models/mini/MiniRequest');

// POST: Submit public request(s)
const submitRequests = async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ success: false, message: 'Requests array is required' });
    }

    const createdRequests = [];

    for (const request of requests) {
      const { productName, note, description, qty, name, phone } = request;

      if (!productName || !name || !phone) {
        return res.status(400).json({
          success: false,
          message: 'productName, name, and phone are required for each request',
        });
      }

      const newRequest = await MiniRequest.create({
        productName: productName.trim(),
        note: note || '',
        description: description || '',
        qty: qty || 1,
        name: name.trim(),
        phone: phone.trim(),
        status: 'new',
        media: [],
      });

      createdRequests.push(newRequest);
    }

    res.status(201).json({
      success: true,
      message: `${createdRequests.length} request(s) submitted successfully`,
      data: createdRequests,
    });
  } catch (error) {
    console.error('Error submitting requests:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET: All requests (admin only)
const getAllRequests = async (req, res) => {
  try {
    const { status, q } = req.query;
    let filter = {};

    if (status) {
      filter.status = status;
    }

    if (q) {
      filter.$or = [
        { productName: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
      ];
    }

    const requests = await MiniRequest.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// PATCH: Update request status (admin only)
const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['new', 'reviewed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updatedRequest = await MiniRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.status(200).json({
      success: true,
      message: `Request status updated to ${status}`,
      data: updatedRequest,
    });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  submitRequests,
  getAllRequests,
  updateRequestStatus,
};
