'use strict';

/**
 * 钓鱼乐园 —— Node.js + SQLite 版
 * 由原 PHP + MySQL 版本迁移而来，页面、样式、路由路径与功能保持一致。
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');

const { init } = require('./src/init');
const SqliteStore = require('./src/session-store');
const authRoutes = require('./src/pages/auth');
const { router: siteRoutes } = require('./src/pages/site');
const userAreaRoutes = require('./src/pages/user-area');
const adminRoutes = require('./src/pages/admin');

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

/* 基础安全响应头 */
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

/* 轻量 Cookie 解析（原项目用 $_COOKIE 读取“7天免登录”标记） */
app.use((req, res, next) => {
  const header = req.headers.cookie;
  req.cookies = {};
  if (header) {
    header.split(';').forEach((part) => {
      const idx = part.indexOf('=');
      if (idx > -1) {
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (key) {
          try {
            req.cookies[key] = decodeURIComponent(value);
          } catch (e) {
            req.cookies[key] = value;
          }
        }
      }
    });
  }
  next();
});

/**
 * 会话签名密钥：优先取环境变量 SESSION_SECRET；
 * 否则首次运行自动生成一个随机密钥并持久化到 data/.session-secret（已 gitignore）。
 * 不在源码里写死默认密钥 —— 仓库是公开的，写死等于把签名密钥公开出去。
 */
function resolveSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const dir = path.join(__dirname, 'data');
  const file = path.join(dir, '.session-secret');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(file)) {
      const saved = fs.readFileSync(file, 'utf8').trim();
      if (saved.length >= 32) return saved;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, generated, { mode: 0o600 });
    return generated;
  } catch (err) {
    console.warn('[warn] 会话密钥无法落盘，本次运行改用临时密钥：' + err.message);
    return crypto.randomBytes(32).toString('hex');
  }
}

app.use(
  session({
    name: 'FISHINGSESSID',
    secret: resolveSessionSecret(),
    resave: false,
    saveUninitialized: false,
    store: new SqliteStore({ ttl: 1000 * 60 * 60 * 24 * 7 }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, httpOnly: true, sameSite: 'lax' },
  })
);

/* 会话 Cookie：走 https 时补上 Secure 标记（平台网关也会强制加，这里做一层兜底） */
app.use((req, res, next) => {
  if (req.session && req.session.cookie && req.secure) req.session.cookie.secure = true;
  next();
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* CSRF 防护：会改变状态的操作必须来自本站页面。
   背景：线上网关会把会话 Cookie 的 SameSite=Lax 改写成 SameSite=None，
   浏览器自带的 CSRF 防护就没了，所以这里补一层服务端校验。
   优先用 Sec-Fetch-Site（现代浏览器强制发送、页面脚本无法伪造），
   缺失时回退到 Origin/Referer 比对；两者都没有（如 curl）则放行，避免误伤。 */
const STATE_CHANGE_GET_KEYS = ['del', 'confirm', 'cancel', 'act', 'switch_avatar'];

function isStateChanging(req) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  return STATE_CHANGE_GET_KEYS.some((key) => req.query[key] !== undefined);
}

function isSameOrigin(req) {
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';
  const source = req.headers.origin || req.headers.referer;
  if (!source) return true;
  try {
    return new URL(source).host === req.headers.host;
  } catch (e) {
    return false;
  }
}

app.use((req, res, next) => {
  if (!isStateChanging(req) || isSameOrigin(req)) return next();
  console.warn(
    '[csrf] 已拦截跨站状态变更请求:',
    req.method, req.originalUrl,
    '| sec-fetch-site=' + (req.headers['sec-fetch-site'] || '-'),
    '| origin=' + (req.headers.origin || req.headers.referer || '-')
  );
  res.status(403).type('html').send(errorPage('请求已被拒绝', '该操作需要从本站页面发起，请返回后重试。'));
});

/* 静态资源：图片、头像、样式 */
app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads')));
app.use('/avatar', express.static(path.join(PUBLIC_DIR, 'avatar')));
app.use('/weui.css', express.static(path.join(PUBLIC_DIR, 'weui.css')));
app.get('/images/default.png', (req, res) => {
  res.type('image/svg+xml').send(
    '<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70"><rect width="70" height="70" fill="#e6f2ff"/><text x="35" y="42" font-size="28" text-anchor="middle" fill="#0066aa">🎣</text></svg>'
  );
});

/* 业务路由（路径沿用原 .php 文件名，页面内所有链接无需改动） */
app.use(authRoutes);
app.use(siteRoutes);
app.use(userAreaRoutes);
app.use(adminRoutes);

app.get('/', (req, res) => res.redirect('/index.php'));

/* 兜底：未匹配的路径一律回首页。
   必须用绝对路径 —— 用相对的 'index.php' 会让 /uploads/xxx 这类请求反复跳到
   /uploads/index.php 自己，浏览器报「重定向次数过多」。 */
app.use((req, res) => res.redirect('/index.php'));

/* 统一错误页：只给用户一句通用提示，真实错误只写服务端日志，避免把库表结构、
   文件路径等信息回显出去。 */
function errorPage(title, message) {
  return (
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title></head>' +
    '<body style="font-family:Microsoft YaHei,sans-serif;padding:60px 20px;text-align:center;background:#f5f7fa">' +
    '<h2 style="color:#333">' + title + '</h2>' +
    '<p style="color:#666;margin:16px 0">' + message + '</p>' +
    '<p><a href="/index.php" style="color:#0066aa">返回首页</a></p></body></html>'
  );
}

/* eslint-disable no-unused-vars */
app.use((err, req, res, next) => {
  console.error('[error]', (req.method + ' ' + req.originalUrl), err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  const status = (err && (err.status || err.statusCode)) || 500;
  if (status === 413) {
    return res.status(413).type('html').send(errorPage('提交内容过大', '你提交的内容超过了大小限制，请返回后减少内容再试。'));
  }
  if (status === 400) {
    return res.status(400).type('html').send(errorPage('请求格式有误', '请返回上一页重新提交。'));
  }
  res.status(500).type('html').send(errorPage('服务器开小差了', '系统暂时无法处理该请求，请稍后重试。'));
});

init();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`钓鱼乐园已启动： http://0.0.0.0:${PORT}  (PORT=${PORT})`);
});
