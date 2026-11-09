
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new Database("accounts.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password TEXT NOT NULL
    )
`);

app.use(express.json({ limit: "10kb" }));

const sessionMiddleware = session({
    store: new SQLiteStore({
        db: "sessions.sqlite",
        dir: "."
    }),
    secret: process.env.SESSION_SECRET || "CHANGE-THIS-SECRET",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
});

app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "public")));

io.engine.use(sessionMiddleware);

// CREATE ACCOUNT
app.post("/api/register", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.status(400).json({
                error: "Username must be 3-20 characters (letters, numbers or underscores)."
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                error: "Password must be between 8 and 72 characters."
            });
        }

        const existing = db.prepare(
            "SELECT id FROM users WHERE username = ?"
        ).get(username);

        if (existing) {
            return res.status(409).json({
                error: "That username is already taken."
            });
        }

        const hash = await bcrypt.hash(password, 12);

        const result = db.prepare(
            "INSERT INTO users (username, password) VALUES (?, ?)"
        ).run(username, hash);

        req.session.userId = result.lastInsertRowid;
        req.session.username = username;

        req.session.save(err => {
            if (err) return res.status(500).json({ error: "Session error." });

            res.json({ success: true, username });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not create account." });
    }
});

// LOG IN
app.post("/api/login", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");

        const user = db.prepare(
            "SELECT * FROM users WHERE username = ?"
        ).get(username);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                error: "Incorrect username or password."
            });
        }

        req.session.regenerate(err => {
            if (err) return res.status(500).json({ error: "Session error." });

            req.session.userId = user.id;
            req.session.username = user.username;

            req.session.save(err => {
                if (err) return res.status(500).json({ error: "Session error." });

                res.json({
                    success: true,
                    username: user.username
                });
            });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed." });
    }
});

// CHECK CURRENT LOGIN
app.get("/api/me", (req, res) => {
    if (!req.session.userId) {
        return res.json({ loggedIn: false });
    }

    res.json({
        loggedIn: true,
        username: req.session.username
    });
});

// LOG OUT
app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ success: true });
    });
});

// CHATROOM
io.on("connection", socket => {
    const username = socket.request.session.username;

    if (!socket.request.session.userId || !username) {
        socket.disconnect(true);
        return;
    }

    socket.on("chatMessage", text => {
        if (typeof text !== "string") return;

        text = text.trim().slice(0, 500);
        if (!text) return;

        io.emit("chatMessage", {
            username,
            text,
            time: new Date().toLocaleTimeString()
        });
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Chatroom running on port ${PORT}`);
});
