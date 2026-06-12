const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
    rideId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ride",
        required: true
    },

    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    lastMessage: {
        type: String,
        default: ""
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports =
mongoose.model("Conversation", conversationSchema);