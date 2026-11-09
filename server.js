
let isRegistering = false;
let socket = null;
let currentUsername = "";

const authScreen = document.getElementById("authScreen");
const chatScreen = document.getElementById("chatScreen");
const authForm = document.getElementById("authForm");
const authError = document.getElementById("authError");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const switchButton = document.getElementById("switchButton");
const submitButton = document.getElementById("submitButton");
const sendButton = document.getElementById("sendButton");
const messageInput = document.getElementById("messageInput");
const connectionStatus = document.getElementById("connectionStatus");

// SWITCH LOGIN / REGISTER
switchButton.addEventListener("click", () => {
    isRegistering = !isRegistering;

    document.getElementById("authSubtitle").textContent =
        isRegistering
            ? "Create an account to join the chatroom."
            : "Log in to enter the chatroom.";

    submitButton.textContent =
        isRegistering ? "Create Account" : "Log In";

    switchButton.textContent =
        isRegistering
            ? "Already have an account? Log In"
            : "Create Account";

    passwordInput.autocomplete =
        isRegistering ? "new-password" : "current-password";

    authError.textContent = "";
});

// LOGIN / REGISTER
authForm.addEventListener("submit", async event => {
    event.preventDefault();

    authError.textContent = "";
    submitButton.disabled = true;

    try {
        const response = await fetch(
            isRegistering ? "/api/register" : "/api/login",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: usernameInput.value.trim(),
                    password: passwordInput.value
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Login failed.");
        }

        passwordInput.value = "";
        showChat(data.username);

    } catch (error) {
        authError.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});

// SHOW CHAT
function showChat(username) {
    currentUsername = username;

    authScreen.style.display = "none";
    chatScreen.style.display = "flex";

    document.getElementById("currentUser").textContent = username;

    connectChat();
}

// CONNECT TO SERVER
function connectChat() {
    if (socket) {
        socket.disconnect();
    }

    if (typeof io !== "function") {
        connectionStatus.textContent =
            "🔴 Socket.IO failed to load. Check the server.";
        return;
    }

    connectionStatus.textContent = "Connecting...";
    socket = io();

    socket.on("connect", () => {
        connectionStatus.textContent = "🟢 Connected";
    });

    socket.on("disconnect", () => {
        connectionStatus.textContent = "🔴 Disconnected";
    });

    socket.on("connect_error", error => {
        connectionStatus.textContent =
            "🔴 Connection failed: " + error.message;
    });

    socket.on("chatMessage", data => {
        displayMessage(data);
    });
}

// DISPLAY MESSAGE
function displayMessage(data) {
    const messages = document.getElementById("messages");

    const message = document.createElement("div");

    message.className =
        "message" +
        (data.username === currentUsername ? " mine" : "");

    const user = document.createElement("div");
    user.className = "username";
    user.textContent = data.username;

    const content = document.createElement("div");
    content.textContent = data.text;

    const time = document.createElement("div");
    time.className = "timestamp";
    time.textContent = data.time || "";

    message.append(user, content, time);
    messages.appendChild(message);

    messages.scrollTop = messages.scrollHeight;
}

// SEND MESSAGE
function sendMessage() {
    const text = messageInput.value.trim();

    if (!text) return;

    if (!socket || !socket.connected) {
        connectionStatus.textContent =
            "🔴 Not connected. Your message was not sent.";
        return;
    }

    socket.emit("chatMessage", text);

    messageInput.value = "";
    messageInput.focus();
}

sendButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

// LOG OUT
document.getElementById("logoutButton").addEventListener("click", async () => {
    if (socket) socket.disconnect();

    try {
        await fetch("/api/logout", {
            method: "POST"
        });
    } catch (error) {
        console.error("Logout request failed.");
    }

    chatScreen.style.display = "none";
    authScreen.style.display = "block";

    usernameInput.value = "";
    passwordInput.value = "";
    authError.textContent = "";
});

// RESTORE LOGIN
async function checkLogin() {
    try {
        const response = await fetch("/api/me");
        const data = await response.json();

        if (data.loggedIn) {
            showChat(data.username);
        }
    } catch (error) {
        authError.textContent =
            "Could not connect to the server.";
    }
}

checkLogin();
