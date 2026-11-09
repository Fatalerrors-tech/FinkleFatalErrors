socket.on("chatMessage", (text) => {
    const username = users.get(socket.id);

    if (!username || typeof text !== "string") return;

    text = text.trim().slice(0, 500);

    if (!text) return;

    io.emit("chatMessage", {
        username: username,
        text: text,
        time: new Date().toLocaleTimeString()
    });
});
