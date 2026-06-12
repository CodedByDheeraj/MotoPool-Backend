require("dotenv").config();

const PORT = process.env.PORT || 3000;

const http = require("http");
const { Server } = require("socket.io");

const Conversation =
require("./models/Conversation");

const Message =
require("./models/Message");

const Ride = require("./models/Ride");

const JoinRide = require("./models/JoinRide");

const User = require("./models/User");

const express = require("express");

const cors = require("cors");

const mongoose = require("mongoose");

const app = express();

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch((err) => console.log("Mongo Error:", err));

app.use(cors());

app.use(express.json());


function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


// Add Ride

app.post("/offer-ride", async (req, res) => {

  await Ride.create(req.body);

  res.json({
    message: "Ride Added Successfully 🚀"
  });

});

app.get("/rides", async (req, res) => {

  const filter = {};
  const currentUserId = req.query.userId;

  if (typeof req.query.pickup === "string" && req.query.pickup.trim()) {
    filter.pickup = {
      $regex: escapeRegExp(req.query.pickup.trim()),
      $options: "i"
    };
  }

  if (typeof req.query.drop === "string" && req.query.drop.trim()) {
    filter.drop = {
      $regex: escapeRegExp(req.query.drop.trim()),
      $options: "i"
    };
  }

  // Exclude user's own rides
  if (currentUserId) {
    filter.userId = { $ne: currentUserId };
  }

  const rides = await Ride.find(filter).populate("userId", "name profilePhoto age rating").sort({
    date: 1,
    time: 1
  });

  const ridesWithJoinCount = await Promise.all(
    rides.map(async (ride) => {

      const joinedCount = await JoinRide.countDocuments({
        rideId: ride._id
      });

      return {
        ...ride.toObject(),
        joinedCount
      };

    })
  );

  res.json(ridesWithJoinCount);

});

// Join Ride

app.post("/join-ride", async (req, res) => {

  try {

    const { rideId, userId } = req.body;

    if (!rideId || !userId) {
      return res.status(400).json({
        message: "Ride and user are required"
      });
    }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({
        message: "Ride not found"
      });
    }

    if (ride.userId && ride.userId.toString() === userId) {
      return res.status(400).json({
        message: "You cannot join your own ride"
      });
    }

    const alreadyJoined = await JoinRide.findOne({
      rideId,
      userId
    });

    if (alreadyJoined) {
      return res.status(400).json({
        message: "You already joined this ride"
      });
    }

    const joinedCount = await JoinRide.countDocuments({
      rideId
    });

    if (joinedCount >= 1) {
      return res.status(400).json({
        message: "This ride is already full"
      });
    }

    const joinedRide = await JoinRide.create({
      rideId,
      userId
    });

const existingConversation =
await Conversation.findOne({
    rideId: ride._id
});

if (!existingConversation) {

    await Conversation.create({

        rideId: ride._id,

        participants: [
            ride.userId,
            userId
        ]

    });
}

const conversation =
await Conversation.findOne({
    rideId: ride._id
});

res.json({
    message: "Ride joined successfully",
    joinedRide,
    conversation
});

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

// Get Rides

app.get("/my-rides/:userId", async (req, res) => {

  const rides = await Ride.find({
    userId: req.params.userId
  }).sort({
    date: 1,
    time: 1
  });

  const ridesWithJoinCount = await Promise.all(
    rides.map(async (ride) => {

      const joinedCount = await JoinRide.countDocuments({
        rideId: ride._id
      });

      return {
        ...ride.toObject(),
        joinedCount
      };

    })
  );

  res.json(ridesWithJoinCount);

});

// Get All User Rides (both offered and joined)
app.get("/my-all-rides/:userId", async (req, res) => {

  const userId = req.params.userId;

  // Get rides offered by user
  const offeredRides = await Ride.find({
    userId: userId
  }).populate("userId", "name profilePhoto").sort({
    date: 1,
    time: 1
  });

  const offeredRidesWithJoinCount = await Promise.all(
    offeredRides.map(async (ride) => {
      const joinedCount = await JoinRide.countDocuments({
        rideId: ride._id
      });

      // Get the pillion user who joined this ride
      const joinedUser = await JoinRide.findOne({
        rideId: ride._id
      }).populate("userId", "name profilePhoto");

      return {
        ...ride.toObject(),
        joinedCount,
        rideType: "offered",
        joiningUser: joinedUser ? joinedUser.userId : null
      };
    })
  );

  // Get rides joined by user
  const joinedRideRecords = await JoinRide.find({
    userId: userId
  }).populate("rideId").sort({
    createdAt: -1
  });

  const joinedRides = await Promise.all(
    joinedRideRecords.map(async (record) => {
      if (!record.rideId) return null;
      
      // Get the ride poster (rider) info
      const rideWithRider = await Ride.findById(record.rideId._id).populate("userId", "name profilePhoto");
      
      const joinedCount = await JoinRide.countDocuments({
        rideId: record.rideId._id
      });

      return {
        ...rideWithRider.toObject(),
        joinedCount,
        rideType: "joined"
      };
    })
  );

  const filteredJoinedRides = joinedRides.filter(ride => ride !== null);

  res.json({
    offered: offeredRidesWithJoinCount,
    joined: filteredJoinedRides
  });

});

const server =
http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

io.on("connection", (socket) => {

    // JOIN CHAT ROOM
    socket.on("joinConversation", (conversationId) => {

        socket.join(conversationId);

    });

    // SEND MESSAGE
    socket.on("sendMessage", async (data) => {
        try {

            const {
                conversationId,
                sender,
                text
            } = data;

            // SAVE MESSAGE IN DATABASE
            const newMessage =
            await Message.create({
                conversationId,
                sender,
                text
            });

            // UPDATE LAST MESSAGE
            await Conversation.findByIdAndUpdate(
                conversationId,
                {
                    lastMessage: text,
                    updatedAt: new Date()
                }
            );

            // SEND TO ALL USERS IN ROOM
            io.to(conversationId).emit(
                "newMessage",
                newMessage
            );

        } catch (err) {

            console.log(err);

        }
    });

    socket.on("disconnect", () => {
    });

});

// Get Single Ride

app.get("/ride/:id", async (req, res) => {

    try {

        const ride = await Ride.findById(req.params.id);

        if (!ride) {

            return res.status(404).json({
                message: "Ride not found"
            });

        }

        res.json(ride);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

});

// Delete Ride Route 

app.delete("/ride/:id", async (req,res)=>{

  await Ride.findByIdAndDelete(
    req.params.id
  );

  res.json({
    message: "Ride Deleted"
  });

});

// Cancel Ride (Remove from JoinRide)

app.delete("/cancel-ride", async (req, res) => {

  try {

    const { rideId, userId } = req.body;

    if (!rideId || !userId) {
      return res.status(400).json({
        message: "Ride and user are required"
      });
    }

    const result = await JoinRide.findOneAndDelete({
      rideId,
      userId
    });

    if (!result) {
      return res.status(404).json({
        message: "Join record not found"
      });
    }

    res.json({
      message: "Ride cancelled successfully"
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

// Signup Route

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

app.post("/signup", async (req, res) => {

  try {

    const { name, email, password, age, gender, phone, profilePhoto } = req.body;

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      age: parseInt(age) || null,
      gender: gender || "",
      phone: phone || "",
      profilePhoto: profilePhoto || "",
      rating: 5
    });

    res.json({
      message: "User Created",
      user
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

//Login Route

app.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "User not found"
      });
    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isMatch) {
      return res.status(400).json({
        message: "Wrong Password"
      });
    }

    const token = jwt.sign(
      {
        userId: user._id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      message: "Login Successful",
      token,
      user
    });

  } catch (error) {

    res.status(500).json({
      message: error.message
    });

  }

});

app.get("/messages/:conversationId", async (req, res) => {

    try {

        const messages = await Message.find({
            conversationId: req.params.conversationId
        }).sort({ createdAt: 1 });

        res.json(messages);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
});

app.get("/conversation-by-ride/:rideId", async (req, res) => {

    try {

        const conversation =
        await Conversation
        .findOne({
            rideId: req.params.rideId
        }).populate(
          "participants",
           "name profilePhoto"
          );

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found"
            });
        }

        res.json(conversation);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
