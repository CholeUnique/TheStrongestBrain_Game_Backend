const express = require('express');
const cors = require('cors');
const app = express();
const { Server } = require('socket.io');
const server = require('http').createServer(app);

// 开启 CORS，允许咱们运行在 5173 端口的 React 前端来访问
app.use(cors({
    origin: true,
    credentials:true
}));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*", // 允许你的局域网 IP 访问
    methods: ["GET", "POST"]
  }
});

const drawGuessRouter = require('./routers/game/drawGuess');
drawGuessRouter(io);

app.use('/api/auth', require('./routers/auth'));
app.use('/api/user', require('./routers/user'));
app.use('/api/badges', require('./routers/badges'));
app.use('/api/life-game', require('./routers/game/lifeGame'));
app.use('/api/precise-word', require('./routers/game/preciseWord'));
app.use('/api/arrow-maze', require('./routers/game/arrowMaze'));
app.use('/api/sheep-game',require('./routers/game/sheepGame'));
app.use('/api/draw-guess',require('./routers/game/drawGuess'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
