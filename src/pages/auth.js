'use strict';

/** 登录 / 注册 / 验证码 / 退出 —— 对应 login.php、register.php、captcha.php、logout.php、admin_logout.php */

const express = require('express');
const db = require('../db');
const H = require('../helpers');

const router = express.Router();

/* ---------------------------------- 验证码 ---------------------------------- */
/** 原 captcha.php 用 GD 画图；这里改为等价的内联 SVG，无需额外依赖 */
function captchaSvg(code) {
  const colors = ['#0066aa', '#0a7d3c', '#b02a2a', '#7a4bbf', '#c26a00'];
  let noise = '';
  for (let i = 0; i < 4; i++) {
    const x1 = Math.floor(Math.random() * 70);
    const y1 = Math.floor(Math.random() * 32);
    const x2 = Math.floor(Math.random() * 70);
    const y2 = Math.floor(Math.random() * 32);
    noise += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(120,120,120,0.45)" stroke-width="1"/>`;
  }
  let dots = '';
  for (let i = 0; i < 22; i++) {
    dots += `<circle cx="${Math.floor(Math.random() * 70)}" cy="${Math.floor(
      Math.random() * 32
    )}" r="0.8" fill="rgba(0,0,0,0.25)"/>`;
  }
  let text = '';
  code.split('').forEach((ch, i) => {
    const x = 10 + i * 15;
    const y = 23 + Math.floor(Math.random() * 4) - 2;
    const rot = Math.floor(Math.random() * 24) - 12;
    text += `<text x="${x}" y="${y}" font-family="Verdana,Arial,sans-serif" font-size="21" font-weight="bold" fill="${
      colors[i % colors.length]
    }" transform="rotate(${rot} ${x} ${y})">${ch}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="32" viewBox="0 0 70 32"><rect width="70" height="32" fill="#ffffff"/>${noise}${dots}${text}</svg>`;
}

router.get('/captcha.php', (req, res) => {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  req.session.captcha = code;
  res.set('Content-Type', 'image/svg+xml; charset=utf-8');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(captchaSvg(code));
});

/* ----------------------------------- 登录 ----------------------------------- */
const LOGIN_CSS = `
        *{margin:0;padding:0;box-sizing:border-box;font-family:微软雅黑;}
        body{background:#f5f5f5;padding:50px;}
        .box{max-width:420px;margin:0 auto;background:white;padding:30px;border-radius:8px;box-shadow:0 0 10px #ccc;}
        h2{text-align:center;color:#2d6a4f;margin-bottom:20px;}
        input{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:4px;}
        .code-box{display:flex;align-items:center;gap:10px;}
        .code-box input{flex:1;}
        .code-box img{height:36px;cursor:pointer;border-radius:4px;}
        button{width:100%;padding:10px;background:#2d6a4f;color:white;border:none;border-radius:4px;cursor:pointer;margin-top:5px;}
        .tips{color:red;text-align:center;margin:5px 0;}
        .link{text-align:center;margin-top:15px;}
        .remember{display:flex;align-items:center;gap:6px;margin:8px 0 0 4px;width:auto;}
        .remember input{width:auto;margin:0;}
`;

function loginPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>钓鱼乐园 - 登录</title>
    <style>${LOGIN_CSS}    </style>
</head>
<body>
<div class="box">
    <h2>钓鱼乐园 - 登录</h2>

    <form method="post">
        <input type="text" name="username" placeholder="请输入用户名" required>
        <input type="password" name="password" placeholder="请输入密码" required>
        
        <div class="code-box">
            <input type="text" name="captcha" placeholder="请输入验证码" required>
            <img src="captcha.php" onclick="this.src='captcha.php?'+Math.random()" title="点击刷新">
        </div>

        <!-- 7天免登录勾选框 -->
        <label class="remember">
            <input type="checkbox" name="remember" value="7"> 7天内免登录
        </label>

        <button type="submit" name="login">立即登录</button>
    </form>

    <p class="link">钓友注册：<a href="register.php">立即注册</a></p>
    <p class="link">管理员入口：<a href="login_admin.php">后台登录</a></p>
</div>
</body>
</html>`;
}

router.get('/login.php', (req, res) => {
  // 读取记住登录 Cookie，自动登录
  const uid = H.intval(req.cookies && req.cookies.user_id);
  const utype = req.cookies && req.cookies.user_type;
  if (uid && (utype === 'admin' || utype === 'user')) {
    const info =
      utype === 'admin'
        ? db.get('SELECT * FROM admin WHERE id = ?', uid)
        : db.get('SELECT * FROM users WHERE id = ?', uid);
    if (info) {
      if (utype === 'admin') {
        req.session.admin_login = true;
        req.session.admin_id = info.id;
        req.session.admin_name = info.nickname;
        return res.redirect('admin_index.php');
      }
      req.session.user_login = true;
      req.session.username = info.username;
      req.session.user_id = info.id;
      return res.redirect('index.php');
    }
  }
  res.type('html').send(loginPage());
});

router.post('/login.php', (req, res) => {
  const username = H.str(req.body.username);
  const password = H.str(req.body.password);
  const captcha = H.str(req.body.captcha);
  const remember = !!req.body.remember;

  if (captcha !== String(req.session.captcha || '')) {
    return res.type('html').send(H.alertBack('验证码错误！'));
  }

  // 1. 先查询管理员表
  const adminInfo = db.get('SELECT * FROM admin WHERE username = ?', username);
  if (adminInfo && H.verifyPassword(password, adminInfo.password)) {
    req.session.admin_login = true;
    req.session.admin_id = adminInfo.id;
    req.session.admin_name = adminInfo.nickname;
    delete req.session.captcha;
    if (remember) {
      res.cookie('user_id', String(adminInfo.id), { maxAge: 604800000, path: '/' });
      res.cookie('user_type', 'admin', { maxAge: 604800000, path: '/' });
    }
    return res.type('html').send(H.alertGo('管理员登录成功！', 'admin_index.php'));
  }

  // 2. 查询普通钓友用户表
  const userInfo = db.get('SELECT * FROM users WHERE username = ?', username);
  if (userInfo && H.verifyPassword(password, userInfo.password)) {
    req.session.user_login = true;
    req.session.username = userInfo.username;
    req.session.user_id = userInfo.id;
    delete req.session.captcha;
    if (remember) {
      res.cookie('user_id', String(userInfo.id), { maxAge: 604800000, path: '/' });
      res.cookie('user_type', 'user', { maxAge: 604800000, path: '/' });
    }
    return res.type('html').send(H.alertGo('登录成功！', 'index.php'));
  }

  res.type('html').send(H.alertBack('用户名或密码错误！'));
});

/* ----------------------------------- 注册 ----------------------------------- */
function registerPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>乡村垂钓 - 用户注册</title>
    <style>${LOGIN_CSS}    </style>
</head>
<body>
<div class="box">
    <h2>乡村垂钓 - 注册</h2>

    <form method="post">
        <input type="text" name="username" placeholder="请输入用户名" required>
        <input type="password" name="password" placeholder="请输入密码" required>
        <input type="password" name="repwd" placeholder="请再次输入密码" required>
        
        <div class="code-box">
            <input type="text" name="captcha" placeholder="请输入验证码" required>
            <img src="captcha.php" onclick="this.src='captcha.php?'+Math.random()" title="点击刷新">
        </div>

        <button type="submit" name="reg">立即注册</button>
    </form>

    <p class="link">已有账号？<a href="login.php">立即登录</a></p>
</div>
</body>
</html>`;
}

router.get('/register.php', (req, res) => res.type('html').send(registerPage()));

router.post('/register.php', (req, res) => {
  const username = H.str(req.body.username);
  const password = H.str(req.body.password);
  const repwd = H.str(req.body.repwd);
  const captcha = H.str(req.body.captcha);

  if (captcha !== String(req.session.captcha || '')) {
    return res.type('html').send(H.alertBack('验证码错误！'));
  }
  if (password !== repwd) {
    return res.type('html').send(H.alertBack('两次输入的密码不一致！'));
  }
  if (!username || !password) {
    return res.type('html').send(H.alertBack('用户名和密码不能为空！'));
  }
  if (Array.from(username).length > 50) {
    return res.type('html').send(H.alertBack('用户名过长，最多 50 个字符！'));
  }

  const exists = db.get('SELECT id FROM users WHERE username = ?', username);
  if (exists) {
    return res.type('html').send(H.alertBack('用户名已存在！'));
  }

  const timestamp = H.now();
  db.run(
    `INSERT INTO users (username, password, create_time, avatar, signature, reg_time)
     VALUES (?,?,?,?,?,?)`,
    username,
    H.hashPassword(password),
    timestamp,
    'https://picsum.photos/id/1005/120/120',
    '热爱钓鱼，享受生活',
    timestamp
  );
  delete req.session.captcha;
  res.type('html').send(H.alertGo('注册成功！请登录', 'login.php'));
});

/* ----------------------------------- 退出 ----------------------------------- */
function clearLogin(res) {
  res.clearCookie('user_id', { path: '/' });
  res.clearCookie('user_type', { path: '/' });
}

router.get('/logout.php', (req, res) => {
  req.session.destroy(() => {
    clearLogin(res);
    res.redirect('login.php');
  });
});

router.get('/admin_logout.php', (req, res) => {
  const keepUser = req.session && req.session.user_login;
  if (keepUser) {
    // 只退出管理员身份，保留钓友登录态
    delete req.session.admin_login;
    delete req.session.admin_id;
    delete req.session.admin_name;
    return res.redirect('login_admin.php');
  }
  req.session.destroy(() => {
    clearLogin(res);
    res.redirect('login_admin.php');
  });
});

module.exports = router;
