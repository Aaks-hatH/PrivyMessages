const router = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');
const { decrypt } = require('../utils/crypto');

// Get all users
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, 'username isAdmin createdAt').sort('-createdAt').lean();

    // Add message counts
    const withCounts = await Promise.all(users.map(async (u) => {
      const sent = await Message.countDocuments({ from: u._id });
      const received = await Message.countDocuments({ to: u._id });
      return { ...u, messagesSent: sent, messagesReceived: received };
    }));

    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all messages (decrypted)
router.get('/messages', adminMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({})
      .populate('from', 'username')
      .populate('to', 'username')
      .sort('-createdAt')
      .lean();

    const decrypted = messages.map(m => ({
      _id: m._id,
      from: m.from?.username || 'deleted',
      to: m.to?.username || 'deleted',
      content: decrypt(m.iv, m.content),
      createdAt: m.createdAt
    }));

    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a user
router.delete('/users/:id', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isAdmin) return res.status(400).json({ error: 'Cannot delete admin' });
    await User.deleteOne({ _id: req.params.id });
    await Message.deleteMany({ $or: [{ from: req.params.id }, { to: req.params.id }] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a message
router.delete('/messages/:id', adminMiddleware, async (req, res) => {
  try {
    await Message.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
