const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  pickup: String,
  drop: String,
  date: String,
  time: String,
  price: String

});

module.exports = mongoose.model("Ride", rideSchema);