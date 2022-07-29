const express = require("express");
const app = express();
const httpServer = require("http").Server(app);
const io = require("socket.io")(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://word-royale-frontend.herokuapp.com",
    ],
  },
  transports: ["websocket", "polling", "flashsocket"],
});
const fs = require("fs");
const answers = fs
  .readFileSync("./wordle-answers-alphabetical.txt", "utf8")
  .split("\n");
const PORT = process.env.PORT || 8080;
const router = express.Router();

router.get("/", (req, res) => {
  res.send({ response: "I am alive" }).status(200);
});

let queue = [];
//create a random id for the room
function createRoomId() {
  let id = "";
  let possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 5; i++) {
    id += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return id;
}
let room = createRoomId();
let answer = answers[Math.floor(Math.random() * answers.length)];
//start a connection
io.on("connection", (socket) => {
  console.log("a user connected");

  //listen for a guess
  socket.on("guess", (guess, room) => {
    //send guess to all clients
    socket.to(room).emit("guess", socket.id, guess);
    if (guess.join("") === "OOOOO") {
      socket.to(room).emit("winner", socket.id);
    }
  });

  let timeout;

  //listen for players joining
  socket.on("join", (join) => {
    //leave all rooms before joining
    socket.leaveAll();
    //join the room
    socket.join(room);
    //send the room id to the client
    socket.emit("join", room, answer);
    //send the queue to the client
    socket.emit("players", queue);
    console.log(queue);
    //create a player object
    let player = {
      id: socket.id,
      name: join.name,
      guesses: [],
      room: room,
      status: "playing",
    };
    //add player to playerList
    queue.push(player);
    socket.to(room).emit("players", queue);
    //if room is full, start the game
    const startGame = () => {
      io.emit("start", queue);
      queue = [];
      room = createRoomId();
      answer = answers[Math.floor(Math.random() * answers.length)];
    };
    if (queue.length === 3) {
      //start game
      clearTimeout(timeout);
      startGame();
    } else timeout = setTimeout(startGame, 40000);
    console.log(answer);
  });

  socket.on("restart", () => {
    socket.rooms.forEach((room) => {
      socket.leave(room);
    });
  });

  socket.on("disconnecting", () => {
    //remove player from queue
    let index = queue.findIndex((player) => player.id === socket.id);
    if (index !== -1) {
      queue.splice(index, 1);
      socket.to(room).emit("players", queue);
    }
    //if player is in room, emit that he left
    console.log(socket.rooms);
    if (socket.rooms.size > 0) {
      console.log("player left");
      socket.rooms.forEach((room) => {
        socket.to(room).emit("left", socket.id);
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

//start listening
httpServer.listen(PORT, () => {
  console.log(`listening at ${PORT}`);
});
