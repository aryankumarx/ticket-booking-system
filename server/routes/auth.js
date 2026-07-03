const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const router = express.Router();

function genToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const validRoles = ['customer', 'organiser', 'admin'];
    const user = await User.create({
      name, email, password,
      role: (role && validRoles.includes(role)) ? role : 'customer'
    });

    res.status(201).json({
      _id: user._id, name: user.name, email: user.email,
      role: user.role, token: genToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      _id: user._id, name: user.name, email: user.email,
      role: user.role, token: genToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// get logged in user's profile
router.get('/me', protect, (req, res) => {
  res.json({ _id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role });
});

module.exports = router;
