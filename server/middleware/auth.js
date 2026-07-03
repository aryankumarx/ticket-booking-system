const jwt = require('jsonwebtoken');
const User = require('../models/User');

// middleware to check if user is logged in
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) return res.status(401).json({ message: 'User not found' });
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Token is invalid or expired' });
    }
  }
  if (!token) {
    return res.status(401).json({ message: 'Please login first' });
  }
};

// check if user has the right role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You dont have permission for this' });
    }
    next();
  };
};

module.exports = { protect, requireRole };
