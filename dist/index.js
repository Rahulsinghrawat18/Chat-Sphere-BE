"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const crypto_1 = __importDefault(require("crypto"));
const wss = new ws_1.WebSocketServer({ port: 8080 });
const allSockets = [];
const rooms = {};
function generateRoomCode() {
    return crypto_1.default.randomBytes(3).toString("hex");
}
wss.on("connection", (socket) => {
    socket.on("message", (message) => {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.type === "create") {
            const roomCode = generateRoomCode();
            rooms[roomCode] = [];
            socket.send(JSON.stringify({ type: "roomCreated", payload: { roomCode } }));
        }
        if (parsedMessage.type === "join") {
            const roomCode = parsedMessage.payload.roomId;
            const username = parsedMessage.payload.username;
            if (!rooms[roomCode]) {
                rooms[roomCode] = [];
            }
            if (rooms[roomCode].length >= 10) {
                socket.send(JSON.stringify({ type: "error", payload: { message: "Room is full" } }));
                return;
            }
            const user = { socket, room: roomCode, username };
            rooms[roomCode].push(user);
            allSockets.push(user);
            socket.send(JSON.stringify({ type: "joined", payload: { roomCode } }));
            // Notify other users in the room
            rooms[roomCode].forEach((u) => {
                if (u.socket !== socket) {
                    u.socket.send(JSON.stringify({ type: "userJoined", payload: { username } }));
                }
            });
        }
        if (parsedMessage.type === "chat") {
            const user = allSockets.find((x) => x.socket === socket);
            if (user) {
                const room = rooms[user.room];
                room.forEach((u) => {
                    u.socket.send(JSON.stringify({
                        type: "chat",
                        payload: { message: parsedMessage.payload.message, username: user.username },
                    }));
                });
            }
        }
    });
    socket.on("close", () => {
        const userIndex = allSockets.findIndex((x) => x.socket === socket);
        if (userIndex !== -1) {
            const user = allSockets[userIndex];
            allSockets.splice(userIndex, 1);
            const roomUsers = rooms[user.room];
            const roomUserIndex = roomUsers.findIndex((x) => x.socket === socket);
            if (roomUserIndex !== -1) {
                roomUsers.splice(roomUserIndex, 1);
                // Notify other users in the room
                roomUsers.forEach((u) => {
                    u.socket.send(JSON.stringify({ type: "userLeft", payload: { username: user.username } }));
                });
            }
            if (roomUsers.length === 0) {
                delete rooms[user.room];
            }
        }
    });
});
