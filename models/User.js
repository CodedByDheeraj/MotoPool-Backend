const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  password: String,
  age: Number,
  gender: String,
  phone: String,
  profilePhoto: {
    type: String,
    default: ""
  },
  rating: {
    type: Number,
    default: 5
  }
});

module.exports = mongoose.model("User", userSchema);