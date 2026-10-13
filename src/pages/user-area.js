'use strict';

/** 预约 order.php + 个人中心 user.php */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const H = require('../helpers');
const { requireUser } = require('./site');

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const AVATAR_DIR = path.join(PUBLIC_DIR, 'avatar');

if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || '') || '.png').replace(/[^a-zA-Z0-9.]/g, '');
      const uid = (req.session && req.session.user_id) || 0;
      cb(null, `${uid}_${Math.floor(Date.now() / 1000)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allow = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allow.includes(file.mimetype)) return cb(null, true);
    cb(new Error('UNSUPPORTED_IMAGE_TYPE'));
  },
});

/* ================================= 预约 order.php ================================= */
router.get('/order.php', (req, res) => {
  if (!requireUser(req, res)) return;
  const userId = req.session.user_id;

  if (req.query.del !== undefined) {
    db.run('UPDATE orders SET status = 3 WHERE id = ? AND user_id = ?', H.intval(req.query.del), userId);
    return res.redirect('order.php');
  }

  const fields = db.all('SELECT id, field_name, price_half, price_full, price_night FROM fishing_field');
  const myOrder = db.all(
    `SELECT o.*, f.field_name, f.img_url
     FROM orders o
     LEFT JOIN fishing_field f ON o.field_id = f.id
     WHERE o.user_id = ?
     ORDER BY o.id DESC`,
    userId
  );

  const preselect = H.intval(req.query.field_id);
  const options = fields
    .map(
      (f) => `<option 
                    value="${f.id}" 
                    data-half="${f.price_half}"
                    data-full="${f.price_full}"
                    data-night="${f.price_night}"
                    ${preselect === f.id ? 'selected' : ''}
                >
                    ${H.esc(f.field_name)}
                </option>`
    )
    .join('\n                ');

  const orderHtml = myOrder.length
    ? myOrder
        .map((o) => {
          let tag;
          if (Number(o.status) === 1) tag = '<span class="status-tag tag-wait">待审核</span>';
          else if (Number(o.status) === 2) tag = '<span class="status-tag tag-pass">已通过</span>';
          else tag = '<span class="status-tag tag-cancel">已取消</span>';

          return `
        <div class="order-item">
            <img src="${H.esc(o.img_url)}" class="order-img">
            <div class="order-info">
                <h4>
                    ${H.esc(o.field_name)}
                    ${tag}
                </h4>
                <p>日期：${H.esc(o.order_date)}</p>
                <p>时段：${H.esc(o.order_time)} | 人数：${o.people_num}人</p>
            </div>
            ${
              Number(o.status) !== 3
                ? `<a href="?del=${o.id}" onclick="return confirm('确定取消该预约？')">
                <button class="del-btn">取消</button>
            </a>`
                : ''
            }
        </div>`;
        })
        .join('')
    : '        <p style="text-align:center;color:#999;padding:20px 0;">暂无预约记录</p>';

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>钓场预约</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{
    background:#f5f7fa;
    font-family:"Microsoft YaHei",sans-serif;
    padding:20px;
}
.back{
    display:inline-block;
    padding:10px 20px;
    background:#0066aa;
    color:#fff;
    border-radius:30px;
    text-decoration:none;
    margin-bottom:20px;
}
.box{
    max-width:500px;
    margin:0 auto 30px;
    background:#fff;
    border-radius:16px;
    padding:25px;
    box-shadow:0 4px 12px rgba(0,0,0,0.05);
}
.box h2{
    font-size:18px;
    margin-bottom:20px;
    color:#333;
}
.form-item{
    margin-bottom:15px;
}
.form-item label{
    display:block;
    font-size:14px;
    color:#555;
    margin-bottom:6px;
}
.form-item input,.form-item select{
    width:100%;
    padding:12px;
    border:1px solid #eee;
    border-radius:10px;
    font-size:15px;
}
.btn-submit{
    width:100%;
    padding:13px;
    background:#0066aa;
    color:#fff;
    border:none;
    border-radius:10px;
    font-size:16px;
    margin-top:5px;
    cursor:pointer;
}
/* 价格展示样式 */
.price-show{
    background:#fff9e6;
    padding:10px 12px;
    border-radius:8px;
    margin-top:8px;
    font-size:14px;
    color:#e53935;
    font-weight:bold;
}
/* 预约列表样式 */
.order-item{
    display:flex;
    align-items:center;
    padding:15px;
    background:#fafafa;
    border-radius:12px;
    margin-bottom:10px;
}
.order-img{
    width:60px;
    height:60px;
    border-radius:10px;
    object-fit:cover;
}
.order-info{
    flex:1;
    margin:0 12px;
}
.order-info h4{
    font-size:15px;
    margin-bottom:4px;
}
.order-info p{
    font-size:12px;
    color:#666;
    line-height:1.4;
}
/* 状态标签 */
.status-tag{
    display:inline-block;
    padding:2px 6px;
    border-radius:4px;
    font-size:12px;
    color:#fff;
    margin-left:6px;
}
.tag-wait{background:#ff9800;}
.tag-pass{background:#4caf50;}
.tag-cancel{background:#999;}
.del-btn{
    padding:6px 10px;
    background:#ff4444;
    color:#fff;
    border:none;
    border-radius:6px;
    font-size:12px;
    cursor:pointer;
}
</style>
</head>
<body>
<a href="javascript:history.back()" class="back">← 返回上一页</a>

<!-- 预约表单 -->
<div class="box">
    <h2>🎣 钓场预约</h2>
    <form method="post">
        <div class="form-item">
            <label>选择钓场</label>
            <select name="field_id" id="fieldSelect" required>
                ${options}
            </select>
            <!-- 收费标准自动显示 -->
            <div class="price-show" id="priceInfo">
                半天：¥0 ｜ 全天：¥0 ｜ 夜钓：¥0
            </div>
        </div>

        <div class="form-item">
            <label>预约日期</label>
            <input type="date" name="order_date" required>
        </div>
        <div class="form-item">
            <label>预约时段</label>
            <select name="order_time" required>
                <option value="上午 8:00-12:00">上午 8:00-12:00</option>
                <option value="下午 13:00-18:00">下午 13:00-18:00</option>
                <option value="全天 8:00-18:00">全天 8:00-18:00</option>
            </select>
        </div>
        <div class="form-item">
            <label>垂钓人数</label>
            <input type="number" name="people_num" min="1" value="1" required>
        </div>
        <button class="btn-submit">确认预约</button>
    </form>
</div>

<!-- 我的预约列表（带状态） -->
<div class="box">
    <h2>📋 我的预约</h2>
${orderHtml}
</div>

<script>
// 自动切换显示收费
const select = document.getElementById('fieldSelect');
const priceInfo = document.getElementById('priceInfo');

function updatePrice(){
    const opt = select.options[select.selectedIndex];
    const half = opt.dataset.half || 0;
    const full = opt.dataset.full || 0;
    const night = opt.dataset.night || 0;
    priceInfo.innerHTML = '半天：¥'+half+' ｜ 全天：¥'+full+' ｜ 夜钓：¥'+night;
}

select.onchange = updatePrice;
window.onload = updatePrice;
</script>
</body>
</html>`);
});

router.post('/order.php', (req, res) => {
  if (!requireUser(req, res)) return;
  const userId = req.session.user_id;

  const fieldId = H.intval(req.body.field_id);
  const orderDate = H.str(req.body.order_date);
  const orderTime = H.str(req.body.order_time);
  const peopleNum = H.intval(req.body.people_num) || 1;

  // 检测同一钓场、同一日期、同一时段是否已有有效预约（排除已取消）
  const conflict = db.get(
    `SELECT id FROM orders WHERE field_id = ? AND order_date = ? AND order_time = ? AND status != 3`,
    fieldId, orderDate, orderTime
  );
  if (conflict) {
    return res.type('html').send(H.alertBack('该时段已有预约，请选择其他日期或时段！'));
  }

  db.run(
    `INSERT INTO orders (user_id, field_id, order_date, order_time, people_num, create_time, status)
     VALUES (?,?,?,?,?,?,1)`,
    userId, fieldId, orderDate, orderTime, peopleNum, H.now()
  );
  res.type('html').send(H.alertGo('预约提交成功，等待管理员审核！', 'order.php'));
});

/* =============================== 个人中心 user.php =============================== */
function avatarSrc(user) {
  const a = user.avatar;
  if (!a) return null;
  if (/^https?:\/\//i.test(a)) return a;
  if (fs.existsSync(path.join(AVATAR_DIR, a))) return 'avatar/' + a;
  return null;
}

router.get('/user.php', (req, res) => {
  if (req.session.admin_login) {
    return res.type('html').send(
      H.alertGo('管理员请前往后台管理页面，不可访问钓友个人中心！', 'admin_index.php')
    );
  }
  if (!requireUser(req, res)) return;

  const uid = req.session.user_id;
  const user = db.get('SELECT * FROM users WHERE id = ?', uid);
  if (!user) {
    return res.type('html').send(H.alertGo('用户不存在，请重新登录！', 'logout.php'));
  }

  // 切换历史头像为当前头像
  if (req.query.switch_avatar) {
    db.run('UPDATE users SET avatar = ? WHERE id = ?', H.str(req.query.switch_avatar), uid);
    return res.type('html').send(H.alertGo('头像切换成功！', 'user.php'));
  }

  const historyAvatarList = db.all(
    'SELECT * FROM history_avatar WHERE user_id = ? ORDER BY upload_time DESC',
    uid
  );

  const collectNum = (db.get('SELECT count(*) AS c FROM collect WHERE user_id = ?', uid) || {}).c || 0;
  const msgNum = (db.get('SELECT count(*) AS c FROM contact_msg WHERE user_id = ?', uid) || {}).c || 0;

  const src = avatarSrc(user);
  const avatarHtml = src
    ? `<img src="${H.esc(src)}" class="avatar">`
    : '<div class="avatar">👤</div>';

  const historyHtml = historyAvatarList.length
    ? historyAvatarList
        .map((his) => {
          const activeClass = his.avatar_name === user.avatar ? 'active' : '';
          return `<img 
                    src="avatar/${H.esc(his.avatar_name)}" 
                    class="history-avatar-item ${activeClass}"
                    onclick="location.href='?switch_avatar=${encodeURIComponent(his.avatar_name)}'"
                    title="点击使用该头像 | 上传时间：${H.esc(his.upload_time)}"
                >`;
        })
        .join('\n                ')
    : '<p style="color:#888;">暂无历史头像，上传新头像后会保存在这里</p>';

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>个人中心 - 钓友社区</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{
    background:#f5f7fa;
    font-family:"Microsoft YaHei",sans-serif;
    padding:20px;
}
.back-btn{
    display:inline-block;
    padding:10px 20px;
    background:#0066aa;
    color:#fff;
    border-radius:30px;
    text-decoration:none;
    margin-bottom:20px;
    font-size:15px;
}
.page-title{
    text-align:center;
    font-size:24px;
    font-weight:bold;
    color:#222;
    margin-bottom:25px;
}
.box{
    max-width:580px;
    margin:0 auto 25px;
    background:#fff;
    border-radius:16px;
    padding:22px;
    box-shadow:0 4px 12px rgba(0,0,0,0.05);
}
.box h3{
    color:#0066aa;
    margin-bottom:18px;
    font-size:17px;
}
/* 头像区域 */
.avatar-wrap{
    text-align:center;
    margin-bottom:15px;
}
.avatar{
    width:100px;
    height:100px;
    border-radius:50%;
    object-fit:cover;
    border:3px solid #0066aa;
    background:#eee;
    display:flex;
    align-items:center;
    justify-content:center;
    color:#0066aa;
    font-size:36px;
    margin:0 auto;
}
.upload-avatar-btn{
    margin-top:10px;
    display:inline-block;
    padding:6px 16px;
    background:#0066aa;
    color:#fff;
    border-radius:6px;
    cursor:pointer;
    font-size:14px;
}
/* 历史头像列表 */
.history-avatar-box{
    display:flex;
    gap:12px;
    flex-wrap:wrap;
    margin-top:10px;
}
.history-avatar-item{
    width:70px;
    height:70px;
    border-radius:8px;
    object-fit:cover;
    border:2px solid transparent;
    cursor:pointer;
}
.history-avatar-item.active{
    border-color:#0066aa;
}
/* 资料项 */
.info-item{
    font-size:15px;
    color:#555;
    line-height:2.2;
}
.info-item strong{
    color:#333;
    display:inline-block;
    width:90px;
}
/* 表单 */
.form-item{
    margin-bottom:15px;
}
.form-item input,
.form-item textarea{
    width:100%;
    padding:12px;
    border:1px solid #eee;
    border-radius:10px;
    font-size:15px;
    outline:none;
}
.btn{
    width:100%;
    padding:13px;
    background:#0066aa;
    color:#fff;
    border:none;
    border-radius:10px;
    font-size:16px;
    cursor:pointer;
}
.btn:hover{
    background:#005599;
}
/* 功能菜单 */
.menu-list{
    list-style:none;
}
.menu-list li{
    line-height:45px;
    border-bottom:1px solid #f2f2f2;
}
.menu-list li a{
    display:block;
    color:#333;
    text-decoration:none;
    padding:0 10px;
}
.menu-list li a:hover{
    color:#0066aa;
}
</style>
</head>
<body>

<a href="javascript:history.back()" class="back-btn">← 返回上一页</a>
<h2 class="page-title">👤 个人中心</h2>

<!-- 1. 个人资料卡片 -->
<div class="box">
    <div class="avatar-wrap">
        ${avatarHtml}
        <!-- 头像上传弹窗触发按钮 -->
        <div class="upload-avatar-btn" onclick="showUploadBox()">更换头像</div>
    </div>
    <h3>基本资料</h3>
    <div class="info-item"><strong>用户名：</strong>${H.esc(user.username)}</div>
    <div class="info-item"><strong>个性签名：</strong>${H.esc(user.signature)}</div>
    <div class="info-item"><strong>联系电话：</strong>${H.esc(user.phone) || '未填写'}</div>
    <div class="info-item"><strong>邮箱：</strong>${H.esc(user.email) || '未填写'}</div>
    <div class="info-item"><strong>注册时间：</strong>${H.esc(user.reg_time || user.create_time)}</div>
</div>

<!-- 头像上传表单（默认隐藏） -->
<div class="box" id="upload_avatar_box" style="display:none;">
    <h3>上传新头像</h3>
    <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="action" value="upload_avatar">
        <div class="form-item">
            <input type="file" name="avatar_file" accept="image/*" required>
            <p style="font-size:13px;color:#888;margin-top:5px;">支持JPG/PNG/GIF格式图片</p>
        </div>
        <button class="btn">确认上传</button>
    </form>
</div>

<!-- 历史头像查看模块 -->
<div class="box">
    <h3>我的历史头像（点击切换为当前头像）</h3>
    <div class="history-avatar-box">
        ${historyHtml}
    </div>
</div>

<!-- 2. 数据统计 -->
<div class="box">
    <h3>我的数据</h3>
    <div class="info-item"><strong>我的收藏：</strong>${collectNum} 条</div>
    <div class="info-item"><strong>我的留言：</strong>${msgNum} 条</div>
    <div class="info-item"><strong>钓友等级：</strong>普通钓友</div>
</div>

<!-- 3. 功能菜单 -->
<div class="box">
    <h3>常用功能</h3>
    <ul class="menu-list">
        <li><a href="javascript:;" onclick="showEdit()">📝 修改个人资料</a></li>
        <li><a href="javascript:;" onclick="showPwd()">🔐 修改密码</a></li>
        <li><a href="collect.php">⭐ 我的收藏</a></li>
        <li><a href="chat.php">👥 钓友交流</a></li>
        <li><a href="contact.php">📞 联系我们（客服）</a></li>
        <li><a href="logout.php">🚪 退出登录</a></li>
    </ul>
</div>

<!-- 4. 修改资料表单 -->
<div class="box" id="edit_box" style="display:none;">
    <h3>修改个人资料</h3>
    <form method="post">
        <input type="hidden" name="action" value="edit_info">
        <div class="form-item"><input type="text" name="username" value="${H.esc(user.username)}" placeholder="用户名"></div>
        <div class="form-item"><input type="text" name="signature" value="${H.esc(user.signature)}" placeholder="个性签名"></div>
        <div class="form-item"><input type="tel" name="phone" value="${H.esc(user.phone)}" placeholder="电话"></div>
        <div class="form-item"><input type="email" name="email" value="${H.esc(user.email)}" placeholder="邮箱"></div>
        <button class="btn">保存修改</button>
    </form>
</div>

<!-- 5. 修改密码表单 -->
<div class="box" id="pwd_box" style="display:none;">
    <h3>修改密码</h3>
    <form method="post">
        <input type="hidden" name="action" value="edit_pwd">
        <div class="form-item"><input type="password" name="old_pwd" placeholder="原密码"></div>
        <div class="form-item"><input type="password" name="new_pwd" placeholder="新密码"></div>
        <button class="btn">确认修改</button>
    </form>
</div>

<!-- 6. 联系我们（内嵌留言，和 contact.php 打通） -->
<div class="box" id="contact">
    <h3>联系客服</h3>
    <form method="post">
        <input type="hidden" name="action" value="contact">
        <div class="form-item"><textarea name="msg" placeholder="有问题或建议，直接留言给客服..." required></textarea></div>
        <button class="btn">提交留言</button>
    </form>
</div>

<script>
function showEdit(){
    document.getElementById('edit_box').style.display='block';
    document.getElementById('pwd_box').style.display='none';
    document.getElementById('upload_avatar_box').style.display='none';
}
function showPwd(){
    document.getElementById('pwd_box').style.display='block';
    document.getElementById('edit_box').style.display='none';
    document.getElementById('upload_avatar_box').style.display='none';
}
function showUploadBox(){
    document.getElementById('upload_avatar_box').style.display='block';
    document.getElementById('edit_box').style.display='none';
    document.getElementById('pwd_box').style.display='none';
}
</script>

</body>
</html>`);
});

/* user.php 的表单提交：先按需解析 multipart（头像上传），再统一处理各 action */
function isMultipart(req) {
  return String(req.headers['content-type'] || '').includes('multipart/form-data');
}

router.post('/user.php', (req, res, next) => {
  if (req.session.admin_login) {
    return res.type('html').send(
      H.alertGo('管理员请前往后台管理页面，不可访问钓友个人中心！', 'admin_index.php')
    );
  }
  if (!requireUser(req, res)) return;
  if (!isMultipart(req)) return next();

  avatarUpload.single('avatar_file')(req, res, (err) => {
    if (err) {
      const msg =
        err.message === 'UNSUPPORTED_IMAGE_TYPE'
          ? '仅支持jpg/png/gif图片！'
          : '图片上传失败，请确认文件小于 5MB！';
      return res.type('html').send(H.alertBack(msg));
    }
    next();
  });
});

router.post('/user.php', (req, res) => {
  const uid = req.session.user_id;
  const action = H.str(req.body.action);
  const user = db.get('SELECT * FROM users WHERE id = ?', uid);
  if (!user) return res.type('html').send(H.alertGo('请重新登录！', 'logout.php'));

  // 资料修改
  if (action === 'edit_info') {
    const newName = H.str(req.body.username);
    const signature = H.str(req.body.signature);
    const phone = H.str(req.body.phone);
    const email = H.str(req.body.email);

    // 校验：原来没有任何校验，用户名可以被改成空或与别人重名，
    // 前者会让账号再也登不进去，后者会直接抛数据库错误并把表结构回显给用户
    if (!newName) return res.type('html').send(H.alertBack('用户名不能为空！'));
    if (Array.from(newName).length > 50) {
      return res.type('html').send(H.alertBack('用户名过长，最多 50 个字符！'));
    }
    if (Array.from(signature).length > 100) {
      return res.type('html').send(H.alertBack('个性签名过长，最多 100 个字符！'));
    }
    if (Array.from(phone).length > 20) {
      return res.type('html').send(H.alertBack('联系电话过长！'));
    }
    if (Array.from(email).length > 80) {
      return res.type('html').send(H.alertBack('邮箱过长！'));
    }
    const taken = db.get('SELECT id FROM users WHERE username = ? AND id != ?', newName, uid);
    if (taken) return res.type('html').send(H.alertBack('该用户名已被其他钓友使用！'));

    db.run(
      'UPDATE users SET username = ?, signature = ?, phone = ?, email = ? WHERE id = ?',
      newName, signature, phone, email, uid
    );
    // 用户名同时是会话里的展示名，改完同步一下
    req.session.username = newName;
    return res.type('html').send(H.alertGo('资料修改成功！', 'user.php'));
  }

  // 修改密码
  if (action === 'edit_pwd') {
    const oldPwd = H.str(req.body.old_pwd);
    const newPwd = H.str(req.body.new_pwd);
    if (!newPwd) return res.type('html').send(H.alertBack('新密码不能为空！'));
    if (!H.verifyPassword(oldPwd, user.password)) {
      return res.type('html').send(H.alertBack('原密码错误！'));
    }
    db.run('UPDATE users SET password = ? WHERE id = ?', H.hashPassword(newPwd), uid);
    return res.type('html').send(H.alertGo('密码修改成功！请重新登录', 'logout.php'));
  }

  // 上传头像
  if (action === 'upload_avatar') {
    if (!req.file) return res.type('html').send(H.alertBack('请选择图片文件！'));
    const fileName = req.file.filename;
    db.run('UPDATE users SET avatar = ? WHERE id = ?', fileName, uid);
    db.run(
      'INSERT INTO history_avatar (user_id, avatar_name, upload_time) VALUES (?,?,?)',
      uid, fileName, H.now()
    );
    return res.type('html').send(H.alertGo('头像上传成功！', 'user.php'));
  }

  // 站内留言（与 contact.php 共用表）
  if (action === 'contact') {
    db.run(
      `INSERT INTO contact_msg (user_id, username, contact_name, contact_phone, contact_email, msg_content, add_time)
       VALUES (?,?,?,?,?,?,?)`,
      uid, user.username, user.username, user.phone, user.email, H.str(req.body.msg), H.now()
    );
    return res.type('html').send(H.alertGo('留言已提交，客服会尽快回复！', 'user.php#contact'));
  }

  res.redirect('user.php');
});

module.exports = router;
