const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // [GitFixAI] Removed debug log
  } catch (err) {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
