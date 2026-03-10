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

io.on('connection', (socket) => {
  console.log('玩家连接成功，ID:', socket.id);
  socket.broadcast.emit('someone_joined', { id: socket.id });

  // 监听前端发来的干扰信号
  socket.on('attack_others', () => {
    // 广播给所有人，触发他们的“弹窗”
    io.emit('be_attacked', { msg: '有人发起了全场震动干扰！' });
  });

  socket.on('chat-message', (msg) => {
    console.log('收到消息:', msg); 
    // 关键：必须发回给所有人，前端的 .on('new-message') 才会触发
    io.emit('new-message', msg); 
    });

  socket.on('disconnect', () => {
    console.log('玩家下线');
  });
});

app.use('/api/auth', require('./routers/auth'));
app.use('/api/user', require('./routers/user'));
app.use('/api/badges', require('./routers/badges'));
app.use('/api/life-game', require('./routers/game/lifeGame'));
app.use('/api/precise-word', require('./routers/game/preciseWord'));
app.use('/api/arrow-maze', require('./routers/game/arrowMaze'));
app.use('/api/sheep-game',require('./routers/game/sheepGame'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
