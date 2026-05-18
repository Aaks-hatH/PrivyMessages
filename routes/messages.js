const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const { encrypt, decrypt } = require('../utils/crypto');

// Get all users (for user list in sidebar)
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.user.id }, isAdmin: false },
      'username _id'
    ).sort('username');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get conversation between current user and another user
router.get('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { from: req.user.id, to: req.params.userId },
        { from: req.params.userId, to: req.user.id }
      ]
    }).sort('createdAt').lean();

    // Decrypt for display
    const decrypted = messages.map(m => ({
      _id: m._id,
      from: m.from,
      to: m.to,
      content: decrypt(m.iv, m.content),
      createdAt: m.createdAt
    }));

    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { to, content } = req.body;
    if (!to || !content || !content.trim()) {
      return res.status(400).json({ error: 'Recipient and content required' });
    }

    const recipient = await User.findById(to);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    const { iv, content: encrypted } = encrypt(content.trim());
    const message = await Message.create({
      from: req.user.id,
      to,
      content: encrypted,
      iv
    });

    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    const recipientSocketId = onlineUsers.get(to);

    const outgoing = {
      _id: message._id,
      from: req.user.id,
      to,
      content: content.trim(),
      createdAt: message.createdAt
    };

    if (recipientSocketId) {
      io.to(recipientSocketId).emit('new_message', outgoing);
    }

    res.json(outgoing);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
