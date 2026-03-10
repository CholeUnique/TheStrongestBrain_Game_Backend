// 用户信息路由

const express = require('express');
const router = express.Router();
const moment = require('moment');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken } = require('./auth');

router.get('/profile', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const query = `
    SELECT u.*, s.sum_time_spent, s.month_time_spent, s.day_time_spent, 
           s.single_time_spent, s.sum_num_of_game, s.win_num_of_game, s.win_rate
    FROM users u LEFT JOIN user_stats s ON u.id = s.user_id WHERE u.id = ?
  `;

  db.get(query, [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: '用户不存在' });

    const dayTimeDict = JSON.parse(user.day_time_spent || '{}');
    const monthTimeDict = JSON.parse(user.month_time_spent || '{}');
    const currentWeek = moment().format('YYYY-[W]ww'); 
    const lastWeek = moment().subtract(1, 'weeks').format('YYYY-[W]ww'); 

    const currentWeekTime = monthTimeDict[currentWeek] || 0;
    const lastWeekTime = monthTimeDict[lastWeek] || 0;

    let weekTrend = 0;
    if (lastWeekTime === 0 && currentWeekTime > 0) weekTrend = 100; 
    else if(lastWeekTime === 0 && currentWeekTime === 0) weekTrend = 0; 
    else if (lastWeekTime > 0) weekTrend = (((currentWeekTime - lastWeekTime) / lastWeekTime) * 100).toFixed(1);

    const heatmapData = [];
    for(let i = 139; i >= 0; i--) {
      const dailyTime = dayTimeDict[moment().subtract(i, 'days').format('YYYY-MM-DD')] || 0; 
      let level = 0;
      if (dailyTime > 0) level = 1;     
      if (dailyTime > 300) level = 2;   
      if (dailyTime > 900) level = 3;   
      if (dailyTime > 1800) level = 4;  
      heatmapData.push(level);
    }

    res.json({
      ...user, badges: JSON.parse(user.badges || '[]'), radar_stats: JSON.parse(user.radar_stats || '{}'),
      stats: {
        total_games: user.sum_num_of_game || 0,
        win_rate: user.sum_num_of_game > 0 ? ((user.win_rate) * 100).toFixed(1) : 0,
        total_time_hours: ((user.sum_time_spent || 0) / 3600).toFixed(1), 
        today_time_minutes: Math.floor((user.single_time_spent || 0) / 60), 
        week_time_minutes: Math.floor(currentWeekTime / 60), 
        week_trend: weekTrend, heatmap: heatmapData
      }
    });
  });
});

router.put('/update', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { nickname, avatar, bio, gender, birthday, newPassword } = req.body;
  let query = `UPDATE users SET nickname = ?, avatar = ?, bio = ?, gender = ?, birthday = ?`;
  let params = [nickname, avatar, bio, gender, birthday];

  if (newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    query += `, password = ?`;
    params.push(hashedPassword);
  }
  query += ` WHERE id = ?`;
  params.push(userId);

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: '更新失败' });
    res.json({ message: '个人资料更新成功！' });
  });
});

router.post('/register', async (req, res) => {
  const { nickname, password } = req.body;
  if (!nickname || !password) return res.status(400).json({ error: '昵称和密码不能为空' });

  // 生成随机 system_id (如 ID-8492)
  const systemId = 'ID-' + Math.floor(1000 + Math.random() * 9000);
  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10);
  // 默认初始数据
  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${systemId}`;
  const defaultRadar = JSON.stringify([50, 50, 50, 50, 50]);
  const defaultBadges = JSON.stringify(['🌱']); // 新手徽章

  const stmt = db.prepare(`INSERT INTO users (system_id, nickname, password, avatar, bio, badges, radar_stats) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(systemId, nickname, hashedPassword, defaultAvatar, '萌新挑战者，正在开发大脑潜能！', defaultBadges, defaultRadar, function(err) {
    if (err) return res.status(500).json({ error: '注册失败，可能昵称已存在' });

    const newUserId=this.lastID;
    db.run(`INSERT INTO user_stats (user_id) VALUES (?)`,
        [newUserId],
        function(err2){
            if(err2){
                console.error('初始化统计数据失败:', err2.message);
                return res.status(500).json({ error: '初始化大脑档案失败' });
            }
            const token=jwt.sign({ userId: newUserId }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ message: '注册成功', token, systemId });
        }
    );
  });
  stmt.finalize();
});

// 登录接口
router.post('/login', (req, res) => {
  const { system_id, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE system_id = ?`, [system_id], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: '该系统ID不存在' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: '密码错误' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '登录成功', token });
  });
});

module.exports = router;