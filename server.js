
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const users = new Map();

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", (username) => {
        username = String(username || "Guest")
            .trim()
            .slice(0, 20) || "Guest";

        users.set(socket.id, username);

        socket.emit("system", "Welcome to the chatroom!");

        socket.broadcast.emit(
            "system",
            username + " joined the chat."
        );

        io.emit("userCount", users.size);
    });

    socket.on("chatMessage", (text) => {
        const username = users.get(socket.id);

        if (!username || typeof text !== "string") return;

        text = text.trim().slice(0, 500);
        if (!text) return;

        io.emit("chatMessage", {
            username,
            text,
            time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            })
        });
    });

    socket.on("disconnect", () => {
        const username = users.get(socket.id);

        if (username) {
            users.delete(socket.id);
            io.emit("system", username + " left the chat.");
        }

        io.emit("userCount", users.size);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("CHATROOM SERVER IS RUNNING!");
    console.log("Port:", PORT);
});
