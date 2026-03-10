// 游戏徽章展馆路由

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('./auth');

const SYSTEM_BADGES = [
  { id: 'b1', icon: '🌱', name: '脑力萌新', desc: '初入脑力宇宙的证明' },
  { id: 'b2', icon: '🔥', name: '连胜狂魔', desc: '在推演中连续获得胜利' },
  { id: 'b3', icon: '🧊', name: '绝对冷静', desc: '成功破解困难难度的盘面' },
  { id: 'b4', icon: '👑', name: '推演之王', desc: '累计脑力积分突破 1000 分' },
  { id: 'b5', icon: '⚡', name: '闪电突击', desc: '在30秒内完成中等难度推演' },
  { id: 'b6', icon: '👁️', name: '空间之眼', desc: '一次性点对所有细胞，无一错漏' },
  { id: 'b7', icon: '🌌', name: '宇宙主宰', desc: '解锁所有基础徽章' },
  { id: 'b8', icon: '🕰️', name: '时间领主', desc: '累计在线训练时长突破 100 小时' },
  { id: 'b9', icon: '🤯', name: '最弱大脑', desc: '连续失败100次' }
];

router.get('/pavilion', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  db.get(`SELECT badges, unlocked_badges FROM users WHERE id = ?`, [userId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: '找不到用户' });
    res.json({
      all_badges: SYSTEM_BADGES, equipped: JSON.parse(row.badges || '["🌱"]'), unlocked: JSON.parse(row.unlocked_badges || '["🌱"]')
    });
  });
});

router.post('/equip', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { equippedBadges } = req.body;
  if (!Array.isArray(equippedBadges) || equippedBadges.length < 1 || equippedBadges.length > 3) {
    return res.status(400).json({ error: '必须选择 1 到 3 个徽章进行展示' });
  }
  db.run(`UPDATE users SET badges = ? WHERE id = ?`, [JSON.stringify(equippedBadges), userId], function(err) {
    if (err) return res.status(500).json({ error: '保存徽章失败' });
    res.json({ message: '徽章佩戴成功！' });
  });
});

module.exports = router;