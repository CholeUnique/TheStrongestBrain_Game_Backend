//《你画我猜》游戏逻辑
const { authenticateToken } = require('../auth');
const { recordGameResult } = require('../../utils/gameEngine');

const drawGuessTopics = [
  // 日常物品
  "杯子", "雨伞", "书包", "钥匙", "眼镜", "闹钟", "牙刷", "毛巾", "拖鞋", "梳子", 
  "镜子", "剪刀", "铅笔", "笔记本", "台灯", "筷子", "勺子", "钱包", "充电宝",
  // 动物
  "熊猫", "老虎", "兔子", "小狗", "小猫", "大象", "猴子", "长颈鹿", "斑马", "狮子", 
  "企鹅", "章鱼", "鲸鱼", "海豚", "蝴蝶", "蜜蜂", "小鸟", "蛇", "乌龟", "青蛙",
  // 植物
  "玫瑰", "向日葵", "荷花", "仙人掌", "多肉", "松树", "柳树", "竹子", "苹果", "香蕉", 
  "橙子", "草莓", "西瓜", "胡萝卜", "青菜",
  // 交通工具
  "汽车", "火车", "飞机", "自行车", "电动车", "轮船", "公交车", "地铁", "摩托车", "火箭", 
  "直升机", "小船", "货车", "出租车", "热气球",
  // 食物
  "米饭", "汉堡", "火锅", "冰淇淋", "蛋糕", "披萨", "面条", "面包", "薯条", "炸鸡", 
  "寿司", "烤肉", "奶茶", "可乐", "糖果",
  // 娱乐休闲
  "篮球", "足球", "羽毛球", "吉他", "钢琴", "书籍", "电影票", "拼图", "积木", "风筝",
  // 职业
  "医生", "老师", "警察", "消防员", "护士", "厨师", "画家", "歌手", "司机", "科学家",
  // 自然现象
  "彩虹", "下雨", "下雪", "闪电", "太阳", "月亮", "星星", "云朵",
  // 电子产品
  "手机", "电脑", "电视", "耳机", "相机", "平板", "游戏机",
  // 其他
  "房子", "大树", "桥梁", "路灯", "红绿灯", "帽子", "鞋子", "衣服", "手套",
  // 补充题目
  "滑梯", "秋千", "气球", "蜡烛", "礼物", "信封", "邮票", "望远镜", "放大镜"
];

const rooms = {}; // 存储房间状态: { roomId: { word, painterId, players: {}, winRounds, totalRounds } }
const getRandomTopic = () => {
    return drawGuessTopics[Math.floor(Math.random() * drawGuessTopics.length)];
};
// recordGameResult(userId, gameId, difficulty, isWin, timeSpent, customScore = null, playCount = null, winCount = null)
const saveRoomStats = (roomId, isWin) => {
    const room = rooms[roomId];
    if (!room) return;
    const timeSpent = Math.floor((Date.now() - room.startTime) / 1000);

    // 遍历房间里的每一个 socket 连接
    Object.keys(room.players).forEach(socketId => {
        const player = room.players[socketId];
        
        // 调用你的数据库记录方法
        // 注意：即使是协作，每个人的 winCount 和 playCount 也要同步更新
        recordGameResult(
            player.userId,      // 用户在系统里的真实 ID
            'draw-guess',       // gameId
            1,                  // 本题没有difficulty
            isWin,              // bool: 本轮是否胜利
            timeSpent,          // 总耗时
            isWin ? 1 : 0,      // customScore: 赢了给 1 分，输了 0 分
            room.totalRounds,   // playCount: 总游玩轮数
            room.winRounds      // winCount: 胜利轮数
        );
        
    });
};

module.exports = (io) => {
  io.on('connection', (socket) => {

    // --- 核心：加入房间 ---
    socket.on('join-room', ({ roomId, userId }) => {
      socket.join(roomId);
      
      // 如果房间不存在，初始化房间
      if (!rooms[roomId]) {
        rooms[roomId] = {
          word: drawGuessTopics[Math.floor(Math.random() * drawGuessTopics.length)],
          painterId: socket.id, // 第一个进房间的人默认是画家
          players: {},
          score:0,
          winRounds: 0,
          totalRounds: 1,
          startTime: Date.now(),
          timeSpent:0,
        };
      }
      
      rooms[roomId].players[socket.id] = { userId, role: socket.id === rooms[roomId].painterId ? 'painter' : 'guesser' };

      // 只给当前玩家发送初始化信息（包含他的身份）
      socket.emit('init-game', {
        role: rooms[roomId].players[socket.id].role,
        word: rooms[roomId].players[socket.id].role === 'painter' ? rooms[roomId].word : '???', // 猜题者看不到词
        score:rooms[roomId].score,
        winRounds: rooms[roomId].winRounds,
        totalRounds: rooms[roomId].totalRounds,
        timespent:rooms[roomId].timeSpent
      });

      // 告诉房间里其他人有新队友
      io.to(roomId).emit('player-update', rooms[roomId].players);
    });

    // 轨迹同步
    socket.on('draw-line', (data) => socket.to(data.roomId).emit('draw-line', data));
    socket.on('clear-canvas', () => socket.to(data.roomId).emit('clear-canvas'));

    // 猜题逻辑 (协作模式：一人对，全队赢)
    socket.on('submit-guess', ({ roomId, guess }) => {
        const room = rooms[roomId];
        if (!room || room.players[socket.id].role === 'painter') return; // 画家不能猜
        const timeSpent = Math.floor((Date.now() - rooms[roomId].startTime) / 1000);
        room.totalRounds += 1;
        room.timespent = timeSpent;

        if (guess.trim() === room.word) {
            // 计算当前总耗时（秒）
            room.winRounds += 1;
            room.score += 1;
            saveRoomStats(roomId, true);
            // 轮换身份：把画家的权利交给猜对的人
            room.painterId = socket.id;
            room.word = drawGuessTopics[Math.floor(Math.random() * drawGuessTopics.length)];

            // 更新房间内所有人的身份和新题目
            Object.keys(room.players).forEach(id => {
                const newRole = id === room.painterId ? 'painter' : 'guesser';
                room.players[id].role = newRole;
                io.to(id).emit('next-round', {
                    role: newRole,
                    word: newRole === 'painter' ? room.word : '???',
                    score:room.score,
                    winRounds: room.winRounds,
                    totalRounds: room.totalRounds,
                    timespent:0,//清空时间
                });
            });
        }
        saveRoomStats(roomId, false);
    });

    // 跳过题目 (算作输了一轮)
    socket.on('skip-word', ({ roomId }) => {
        if (!roomId) return;
        roomId.totalRounds += 1; // 输了两人一起不加分，但总轮数加1
        const nextWord = getRandomTopic();
        roomId.word = nextWord;
        
        // 仅向该房间广播跳过信息
        io.to(roomId).emit('round-skip', {
            totalRounds: roomId.totalRounds,
            nextWord: nextWord, // 此时后端会自动处理身份，画家看得到词，猜题者看 ???
            msg: "这题太难了，跳过！"
        });

        // 重点：当“跳过”或“输了”时，分别记录每个房间内玩家的数据
        saveRoomStats(roomId, false);
        
    });

    socket.on('disconnecting', () => {
        // socket.rooms 是一个 Set，包含当前 socket 加入的所有房间
        for (const roomId of socket.rooms) {
            if (rooms[roomId]) {
                console.log(`玩家 ${socket.id} 正在离开房间 ${roomId}`);
                delete rooms[roomId].players[socket.id];
                
                // 如果房间空了，清理内存
                if (Object.keys(rooms[roomId].players).length === 0) {
                    delete rooms[roomId];
                } else {
                    // 如果还有人，通知其他人有人退出
                    io.to(roomId).emit('player-left', { socketId: socket.id });
                }
            }
        }
    });
  
  });
};