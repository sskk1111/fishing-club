'use strict';

/** 管理后台 —— 对应 login_admin.php / admin_index.php / admin_banner.php /
 *  admin_field.php / admin_fish.php / admin_book.php / admin_order.php */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const H = require('../helpers');
const guard = require('../login-guard');

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function adminUpload(subDir) {
  const dir = path.join(PUBLIC_DIR, subDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => {
        const ext = (path.extname(file.originalname || '') || '.png').replace(/[^a-zA-Z0-9.]/g, '');
        cb(null, `${Math.floor(Date.now() / 1000)}${ext}`);
      },
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
  });
}

const bannerUpload = adminUpload('uploads/banner');
const fieldUpload = adminUpload('uploads/field');
const fishUpload = adminUpload('uploads/fish');

/** 后台权限拦截（等价于原项目 alert + location.href='login_admin.php'） */
function requireAdmin(req, res) {
  if (!req.session.admin_login) {
    res.type('html').send(H.alertGo('请先登录管理员账号', 'login_admin.php'));
    return false;
  }
  return true;
}

const ADMIN_CSS = `
        *{margin:0;padding:0;}
        body{font-family:"微软雅黑";background:#f3f3f3;}
        .top{height:60px;background:#0066aa;color:#fff;line-height:60px;padding:0 20px;}
        .top h1{float:left;font-size:20px;}
        .top .user{float:right;}
        .top a{color:#fff;margin-left:20px;text-decoration:none;}
        .container{display:flex;margin-top:10px;}
        .left{width:200px;background:#fff;min-height:calc(100vh - 80px);padding-top:20px;}
        .left a{display:block;height:45px;line-height:45px;padding-left:20px;color:#333;text-decoration:none;border-bottom:1px solid #eee;}
        .left a:hover{background:#0066aa;color:#fff;}
        .left a.active{background:#0066aa;color:#fff;}
        .right{flex:1;padding:20px;}
        .box{background:#fff;padding:20px;border-radius:6px;}
        table{width:100%;border-collapse:collapse;margin:20px 0;}
        th,td{border:1px solid #ccc;padding:8px;text-align:center;}
        th{background:#f8f8f8;}
        form{margin:20px 0;}
        .form-item{margin:10px 0;}
        input,textarea{padding:8px;border:1px solid #ccc;}
        input[type=text],textarea{width:400px;}
        button{padding:8px 20px;background:#0066aa;color:#fff;border:none;cursor:pointer;}
        a.oper{color:#0066aa;margin:0 5px;text-decoration:none;}
        img.preview{width:80px;}
`;

const MENU = [
  ['admin_index.php', '后台首页'],
  ['admin_banner.php', '轮播图管理'],
  ['admin_field.php', '钓场管理'],
  ['admin_book.php', '钓场预约'],
  ['admin_fish.php', '鱼种管理'],
];

/* ============================== 管理员登录 login_admin.php ============================== */
router.get('/login_admin.php', (req, res) => {
  res.type('html').send(loginAdminPage(''));
});

function loginAdminPage(msg) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>管理员登录 - 钓鱼乐园后台</title>
    <style>
        body{background:#f5f7fa;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
        .login-box{width:350px;background:#fff;padding:30px;border-radius:8px;box-shadow:0 0 15px #eee;}
        h2{text-align:center;color:#0066aa;margin-bottom:25px;}
        .item{margin:15px 0;}
        input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:14px;}
        button{width:100%;padding:10px;background:#0066aa;color:#fff;border:none;border-radius:4px;font-size:16px;cursor:pointer;}
        .tip{color:red;text-align:center;margin:10px 0;}
    </style>
</head>
<body>
    <div class="login-box">
        <h2>后台管理员登录</h2>
        ${msg ? `<div class="tip">${H.esc(msg)}</div>` : ''}
        <form method="post">
            <div class="item">
                <input type="text" name="username" placeholder="请输入账号" required>
            </div>
            <div class="item">
                <input type="password" name="password" placeholder="请输入密码" required>
            </div>
            <div class="item">
                <button type="submit">登 录</button>
            </div>
        </form>
        <div style="text-align:center;margin-top:15px">
            <a href="index.php">返回前台首页</a>
        </div>
    </div>
</body>
</html>`;
}

router.post('/login_admin.php', (req, res) => {
  const username = H.str(req.body.username);
  const password = H.str(req.body.password);
  const ip = guard.clientIp(req);

  /* 防暴力破解：同一来源在窗口内失败达上限即锁定，锁定期间不再校验密码。
     先判锁定再判账号，避免通过响应差异探测账号是否存在。 */
  const gate = guard.check('admin', ip);
  if (gate.locked) {
    console.warn('[login-guard] 后台登录已锁定：ip=' + ip + '，剩余 ' + gate.retryAfterMin + ' 分钟');
    return res.type('html').send(loginAdminPage(`登录失败次数过多，请 ${gate.retryAfterMin} 分钟后再试`));
  }

  if (!username || !password) {
    return res.type('html').send(loginAdminPage('账号和密码不能为空'));
  }

  const admin = db.get('SELECT * FROM admin WHERE username = ?', username);
  if (admin && H.verifyPassword(password, admin.password)) {
    guard.onSuccess('admin', ip);
    req.session.admin_login = true;
    req.session.admin_id = admin.id;
    req.session.admin_name = admin.nickname;
    return res.redirect('admin_index.php');
  }
  const fail = guard.onFail('admin', ip);
  console.warn('[login-guard] 后台登录失败：ip=' + ip + '，账号=' + username + '，累计 ' + fail.count + ' 次');
  if (fail.locked) {
    return res
      .type('html')
      .send(loginAdminPage(`登录失败次数过多，请 ${Math.ceil(guard.LOCK_MS / 60000)} 分钟后再试`));
  }
  res.type('html').send(loginAdminPage('账号或密码错误'));
});

/* =============================== 后台首页 admin_index.php =============================== */
router.get('/admin_index.php', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const name = H.esc(req.session.admin_name);
  const body = `                <h3>系统欢迎页</h3>
                <p style="margin-top:20px;line-height:2;">
                    1、当前登录账号：${name}<br>
                    2、可管理内容：轮播图、热门钓场、常见鱼种<br>
                    3、左侧菜单点击进入对应管理模块
                </p>`;
  res.type('html').send(layoutWithUser('admin_index.php', '后台管理中心', body, req.session.admin_name));
});

/** 带登录名的后台布局 */
function layoutWithUser(active, title, body, adminName) {
  const menu = MENU.map(
    ([href, label]) => `<a href="${href}"${href === active ? ' class="active"' : ''}>${label}</a>`
  ).join('\n            ');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${H.esc(title)}</title>
<style>${ADMIN_CSS}    </style>
</head>
<body>
    <div class="top">
        <h1>钓鱼乐园 - 后台管理系统</h1>
        <div class="user">
            欢迎您：${H.esc(adminName || '')}
            <a href="admin_logout.php">退出登录</a>
        </div>
    </div>
    <div class="container">
        <div class="left">
            ${menu}
        </div>
        <div class="right">
            <div class="box">
${body}
            </div>
        </div>
    </div>
</body>
</html>`;
}

/* ============================== 轮播图管理 admin_banner.php ============================== */
router.get('/admin_banner.php', (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.query.del !== undefined) {
    db.run('DELETE FROM fishing_images WHERE id = ?', H.intval(req.query.del));
    return res.redirect('admin_banner.php');
  }

  const list = db.all('SELECT * FROM fishing_images ORDER BY id ASC');
  const rows = list
    .map(
      (v) => `
                <tr>
                    <td>${v.id}</td>
                    <td><img src="${H.esc(v.img_url)}" style="width:150px;"></td>
                    <td><a href="?del=${v.id}" onclick="return confirm('确定删除？')">删除</a></td>
                </tr>`
    )
    .join('');

  const body = `                <h3>上传新轮播图</h3>
                <form method="post" enctype="multipart/form-data">
                    <input type="file" name="img" accept="image/*" required>
                    <button type="submit">上传</button>
                </form>
                <table>
                    <tr><th>ID</th><th>图片</th><th>操作</th></tr>${rows}
                </table>`;
  res.type('html').send(layoutWithUser('admin_banner.php', '轮播图管理', body, req.session.admin_name));
});

router.post('/admin_banner.php', (req, res) => {
  if (!requireAdmin(req, res)) return;
  bannerUpload.single('img')(req, res, (err) => {
    if (err || !req.file) return res.redirect('admin_banner.php');
    db.run(
      'INSERT INTO fishing_images (title, img_url, create_time) VALUES (?,?,?)',
      null,
      'uploads/banner/' + req.file.filename,
      H.now()
    );
    res.redirect('admin_banner.php');
  });
});

/* =============================== 钓场管理 admin_field.php =============================== */
router.get('/admin_field.php', (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.query.del !== undefined) {
    db.run('DELETE FROM fishing_field WHERE id = ?', H.intval(req.query.del));
    return res.redirect('admin_field.php');
  }

  const fieldList = db.all('SELECT * FROM fishing_field ORDER BY id ASC');
  const editData = req.query.edit !== undefined
    ? db.get('SELECT * FROM fishing_field WHERE id = ?', H.intval(req.query.edit))
    : null;

  const rows = fieldList
    .map(
      (field) => `
                    <tr>
                        <td>${field.id}</td>
                        <td>${H.esc(field.field_name)}</td>
                        <td>${field.img_url ? `<img src="${H.esc(field.img_url)}" class="preview">` : ''}</td>
                        <td>
                            <a href="?edit=${field.id}" class="oper">编辑</a>
                            <a href="?del=${field.id}" class="oper" onclick="return confirm('确定删除该钓场？')">删除</a>
                        </td>
                    </tr>`
    )
    .join('');

  const body = `                <h3>${editData ? '编辑钓场' : '新增钓场'}</h3>
                <form method="post" enctype="multipart/form-data">
                    <input type="hidden" name="id" value="${editData ? editData.id : 0}">
                    <input type="hidden" name="old_img" value="${editData ? H.esc(editData.img_url) : ''}">

                    <div class="form-item">
                        钓场名称：
                        <input type="text" name="field_name" value="${editData ? H.esc(editData.field_name) : ''}" required>
                    </div>
                    <div class="form-item">
                        钓场介绍：
                        <textarea name="field_desc" rows="4">${editData ? H.esc(editData.field_desc) : ''}</textarea>
                    </div>
                    <div class="form-item">
                        上传图片：
                        <input type="file" name="img" accept="image/*">
                        ${editData && editData.img_url ? `<img src="${H.esc(editData.img_url)}" class="preview">` : ''}
                    </div>
                    <div class="form-item">
                        <button type="submit">提 交</button>
                        ${editData ? '<a href="admin_field.php" style="margin-left:10px;text-decoration:none;">取消编辑</a>' : ''}
                    </div>
                </form>

                <hr>
                <h3>钓场列表</h3>
                <table>
                    <tr>
                        <th>ID</th>
                        <th>钓场名称</th>
                        <th>展示图片</th>
                        <th>操作</th>
                    </tr>${rows}
                </table>`;
  res.type('html').send(layoutWithUser('admin_field.php', '钓场管理', body, req.session.admin_name));
});

router.post('/admin_field.php', (req, res) => {
  if (!requireAdmin(req, res)) return;
  fieldUpload.single('img')(req, res, (err) => {
    if (err) return res.redirect('admin_field.php');
    const id = H.intval(req.body.id);
    const fieldName = H.str(req.body.field_name);
    const fieldDesc = H.str(req.body.field_desc);
    let imgUrl = H.str(req.body.old_img);

    if (req.file) imgUrl = 'uploads/field/' + req.file.filename;

    if (id > 0) {
      db.run(
        `UPDATE fishing_field SET field_name = ?, field_desc = ?, img_url = ? WHERE id = ?`,
        fieldName, fieldDesc, imgUrl, id
      );
    } else {
      db.run(
        `INSERT INTO fishing_field (field_name, field_desc, img_url) VALUES (?,?,?)`,
        fieldName, fieldDesc, imgUrl
      );
    }
    res.redirect('admin_field.php');
  });
});

/* =============================== 鱼种管理 admin_fish.php =============================== */
router.get('/admin_fish.php', (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.query.del !== undefined) {
    db.run('DELETE FROM fish_types WHERE id = ?', H.intval(req.query.del));
    return res.redirect('admin_fish.php');
  }

  const fishList = db.all('SELECT * FROM fish_types ORDER BY id ASC');
  const edit = req.query.edit !== undefined
    ? db.get('SELECT * FROM fish_types WHERE id = ?', H.intval(req.query.edit))
    : null;

  const rows = fishList
    .map(
      (fish) => `
                    <tr>
                        <td>${fish.id}</td>
                        <td>${H.esc(fish.name)}</td>
                        <td>${fish.img_url ? `<img src="${H.esc(fish.img_url)}" style="width:60px;">` : ''}</td>
                        <td>
                            <a href="?edit=${fish.id}" class="oper">编辑</a>
                            <a href="?del=${fish.id}" class="oper" onclick="return confirm('确定删除？')">删除</a>
                        </td>
                    </tr>`
    )
    .join('');

  const body = `                <h3>${edit ? '编辑鱼种' : '新增鱼种'}</h3>
                <form method="post" enctype="multipart/form-data">
                    <input type="hidden" name="id" value="${edit ? edit.id : 0}">
                    <input type="hidden" name="old_img" value="${edit ? H.esc(edit.img_url) : ''}">
                    <div class="form-item">
                        鱼种名称：<input type="text" name="name" value="${edit ? H.esc(edit.name) : ''}" required>
                    </div>
                    <div class="form-item">
                        鱼种介绍：<textarea name="intro" rows="3">${edit ? H.esc(edit.intro) : ''}</textarea>
                    </div>
                    <div class="form-item">
                        推荐饵料：<textarea name="feed" rows="2">${edit ? H.esc(edit.feed) : ''}</textarea>
                    </div>
                    <div class="form-item">
                        上传图片：<input type="file" name="img" accept="image/*">
                        ${edit && edit.img_url ? `<img src="${H.esc(edit.img_url)}" style="width:80px;margin-left:10px;">` : ''}
                    </div>
                    <div class="form-item">
                        <button type="submit">提 交</button>
                        ${edit ? '<a href="admin_fish.php" style="margin-left:10px;text-decoration:none;">取消编辑</a>' : ''}
                    </div>
                </form>

                <hr>
                <h3>鱼种列表</h3>
                <table>
                    <tr>
                        <th>ID</th>
                        <th>名称</th>
                        <th>图片</th>
                        <th>操作</th>
                    </tr>${rows}
                </table>`;
  res.type('html').send(layoutWithUser('admin_fish.php', '鱼种管理', body, req.session.admin_name));
});

router.post('/admin_fish.php', (req, res) => {
  if (!requireAdmin(req, res)) return;
  fishUpload.single('img')(req, res, (err) => {
    if (err) return res.redirect('admin_fish.php');
    const id = H.intval(req.body.id);
    const name = H.str(req.body.name);
    const intro = H.str(req.body.intro);
    const feed = H.str(req.body.feed);
    let imgUrl = H.str(req.body.old_img);

    if (req.file) imgUrl = 'uploads/fish/' + req.file.filename;

    if (id > 0) {
      db.run(
        `UPDATE fish_types SET name = ?, intro = ?, img_url = ?, feed = ? WHERE id = ?`,
        name, intro, imgUrl, feed, id
      );
    } else {
      db.run(
        `INSERT INTO fish_types (name, intro, img_url, feed) VALUES (?,?,?,?)`,
        name, intro, imgUrl, feed
      );
    }
    res.redirect('admin_fish.php');
  });
});

/* =============================== 预约管理 admin_book.php =============================== */
router.get('/admin_book.php', (req, res) => {
  if (!requireAdmin(req, res)) return;

  // 确认预约：更新状态 + 生成订单
  if (req.query.confirm !== undefined) {
    const bid = H.intval(req.query.confirm);
    const bookRow = db.get('SELECT * FROM booking WHERE id = ?', bid);
    if (bookRow) {
      db.run('UPDATE booking SET status = 1 WHERE id = ?', bid);
      const field = db.get('SELECT price_full FROM fishing_field WHERE id = ?', bookRow.field_id);
      const price = field ? field.price_full : 0;
      db.run(
        `INSERT INTO orders (user_id, field_id, book_id, money, create_time, status, order_date, order_time, people_num)
         VALUES (?,?,?,?,?,1,?,?,?)`,
        bookRow.user_id, bookRow.field_id, bid, price, H.now(),
        bookRow.book_time, bookRow.book_period, bookRow.people_num
      );
    }
    return res.type('html').send(H.alertGo('预约已确认，订单生成成功！', 'admin_book.php'));
  }

  // 取消预约
  if (req.query.cancel !== undefined) {
    db.run('UPDATE booking SET status = 2 WHERE id = ?', H.intval(req.query.cancel));
    return res.type('html').send(H.alertGo('预约已取消！', 'admin_book.php'));
  }

  const bookList = db.all(
    `SELECT b.*, u.username, f.field_name
     FROM booking b
     LEFT JOIN users u ON b.user_id = u.id
     LEFT JOIN fishing_field f ON b.field_id = f.id
     ORDER BY b.book_time DESC`
  );

  const rows = bookList.length
    ? bookList
        .map((item) => {
          let statusHtml;
          if (Number(item.status) === 0) statusHtml = '<span class="status-wait">待确认</span>';
          else if (Number(item.status) === 1) statusHtml = '<span class="status-ok">已确认</span>';
          else statusHtml = '<span class="status-cancel">已取消</span>';

          const oper =
            Number(item.status) === 0
              ? `<a href="?confirm=${item.id}" class="oper-ok" onclick="return confirm('确认通过该预约？将自动生成收费订单')">确认预约</a>
                                <a href="?cancel=${item.id}" class="oper-no" onclick="return confirm('确定取消该预约？')">取消预约</a>`
              : '无操作';

          return `
                    <tr>
                        <td>${item.id}</td>
                        <td>${H.esc(item.username)}</td>
                        <td>${H.esc(item.field_name)}</td>
                        <td>${H.esc(item.book_time)}</td>
                        <td>${H.esc(item.book_period)}</td>
                        <td>${item.people_num} 人</td>
                        <td>
                            ${statusHtml}
                        </td>
                        <td>
                            ${oper}
                        </td>
                    </tr>`;
        })
        .join('')
    : `
                    <tr>
                        <td colspan="8">暂无任何预约数据</td>
                    </tr>`;

  const body = `                <h3>全部钓友预约记录</h3>
                <table>
                    <tr>
                        <th>预约ID</th>
                        <th>钓友账号</th>
                        <th>预约钓场</th>
                        <th>预约日期</th>
                        <th>预约时段</th>
                        <th>预约人数</th>
                        <th>预约状态</th>
                        <th>操作</th>
                    </tr>${rows}
                </table>`;
  res.type('html').send(layoutWithUser('admin_book.php', '预约管理', body, req.session.admin_name));
});

/* =============================== 订单管理 admin_order.php =============================== */
router.get('/admin_order.php', (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.query.act && req.query.oid !== undefined) {
    const oid = H.intval(req.query.oid);
    if (req.query.act === 'pass') db.run('UPDATE orders SET status = 2 WHERE id = ?', oid);
    else if (req.query.act === 'cancel') db.run('UPDATE orders SET status = 3 WHERE id = ?', oid);
    return res.redirect('admin_order.php');
  }

  const allOrder = db.all(
    `SELECT o.*, f.field_name, f.img_url
     FROM orders o
     LEFT JOIN fishing_field f ON o.field_id = f.id
     ORDER BY o.id DESC`
  );

  const items = allOrder.length
    ? allOrder
        .map((o) => {
          let tag;
          if (Number(o.status) === 1) tag = '<span class="status-tag tag-wait">待审核</span>';
          else if (Number(o.status) === 2) tag = '<span class="status-tag tag-pass">已通过</span>';
          else tag = '<span class="status-tag tag-cancel">已取消</span>';

          const oper =
            Number(o.status) === 1
              ? `<a href="?act=pass&oid=${o.id}" class="btn-pass">通过</a>
                    <a href="?act=cancel&oid=${o.id}" class="btn-cancel">驳回</a>`
              : '<span style="font-size:12px;color:#999;">已处理</span>';

          return `
        <div class="order-item">
            <img src="${H.esc(o.img_url)}" class="order-img">
            <div class="order-info">
                <h4>
                    钓场：${H.esc(o.field_name)}
                    ${tag}
                </h4>
                <p>用户ID：${o.user_id} | 日期：${H.esc(o.order_date)}</p>
                <p>时段：${H.esc(o.order_time)} | 人数：${o.people_num}人</p>
            </div>
            <div>
                ${oper}
            </div>
        </div>`;
        })
        .join('')
    : '        <p style="text-align:center;color:#999;padding:20px 0;">暂无预约数据</p>';

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>管理员-预约管理</title>
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
    max-width:700px;
    margin:0 auto;
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
/* 预约条目 */
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
/* 操作按钮 */
.btn-pass{
    padding:6px 10px;
    background:#4caf50;
    color:#fff;
    border:none;
    border-radius:6px;
    font-size:12px;
    text-decoration:none;
    margin-right:5px;
}
.btn-cancel{
    padding:6px 10px;
    background:#ff4444;
    color:#fff;
    border:none;
    border-radius:6px;
    font-size:12px;
    text-decoration:none;
}
</style>
</head>
<body>
<a href="admin_index.php" class="back">← 返回后台</a>

<div class="box">
    <h2>📋 全部预约管理</h2>
${items}
</div>
</body>
</html>`);
});

module.exports = router;
