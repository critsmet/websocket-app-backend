const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const port = process.env.PORT || 4001;
const index = require("./routes/index");

const app = express();
app.use(index);

const server = http.createServer(app);

const io = socketIo(server);

//we'll store the users here as their clients make connections
let users = []

//we don't want the socketIds going to the users, so we'll just map and get the names
let usernames = (name) => users.map(user => user.username)

io.on("connection", socket => {
  console.log("New client connected", socket.id)

  socket.on("login", user => {

    //using io.emit submits to all subscribed clients, whereas socket.emit just sends to the original sender of "login"
    socket.broadcast.emit("newUser", user)

    //we'll emit this before we push the new user to the list of users so they are not included
    socket.emit("alreadyConnected", usernames(user))

    //We'll store the socketId to be able to reference a hard refresh/window close disconnect
    users.push({username: user, socketId: socket.id})

    console.log(users)
  })

  socket.on("disconnect", () => {
    //find the user based on their socket id
    let user = users.find(user => user.socketId === socket.id)

    //filter them out of the users array
    users = users.filter(user => user !== user)

    //emit the logout of the user
    socket.broadcast.emit("userLogout", user.username)
    console.log(`${user.username} has disconnected, current users:`, users);
  });


});

server.listen(port, () => console.log(`Listening on port ${port}`));
