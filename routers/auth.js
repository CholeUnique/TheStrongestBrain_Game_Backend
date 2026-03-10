// 权限认证Token及路由

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');// 身份令牌
const JWT_SECRET = 'strongest_brain_secret_key_2026';
const db = require('../db');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未授权，请先登录' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token已失效' });
    req.user = user; 
    next();
  });
};

router.post('/register', async (req, res) => {
  const { nickname, password } = req.body;
  if (!nickname || !password) return res.status(400).json({ error: '昵称和密码不能为空' });

  const systemId = 'ID-' + Math.floor(1000 + Math.random() * 9000);
  const hashedPassword = await bcrypt.hash(password, 10);
  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${systemId}`;
  const defaultRadar = JSON.stringify([50, 50, 50, 50, 50]);
  const defaultBadges = JSON.stringify(['🌱']); 

  const stmt = db.prepare(`INSERT INTO users (system_id, nickname, password, avatar, bio, badges, radar_stats) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(systemId, nickname, hashedPassword, defaultAvatar, '萌新挑战者，正在开发大脑潜能！', defaultBadges, defaultRadar, function(err) {
    if (err) return res.status(500).json({ error: '注册失败，可能昵称已存在' });
    const newUserId = this.lastID;
    db.run(`INSERT INTO user_stats (user_id) VALUES (?)`, [newUserId], function(err2) {
        if(err2) return res.status(500).json({ error: '初始化大脑档案失败' });
        const token = jwt.sign({ userId: newUserId }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ message: '注册成功', token, systemId });
    });
  });
  stmt.finalize();
});

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

module.exports = Object.assign(router, {
  authenticateToken,
  JWT_SECRET
});