const mongoose = require("mongoose");

const joinRideSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

joinRideSchema.index(
  {
    rideId: 1,
    userId: 1
  },
  {
    unique: true
  }
);

module.exports = mongoose.model("JoinRide", joinRideSchema);
