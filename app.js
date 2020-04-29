const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
require('dotenv').config();

const accountSid = process.env.TWILIO_SSID ;
const authToken = process.env.TWILIO_TOKEN
const twilioTokens = require('twilio')(accountSid, authToken);

twilioTokens.tokens.create().then(obj => {

  let iceServersArray = obj.iceServers

  const app = express();

  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "https://chatapp-front-end.herokuapp.com"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  const server = http.createServer(app);

  const io = socketIo(server);

  const port = process.env.PORT || 4001;

  const router = express.Router();

  //we'll store the users here as their clients make connections
  let users = []

  let messages = []

  //keep a list of the socketIds broadcasting
  let broadcasts = []
  router.get("/", (req, res) => {
    res.send({ response: "I am alive" }).status(200);
  });

  router.get("/clear-messages", (req, res) => {
    messages = []
    console.log("Messages cleared!", messages);
    res.send({response: "messages cleared"}).status(202)
  })

  router.get("/clear-users", (req, res) => {
    users = []
    console.log("Users cleared!", messages);
    res.send({response: "users cleared"}).status(202)
  })

  router.get("/clear-broadcasts", (req, res) => {
    broadcasts = 0
    console.log("Broadcasts cleared!", messages);
    res.send({response: "broadcasts cleared"}).status(202)
  })


  app.use(router);

  io.on("connection", socket => {
    console.log("A new connection has been made!", socket.id);

    socket.emit("connected", iceServersArray, users)
    
    socket.on("callUser", call => {
      io.to(call.socketId).emit('incomingCall', {signal: call.data, from: call.from})
    })

    socket.emit("iceServers", iceServersArray)
    //send the current users to the new connection so that we can see if a user with that username has already been made
    socket.emit("loggedInUsers",  users)

    socket.on("initializeSession", username => {
      //tell the client that it was succesfully registered
      let userObj = {socketId: socket.id, username: username}
      socket.emit("initializedSession", userObj, messages)
      users.push(userObj)
      console.log("userObj", userObj, "user", users, "messages", messages);

      //tell other clients a new user is here
      socket.broadcast.emit("newUserJoin", userObj)
      console.log(`Success! ${userObj.username} has joined!`);
    })


    socket.on("disconnect", () => {

      //emit the logout of the user by sending the id of the disconnected socket

      //perform the inverse of login here, setting socketId to null:
      users = users.filter(user => {
        if(user.socketId === socket.id){
          socket.broadcast.emit("userLogout", user)
          console.log(`${user.username} has disconnected`);
          return false
        } else {
          return true
        }
      })
      broadcasts = broadcasts.filter(broadcast => broadcast !== socket.id)
      console.log("Users still connected:", users);
    });

    socket.on("sentMessage", (message) => {
      console.log("We just got a message!", message)
      let user = users.find(user => user.socketId === socket.id)
      let messageObj = {username: user.username, message}
      messages.push(messageObj)
      io.emit("newMessage", messageObj)
    })

    //all WebRTC peer connection communication:

    socket.on("requestBroadcast", () => {
      console.log("Requesting broadcast");
      if (broadcasts === 4){
        console.log("not approved");
        socket.emit("broadcastRequestResponse", {approved: false})
      } else {
        broadcasts.push(socket.id)
        console.log("approved");
        socket.emit("broadcastRequestResponse", {approved: true})
      }
    })

    socket.on("offer", (watcherSocketId, description) => {
      console.log(watcherSocketId, users);
      console.log(`Offer Received! We're connecting with your peer ${users.find(user => user.socketId === watcherSocketId).username} now`);
      socket.to(watcherSocketId).emit("offer", socket.id, description)
    })

    socket.on("answer", (broadcasterSocketId, description) => {
      console.log("Answer Received! We're telling the broadcaster you're good to go!")
      socket.to(broadcasterSocketId).emit("answer", socket.id, description)
    })

    socket.on("candidate", (id, sender, candidate) => {
      socket.to(id).emit("candidate", socket.id, sender, candidate);
    })

    socket.on("endBroadcast", () => {
      broadcasts = broadcasts.filter(broadcast => broadcast !== socket.id)
      socket.broadcast.emit("broadcastEnded", socket.id)
    })
  })

  server.listen(port, () => console.log(`Listening on port ${port}`));
})
