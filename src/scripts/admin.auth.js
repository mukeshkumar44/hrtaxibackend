// src/scripts/admin.auth.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User.js");
require('dotenv').config();
require('dotenv').config({ path: __dirname + '/../../.env' });



const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected");

    // Check if admin already exists
    const existingUser = await User.findOne({ role: "admin" });
    if (existingUser) {
      console.log("⚠️ Admin already exists");
      return process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("Ram@123", 10);

    // Create admin
    const admin = new User({
      name: "Admin",
      email: "mdverma@gmail.com",
      password: hashedPassword,
      role: "admin",
      isVerified: true,
    });

    await admin.save();
    console.log("🎉 Admin created successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating admin:", err.message);
    
    process.exit(1);
  }
};

createAdmin();
