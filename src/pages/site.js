'use strict';

/** 前台页面 —— 对应 index.php / field_list.php / field_detail.php / fish_list.php /
 *  fish_detail.php / price.php / bait.php / skill.php / chat.php / collect.php /
 *  contact.php / user.php / order.php / get_fish_data.php */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const H = require('../helpers');

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

/** 未登录跳登录页（等价于原项目的 alert + location.href='login.php'） */
function requireUser(req, res) {
  if (!req.session.user_id) {
    res.type('html').send(H.alertGo('请先登录！', 'login.php'));
    return false;
  }
  return true;
}

/* ================================== 首页 index.php ================================== */
router.get('/index.php', (req, res) => {
  if (!req.session.user_login && !req.session.user_id) {
    return res.type('html').send(H.alertGo('请先登录', 'login.php'));
  }

  const banners = db.all('SELECT img_url FROM fishing_images LIMIT 3');
  const fields = db.all('SELECT * FROM fishing_field ORDER BY id ASC LIMIT 5');
  const fishList = db.all('SELECT * FROM fish_types ORDER BY id ASC');

  const bannerHtml = banners
    .map((v, k) => `<img src="${H.esc(v.img_url)}" class="${k === 0 ? 'active' : ''}">`)
    .join('\n            ');

  const fieldHtml = fields
    .map(
      (f) => `
          <div class="grid-item">
            ${f.img_url ? `<img src="${H.esc(f.img_url)}" class="grid-img">` : ''}
            <div class="grid-text">
              <h4>${H.esc(f.field_name)}</h4>
              <p>${H.esc(f.field_desc)}</p>
            </div>
          </div>`
    )
    .join('');

  const fishHtml = fishList
    .map(
      (fish) => `
          <div class="grid-item">
            ${fish.img_url ? `<img src="${H.esc(fish.img_url)}" class="grid-img">` : ''}
            <div class="grid-text">
              <h4>${H.esc(fish.name)}</h4>
              <p>${H.esc(fish.intro)}</p>
            </div>
          </div>`
    )
    .join('');

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>🎣 钓鱼乐园 - 首页</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/weui@2.6.26/dist/style/weui.min.css">
    <link rel="stylesheet" href="weui.css">
    <style>
        :root{
            --primary:#0066aa;
            --primary-light:#e6f2ff;
            --text-dark:#333;
            --text-gray:#666;
            --bg:#f7f9fc;
        }
        body{background:var(--bg);font-family:"Microsoft YaHei",sans-serif;color:var(--text-dark)}
        .page{padding-bottom:70px}

        .top-bar{
            display:flex;align-items:center;justify-content:space-between;
            background:#fff;padding:8px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.05);position:sticky;top:0;z-index:10
        }
        .top-bar__title{font-size:17px;font-weight:bold;color:var(--primary)}
        .top-bar__right{display:flex;align-items:center;gap:8px}
        .search-input{
            width:180px;padding:6px 10px;border:1px solid #ddd;border-radius:20px;
            outline:none;font-size:14px
        }
        .weui-btn_mini{border-radius:20px}

        /* 轮播图 4:3 固定比例 */
        .banner {
          width: 60%;
		  margin: 0 auto;
          aspect-ratio: 5 / 3; /* 核心：4:3 */
          position: relative;
          overflow: hidden;
        }
        .banner img {
          position: absolute;
          width: 100%;
          height: 100%;
          object-fit: cover; /* 按原图比例填满，不变形 */
          opacity: 0;
          transition: opacity 0.6s ease;
        }
        .banner img.active {
          opacity: 1;
        }
		

        .weui-grids{background:#fff;margin:10px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.05);padding:10px 0}
        .weui-grid__icon{font-size:22px;color:var(--primary)}
        .weui-grid__label{font-size:13px;color:var(--text-dark)}

        .section{margin:10px}
        .section__hd{
            font-size:16px;font-weight:bold;padding:10px 12px;background:#fff;
            border-radius:12px 12px 0 0;margin:0
        }
        .section__bd{background:#fff;padding:0 12px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.05)}
        .section-img{
            width:100%;height:200px;object-fit:cover;border-radius:12px;
            box-shadow:0 2px 8px rgba(0,0,0,0.08)
        }

        .weui-cell{padding:12px 0;border-bottom:1px solid #f5f5f5}
        .weui-cell__bd p{font-size:15px;margin:0 0 4px}
        .weui-cell__desc{font-size:13px;color:var(--text-gray)}

        .weui-tabbar{position:fixed;bottom:0;width:100%;background:#fff;box-shadow:0 -2px 8px rgba(0,0,0,0.05)}
        .weui-tabbar__item.weui-tabbar__item_on .weui-tabbar__icon{color:var(--primary)}
        .weui-tabbar__item.weui-tabbar__item_on p{color:var(--primary)}
		
		/* 两列flex容器 */
		.fish-row, .field-row {
		    display: flex;
		    flex-wrap: wrap;
		    gap: 10px;
		    margin: 0 -5px;
		}
		/* 每列 50% 宽 */
		.fish-col, .field-col {
		    width: calc(50% - 10px);
		    padding: 5px;
		    box-sizing: border-box;
		}
		/* 卡片样式 */
		.card {
		    background: #fff;
		    border-radius: 8px;
		    overflow: hidden;
		    box-shadow: 0 0 5px rgba(0,0,0,0.05);
		}
		.card-img {
		    width: 100%;
		    height: 120px;
		    object-fit: cover;
		    display: block;
		}
		.card-body {
		    padding: 8px 10px;
		}
		.card-title {
		    margin: 0 0 4px;
		    font-size: 15px;
		}
		.card-desc {
		    margin: 0;
		    font-size: 12px;
		    color: #666;
		}
		/* 两列网格布局 */
		.grid-box {
		  display: flex;
		  flex-wrap: wrap;
		  gap: 8px;
		  padding: 10px 0;
		}
		.grid-item {
		  width: calc(50% - 4px);
		  box-sizing: border-box;
		}
		/* 图片按原比例显示，不拉伸、不变形 */
		/* 原有布局不动，只修改鱼种图片为一半大小 */
		.grid-img {
		  width: 50%;    /* 关键：图片只有原来一半大 */
		  height: auto;
		  display: block;
		  margin: 0 auto; /* 居中 */
		  border-radius: 8px;
		}
		/* 文字内容 */
		.grid-text {
		  padding: 6px 0;
		  text-align: center;
		}
		.grid-text h4 {
		  font-size: 15px;
		  margin: 0 0 2px;
		}
		.grid-text p {
		  font-size: 12px;
		  color: #666;
		  margin: 0;
		}
    </style>
</head>
<body>
<div class="page">
    <!-- 顶部导航 -->
    <div class="top-bar">
        <div class="top-bar__title">🎣 钓鱼乐园</div>
        <div class="top-bar__right">
            <input type="text" class="search-input" placeholder="搜索钓场/鱼种...">
            <a href="user.php" class="weui-btn weui-btn_mini weui-btn_primary">我的</a>
        </div>
    </div>

    <!-- 轮播图 4:3 比例 -->
    <div class="banner" id="banner">
        ${bannerHtml}
    </div>
	 

    <!-- 功能菜单 -->
    <div class="weui-grids">
        <a href="field_list.php" class="weui-grid">
            <div class="weui-grid__icon">📍</div>
            <p class="weui-grid__label">附近钓场</p>
        </a>
        <a href="fish_list.php" class="weui-grid">
            <div class="weui-grid__icon">🐟</div>
            <p class="weui-grid__label">鱼种大全</p>
        </a>
        <a href="order.php" class="weui-grid">
            <div class="weui-grid__icon">📅</div>
            <p class="weui-grid__label">预约钓位</p>
        </a>
        <a href="price.php" class="weui-grid">
            <div class="weui-grid__icon">💰</div>
            <p class="weui-grid__label">收费标准</p>
        </a>
        <a href="bait.php" class="weui-grid">
            <div class="weui-grid__icon">🌿</div>
            <p class="weui-grid__label">饵料配方</p>
        </a>
        <a href="skill.php" class="weui-grid">
            <div class="weui-grid__icon">📖</div>
            <p class="weui-grid__label">钓鱼技巧</p>
        </a>
        <a href="chat.php" class="weui-grid">
            <div class="weui-grid__icon">💬</div>
            <p class="weui-grid__label">钓友交流</p>
        </a>
        <a href="contact.php" class="weui-grid">
            <div class="weui-grid__icon">📞</div>
            <p class="weui-grid__label">联系我们</p>
        </a>
    </div>

    <!-- 热门钓场 - 两列 -->
    <div class="section">
      <div class="section__hd">热门钓场</div>
      <div class="section__bd">
        <div class="grid-box">${fieldHtml}
        </div>
      </div>
    </div>

    <!-- 常见鱼种 - 两列 -->
    <div class="section">
      <div class="section__hd">常见鱼种</div>
      <div class="section__bd" >
        <div class="grid-box">${fishHtml}
        </div>
      </div>
    </div>

    <!-- 底部导航 -->
    <div class="weui-tabbar">
        <a href="index.php" class="weui-tabbar__item weui-tabbar__item_on">
            <span class="weui-tabbar__icon">🏠</span>
            <p class="weui-tabbar__label">首页</p>
        </a>
        <a href="field_list.php" class="weui-tabbar__item">
            <span class="weui-tabbar__icon">🎣</span>
            <p class="weui-tabbar__label">钓场</p>
        </a>
        <a href="skill.php" class="weui-tabbar__item">
            <span class="weui-tabbar__icon">📖</span>
            <p class="weui-tabbar__label">攻略</p>
        </a>
        <a href="chat.php" class="weui-tabbar__item">
            <span class="weui-tabbar__icon">💬</span>
            <p class="weui-tabbar__label">消息</p>
        </a>
        <a href="user.php" class="weui-tabbar__item">
            <span class="weui-tabbar__icon">👤</span>
            <p class="weui-tabbar__label">我的</p>
        </a>
    </div>
</div>

<script>
let imgs=document.querySelectorAll('.banner img');
let i=0;
if(imgs.length>1){
  setInterval(()=>{
    imgs[i].classList.remove('active');
    i=(i+1)%imgs.length;
    imgs[i].classList.add('active');
  },3500);
}
</script>
</body>
</html>`);
});

/* ============================== 钓场列表 field_list.php ============================== */
router.get('/field_list.php', (req, res) => {
  const keyword = H.str(req.query.keyword);
  let rows;
  if (keyword) {
    const like = `%${keyword}%`;
    rows = db.all(
      `SELECT * FROM fishing_field WHERE field_name LIKE ? OR field_desc LIKE ? OR fish_type LIKE ?`,
      like, like, like
    );
  } else {
    rows = db.all('SELECT * FROM fishing_field');
  }

  const cards = rows.length
    ? rows
        .map((row) => {
          const tags = row.fish_type
            ? row.fish_type.split(',').map((f) => `<span class="fish-tag">${H.esc(f.trim())}</span>`).join('')
            : '<span class="fish-tag">鲫鱼</span><span class="fish-tag">鲤鱼</span>';
          return `
        <!-- 👇 这里加了跳转链接，点击进入详情页 -->
        <a href="field_detail.php?id=${row.id}" class="field-card">
            ${row.img_url ? `<img src="${H.esc(row.img_url)}">` : ''}

            <h4>${H.esc(row.field_name)}</h4>
            <p class="field-desc">${H.esc(row.field_desc)}</p>

            <div>
                ${tags}
            </div>
        </a>`;
        })
        .join('\n    ')
    : '';

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>附近钓场</title>
<style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#f7f9fc;padding:15px;font-family:"Microsoft YaHei",sans-serif;}

    .back{
        display:inline-block;
        padding:8px 14px;
        background:#0066aa;
        color:#fff;
        border-radius:20px;
        text-decoration:none;
        margin-bottom:12px;
    }

    /* 搜索框 */
    .search-box{
        display:flex;
        gap:6px;
        margin-bottom:15px;
    }
    .search-box input{
        flex:1;
        padding:10px 14px;
        border:1px solid #ddd;
        border-radius:20px;
        outline:none;
    }
    .search-box button{
        padding:0 16px;
        background:#0066aa;
        color:#fff;
        border:none;
        border-radius:20px;
    }

    /* 两列布局 */
    .wrap{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
    }
    .field-card{
        width:calc(50% - 5px);
        background:#fff;
        border-radius:12px;
        padding:12px;
        box-shadow:0 2px 6px rgba(0,0,0,0.04);
        text-decoration:none;
        color:inherit;
        display:block;
    }
    .field-card img{
        width:100%;
        height:130px;
        object-fit:cover;
        border-radius:8px;
        margin-bottom:8px;
    }
    .field-card h4{
        font-size:15px;
        margin-bottom:5px;
        color:#333;
    }
    .field-desc{
        font-size:13px;
        color:#666;
        line-height:1.4;
        margin-bottom:8px;
    }

    /* 鱼种标签 */
    .fish-tag{
        display:inline-block;
        font-size:12px;
        color:#0066aa;
        background:#e6f2ff;
        padding:2px 6px;
        border-radius:4px;
        margin-right:4px;
        margin-bottom:4px;
    }

    .empty{
        width:100%;
        text-align:center;
        padding:40px 0;
        color:#999;
    }
</style>
</head>

<body>

<a href="index.php" class="back">← 返回首页</a>

<form class="search-box" method="get" action="field_list.php">
    <input type="text" name="keyword" placeholder="搜索钓场/介绍/鱼种" value="${H.esc(keyword)}">
    <button type="submit">搜索</button>
</form>

<h3 style="margin-bottom:12px;font-size:17px;">
    附近钓场
    ${keyword ? `<span style="color:#0066aa;font-size:14px;">｜搜索：${H.esc(keyword)}</span>` : ''}
</h3>

<div class="wrap">
${rows.length ? cards : '    <div class="empty">暂无匹配钓场</div>'}
</div>

</body>
</html>`);
});

/* ============================== 钓场详情 field_detail.php ============================== */
router.get('/field_detail.php', (req, res) => {
  const id = H.intval(req.query.id);
  const field = db.get('SELECT * FROM fishing_field WHERE id = ?', id);
  if (!field) {
    return res.type('html').send(H.alertGo('钓场不存在！', 'field_list.php'));
  }

  let fishTags;
  if (field.fish_type) {
    fishTags = field.fish_type
      .split(',')
      .map((f) => {
        const name = f.trim();
        const fishRow = db.get('SELECT id FROM fish_types WHERE name = ?', name);
        const fid = fishRow ? fishRow.id : 0;
        return fid
          ? `<a href="fish_detail.php?id=${fid}" class="fish-tag">${H.esc(name)}</a>`
          : `<span class="fish-tag">${H.esc(name)}</span>`;
      })
      .join('\n                    ');
  } else {
    fishTags = '<span class="fish-tag">暂无鱼种</span>';
  }

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${H.esc(field.field_name)} - 钓场详情</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{
    background:#f5f7fa;
    font-family:"Microsoft YaHei",sans-serif;
    padding:20px;
}

/* 返回按钮 */
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

/* 详情卡片 */
.detail-card{
    max-width:550px;
    margin:0 auto;
    background:#fff;
    border-radius:20px;
    overflow:hidden;
    box-shadow:0 5px 15px rgba(0,0,0,0.05);
}

/* 钓场大图 */
.field-img{
    width:100%;
    height:240px;
    object-fit:cover;
}

/* 内容区 */
.detail-body{
    padding:25px;
}

/* 标题 */
.detail-title{
    font-size:22px;
    font-weight:bold;
    color:#222;
    margin-bottom:10px;
}

/* 信息模块 */
.info-item{
    margin:14px 0;
    line-height:1.7;
}
.info-item strong{
    color:#333;
    font-size:15px;
}
.info-item p{
    color:#666;
    font-size:15px;
    margin-top:4px;
}

/* 收费卡片样式 */
.price-item{
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px dashed #eee;
}
.price-item:last-child{
    border-bottom: none;
}
.price-box{
    background: #fff9e6;
    padding: 15px;
    border-radius: 12px;
    margin: 10px 0;
}
.price-title{
    font-weight: bold;
    color: #ff8c00;
    margin-bottom: 10px;
}
.price-text{
    color:#333;
}
.price-money{
    color:#e53935;
    font-weight: bold;
}

/* 鱼种标签（可点击） */
.fish-tag{
    display:inline-block;
    background:#e6f2ff;
    color:#0066aa;
    padding:6px 10px;
    border-radius:8px;
    margin:4px 6px 4px 0;
    font-size:14px;
    text-decoration:none;
}
.fish-tag:hover{
    background:#cce4ff;
}

/* 预约按钮 */
.order-btn{
    display:block;
    width:100%;
    text-align:center;
    background:#0066aa;
    color:#fff;
    padding:14px;
    border-radius:12px;
    margin-top:20px;
    font-size:16px;
    text-decoration:none;
    font-weight:bold;
}
.order-btn:hover{
    background:#005599;
}
</style>
</head>

<body>

<a href="field_list.php" class="back-btn">← 返回钓场列表</a>

<div class="detail-card">
    ${field.img_url ? `<img src="${H.esc(field.img_url)}" class="field-img">` : ''}

    <div class="detail-body">
        <h1 class="detail-title">${H.esc(field.field_name)}</h1>

        <!-- 收费标准 -->
        <div class="info-item">
            <strong>💰 收费标准</strong>
            <div class="price-box">
                <div class="price-item">
                    <span class="price-text">半天垂钓</span>
                    <span class="price-money">¥${field.price_half || 0} 元</span>
                </div>
                <div class="price-item">
                    <span class="price-text">全天垂钓</span>
                    <span class="price-money">¥${field.price_full || 0} 元</span>
                </div>
                <div class="price-item">
                    <span class="price-text">夜间垂钓</span>
                    <span class="price-money">¥${field.price_night || 0} 元</span>
                </div>
                <div class="price-item">
                    <span class="price-text">鱼获收费</span>
                    <span class="price-money">${H.esc(field.fish_price) || '按现场为准'}</span>
                </div>
                <div class="price-item">
                    <span class="price-text">开放时间</span>
                    <span class="price-money">${H.esc(field.free_time) || '暂未设置'}</span>
                </div>
            </div>
        </div>

        <!-- 钓场介绍 -->
        <div class="info-item">
            <strong>📝 钓场介绍</strong>
            <p>${H.esc(field.field_desc)}</p>
        </div>

        <!-- 可钓鱼种 -->
        <div class="info-item">
            <strong>🐟 可钓鱼种</strong>
            <div>
                ${fishTags}
            </div>
        </div>

        <!-- 立即预约按钮 -->
        <a href="order.php?field_id=${field.id}" class="order-btn">🎣 立即预约此钓场</a>
    </div>
</div>

</body>
</html>`);
});

/* =============================== 鱼种列表 fish_list.php =============================== */
router.get('/fish_list.php', (req, res) => {
  const rows = db.all('SELECT * FROM fish_types ORDER BY id DESC');
  const cards = rows
    .map(
      (fish) => `
    <!-- 核心：a 包整个卡片，href 带 id 跳详情 -->
    <a href="fish_detail.php?id=${fish.id}" class="fish-card">
        ${fish.img_url ? `<img src="${H.esc(fish.img_url)}" alt="">` : ''}
        <div class="info">
            <h3>${H.esc(fish.name)}</h3>
            <p>${H.esc(H.mbSub(fish.intro, 0, 50))}...</p>
        </div>
    </a>`
    )
    .join('\n    ');

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>鱼种列表</title>
<style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
        background:#f7f9fc;
        padding:20px;
        font-family:"Microsoft YaHei",sans-serif;
    }
    h2{
        text-align:center;
        margin-bottom:20px;
        color:#333;
    }
    .list-container{
        max-width:800px;
        margin:0 auto;
        display:grid;
        grid-template-columns:repeat(auto-fill, minmax(280px,1fr));
        gap:20px;
    }
    /* 整个卡片可点击 */
    .fish-card{
        background:#fff;
        border-radius:16px;
        overflow:hidden;
        box-shadow:0 4px 12px rgba(0,0,0,0.05);
        text-decoration:none; /* 去掉a下划线 */
        color:#333;
        display:block;
    }
    .fish-card:hover{
        transform:translateY(-4px);
        box-shadow:0 6px 16px rgba(0,0,0,0.08);
    }
    .fish-card img{
        width:100%;
        height:180px;
        object-fit:cover;
    }
    .fish-card .info{
        padding:15px;
    }
    .fish-card h3{
        font-size:18px;
        margin-bottom:8px;
    }
    .fish-card p{
        font-size:14px;
        color:#666;
        line-height:1.6;
    }
    .back{
        display:inline-block;
        padding:10px 18px;
        background:#0066aa;
        color:#fff;
        border-radius:25px;
        text-decoration:none;
        margin-bottom:20px;
        font-size:16px;
    }
</style>
</head>
<body>

<a href="index.php" class="back">← 返回首页</a>

<h2>常见鱼种</h2>

<div class="list-container">
    ${cards}
</div>

</body>
</html>`);
});

/* =============================== 鱼种详情 fish_detail.php =============================== */
router.get('/fish_detail.php', (req, res) => {
  const id = H.intval(req.query.id);
  const fish = db.get('SELECT * FROM fish_types WHERE id = ?', id);
  if (!fish) {
    return res.type('html').send(H.alertGo('鱼种不存在！', 'fish_list.php'));
  }

  const feedTags = fish.feed
    ? fish.feed
        .split('、')
        .map((f) => `<span class="tag">${H.esc(f.trim())}</span>`)
        .join('\n                ')
    : '';

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${H.esc(fish.name)} - 鱼种详情</title>
<style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
        background:#f5f5f5;
        font-family:"Microsoft YaHei",sans-serif;
        padding:20px;
    }
    .back{
        display:inline-block;
        padding:9px 16px;
        background:#0066aa;
        color:#fff;
        text-decoration:none;
        border-radius:20px;
        margin-bottom:20px;
        font-size:15px;
    }
    .back:hover{
        background:#005588;
    }
    .detail-card{
        background:#fff;
        border-radius:12px;
        box-shadow:0 2px 8px rgba(0,0,0,0.06);
        max-width:450px;
        margin:0 auto;
        overflow:hidden;
        text-align:center;
        padding-bottom:20px;
    }
    .detail-card img{
        width:100%;
        height:260px;
        object-fit:cover;
    }
    .detail-card h2{
        font-size:20px;
        margin:15px 0 10px;
        color:#222;
    }
    .detail-card p{
        font-size:15px;
        color:#666;
        line-height:1.8;
        margin:0 20px 10px;
        text-align:left;
    }
    .tag{
        display:inline-block;
        font-size:14px;
        color:#0066aa;
        background:#e6f2ff;
        padding:5px 10px;
        border-radius:6px;
        margin:4px;
    }
</style>
</head>
<body>

<!-- 智能返回上一页，适配从列表/钓场详情进入的场景 -->
<a href="javascript:history.back()" class="back">← 返回</a>

<div class="detail-card">
    ${fish.img_url ? `<img src="${H.esc(fish.img_url)}" alt="${H.esc(fish.name)}">` : ''}
    <h2>${H.esc(fish.name)}</h2>

    <p><strong>简介：</strong>${H.esc(fish.intro)}</p>

    ${
      fish.feed
        ? `<p><strong>推荐饵料：</strong></p>
        <div>
            ${feedTags}
        </div>`
        : ''
    }
</div>

</body>
</html>`);
});

/* ============================= 鱼种关联数据 get_fish_data.php ============================= */
router.get('/get_fish_data.php', (req, res) => {
  const id = H.intval(req.query.id);
  const fishRow = db.get('SELECT name, feed FROM fish_types WHERE id = ?', id);
  if (!fishRow) {
    return res.json({ fishname: '', feed: '', field: '暂无对应钓场' });
  }
  // 原项目用 MySQL 的 find_in_set，这里等价实现
  const names = db
    .all('SELECT field_name, fish_type FROM fishing_field')
    .filter((f) =>
      String(f.fish_type || '')
        .split(',')
        .map((s) => s.trim())
        .includes(fishRow.name)
    )
    .map((f) => f.field_name);

  res.json({
    fishname: fishRow.name,
    feed: fishRow.feed,
    field: names.length ? names.join('、') : '暂无对应钓场',
  });
});

/* ================================ 收费标准 price.php ================================ */
router.get('/price.php', (req, res) => {
  const rows = db.all('SELECT * FROM fishing_field ORDER BY id ASC');
  const cards = rows.length
    ? rows
        .map(
          (row) => `
        <div class="price-card">
            <!-- 钓场头部：图片+名称+开放时间 -->
            <div class="card-head">
                <img class="field-thumb" 
                     src="${row.img_url ? H.esc(row.img_url) : 'images/default.png'}" 
                     alt="${H.esc(row.field_name)}">
                <div class="field-info">
                    <h3>${H.esc(row.field_name)}</h3>
                    <p>开放时间：${row.free_time ? H.esc(row.free_time) : '暂未设置'}</p>
                </div>
            </div>

            <!-- 收费明细 -->
            <div class="price-list">
                <div class="price-row">
                    <span class="row-label">半天垂钓</span>
                    <span class="row-price">¥${parseInt(row.price_half, 10) || 0} 元</span>
                </div>
                <div class="price-row">
                    <span class="row-label">全天垂钓</span>
                    <span class="row-price">¥${parseInt(row.price_full, 10) || 0} 元</span>
                </div>
                <div class="price-row">
                    <span class="row-label">夜间垂钓</span>
                    <span class="row-price">¥${parseInt(row.price_night, 10) || 0} 元</span>
                </div>
                <div class="price-row">
                    <span class="row-label">鱼获计价</span>
                    <span class="row-price">${row.fish_price ? H.esc(row.fish_price) : '按现场规则收费'}</span>
                </div>
            </div>

            <!-- 功能按钮：查看详情 + 立即预约 -->
            <div class="btn-group">
                <a href="field_detail.php?id=${row.id}" class="btn btn-detail">查看钓场详情</a>
                <a href="order.php?field_id=${row.id}" class="btn btn-order">立即预约</a>
            </div>
        </div>`
        )
        .join('\n        ')
    : '';

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>钓场收费标准</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{
    background:#f5f7fa;
    font-family:"Microsoft YaHei",sans-serif;
    padding:20px 15px;
}
/* 通用按钮样式 */
.back-btn{
    display:inline-block;
    padding:10px 20px;
    background:#0066aa;
    color:#fff;
    border-radius:30px;
    text-decoration:none;
    margin-bottom:25px;
    font-size:15px;
    transition: background 0.2s;
}
.back-btn:hover{
    background:#005588;
}
/* 页面标题 */
.page-header{
    text-align:center;
    margin-bottom:30px;
}
.page-title{
    font-size:24px;
    font-weight:bold;
    color:#222;
    margin-bottom:8px;
}
.page-desc{
    font-size:14px;
    color:#888;
}
/* 收费卡片容器 */
.wrap{
    max-width:580px;
    margin:0 auto;
}
/* 主卡片样式 */
.price-card{
    background:#fff;
    border-radius:18px;
    box-shadow:0 4px 12px rgba(0,0,0,0.06);
    padding:20px;
    margin-bottom:20px;
    transition: transform 0.2s, box-shadow 0.2s;
    overflow:hidden;
}
.price-card:hover{
    transform: translateY(-3px);
    box-shadow:0 6px 18px rgba(0,0,0,0.08);
}
/* 钓场头部：图片+名称 */
.card-head{
    display:flex;
    align-items:center;
    gap:15px;
    padding-bottom:15px;
    margin-bottom:15px;
    border-bottom:1px solid #f0f0f0;
}
.field-thumb{
    width:70px;
    height:70px;
    border-radius:12px;
    object-fit:cover;
    background:#eee;
}
.field-info h3{
    font-size:18px;
    color:#222;
    margin-bottom:4px;
}
.field-info p{
    font-size:13px;
    color:#777;
}
/* 收费列表 */
.price-list{
    margin-bottom:18px;
}
.price-row{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:9px 0;
    border-bottom:1px dashed #eeeeee;
    font-size:15px;
}
.price-row:last-child{
    border:none;
}
.row-label{
    color:#555;
}
.row-price{
    color:#e53935;
    font-weight:bold;
}
/* 操作按钮组 */
.btn-group{
    display:flex;
    gap:10px;
    margin-top:10px;
}
.btn{
    flex:1;
    text-align:center;
    padding:11px 0;
    border-radius:10px;
    text-decoration:none;
    font-size:15px;
    transition: opacity 0.2s;
}
.btn:hover{
    opacity:0.9;
}
.btn-detail{
    background:#e6f2ff;
    color:#0066aa;
    border:1px solid #0066aa;
}
.btn-order{
    background:#0066aa;
    color:#fff;
}
/* 空数据提示 */
.empty-tip{
    text-align:center;
    padding:60px 0;
    color:#999;
    font-size:15px;
}
</style>
</head>
<body>

<!-- 改为 JS 历史回退：从哪页进来就返回哪页 -->
<a href="javascript:history.back()" class="back-btn">← 返回上一页</a>

<div class="page-header">
    <h2 class="page-title">💰 全钓场收费标准</h2>
    <p class="page-desc">明码标价 · 透明收费 · 在线预约</p>
</div>

<div class="wrap">
    ${rows.length ? cards : '        <div class="empty-tip">暂无钓场数据，请先添加钓场</div>'}
</div>

</body>
</html>`);
});

/* ================================ 饵料配方 bait.php ================================ */
const BAIT_LIST = [
  {
    name: '经典鲫鱼饵',
    fish: ['鲫鱼'],
    recipe: '蓝鲫30% + 九一八40% + 速攻20% + 拉丝粉10%',
    method: '温水搅拌，静置3分钟，揉成团即可使用',
    effect: '腥香结合，诱鱼快，留鱼久',
  },
  {
    name: '鲤鱼酒香饵',
    fish: ['鲤鱼'],
    recipe: '螺鲤2号40% + 天下鲤30% + 玉米粉20% + 酒米10%',
    method: '偏干散，挂钩可搓可拉，主攻底层鲤鱼',
    effect: '浓腥酒香，针对滑口鲤鱼效果极佳',
  },
  {
    name: '草鱼青鱼嫩玉米饵',
    fish: ['草鱼', '青鱼'],
    recipe: '新鲜甜玉米 + 蜂蜜少量 + 曲酒浸泡2小时',
    method: '直接挂钩，钓底或钓浮均可',
    effect: '天然谷物香，专攻大体型草鱼青鱼',
  },
  {
    name: '综合通杀饵',
    fish: ['鲫鱼', '鲤鱼', '罗非', '草鱼'],
    recipe: '九一八50% + 蓝鲫30% + 雪花粉20%',
    method: '野塘、河流通用，拉饵作钓',
    effect: '广谱性极强，四季通用',
  },
  {
    name: '罗非冷冻饵',
    fish: ['罗非'],
    recipe: '冷冻肝味饵60% + 腥味饵40% + 猪母奶少量',
    method: '解冻拌匀，搓饵挂钩',
    effect: '浓腥浓肝味，大罗非疯狂开口',
  },
];

router.get('/bait.php', (req, res) => {
  const cards = BAIT_LIST.map((item) => {
    const tags = item.fish
      .map((f) => {
        const row = db.get('SELECT id FROM fish_types WHERE name = ?', f);
        const fid = row ? row.id : 0;
        return `<a href="fish_detail.php?id=${fid}" class="fish-tag">${H.esc(f)}</a>`;
      })
      .join('\n                ');
    return `
    <div class="bait-card">
        <div class="bait-title">${item.name}</div>

        <div>
            ${tags}
        </div>

        <div class="recipe-box">
            <span class="label">配方：</span>
            ${item.recipe}
        </div>

        <div class="text">
            <span class="label">用法：</span>
            ${item.method}
        </div>
        <div class="text">
            <span class="label">效果：</span>
            ${item.effect}
        </div>
    </div>`;
  }).join('\n    ');

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>饵料配方大全</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
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
}
.page-title{
    text-align:center;
    font-size:22px;
    font-weight:bold;
    margin-bottom:25px;
}
.wrap{
    max-width:550px;
    margin:0 auto;
}
.bait-card{
    background:#fff;
    border-radius:16px;
    padding:20px;
    margin-bottom:18px;
    box-shadow:0 4px 10px rgba(0,0,0,0.05);
}
.bait-title{
    font-size:17px;
    font-weight:bold;
    color:#222;
    margin-bottom:8px;
}
.fish-tag{
    display:inline-block;
    background:#e6f2ff;
    color:#0066aa;
    padding:4px 8px;
    border-radius:6px;
    font-size:13px;
    margin-right:6px;
    margin-bottom:6px;
    text-decoration:none;
}
.recipe-box{
    background:#f8fff0;
    padding:10px;
    border-radius:8px;
    margin:10px 0;
    font-size:14px;
    color:#333;
}
.label{
    font-weight:bold;
    color:#0066aa;
    margin-right:4px;
}
.text{
    font-size:14px;
    color:#555;
    line-height:1.5;
    margin-top:6px;
}
</style>
</head>
<body>

<a href="javascript:history.back()" class="back-btn">← 返回上一页</a>
<h2 class="page-title">🎣 饵料配方大全</h2>

<div class="wrap">
    ${cards}
</div>

</body>
</html>`);
});

/* ================================ 钓鱼技巧 skill.php ================================ */
const SKILL_CARDS = [
  {
    title: '钓鱼选位技巧',
    body: `<p>钓鱼七分钓位三分钓技，选对位置渔获翻倍！</p>
            <p>1. <strong>春季</strong>：选浅滩、水草边、向阳避风处，水温升温快，鱼儿觅食活跃。</p>
            <p>2. <strong>夏季</strong>：选深水、树荫、入水口、风口位置，溶氧量高，鱼避暑聚集。</p>
            <p>3. <strong>秋季</strong>：远近皆宜，深浅结合，是全年最好钓鱼季节。</p>
            <p>4. <strong>冬季</strong>：选深水、向阳、无风位置，深水温稳鱼集中。</p>`,
  },
  {
    title: '调漂入门技巧',
    body: `<p>调漂是钓鱼核心，灵钝决定中鱼率。</p>
            <p><strong>调四钓二（通用标准）</strong>：空钩半水调4目，挂饵钓2目，适合野钓鲫鱼、鲤鱼。</p>
            <p><strong>调钝</strong>：风浪大、走水、杂鱼多时使用，过滤虚假信号。</p>
            <p><strong>调灵</strong>：鱼口轻、冬季低温、滑口鱼使用，信号更灵敏。</p>`,
  },
  {
    title: '打窝留鱼技巧',
    body: `<p>钓鱼不打窝，渔获不会多！</p>
            <p>1. <strong>少量勤打</strong>：切忌一次性重窝，容易喂饱鱼。</p>
            <p>2. <strong>远近双窝</strong>：主窝作钓，副窝备用，跑鱼不空军。</p>
            <p>3. <strong>季节打窝</strong>：春夏腥香，秋冬浓腥、酒香诱鱼更强。</p>`,
  },
  {
    title: '四季作钓核心口诀',
    body: `<p><strong>春钓浅、夏钓深</strong></p>
            <p><strong>秋钓边、冬钓潭</strong></p>
            <p>春季钓早晚、夏季钓夜间、秋季钓全天、冬季钓正午。</p>
            <p>刮风钓风口、下雨钓入水口、晴天钓浅、阴天钓深。</p>`,
  },
  {
    title: '正确提竿技巧',
    body: `<p>提竿过早容易空竿，过晚容易跑鱼。</p>
            <p>1. <strong>鲫鱼</strong>：顶漂、轻顿即可提竿。</p>
            <p>2. <strong>鲤鱼</strong>：黑漂、走漂后延迟0.5秒提竿。</p>
            <p>3. <strong>草鱼</strong>：大幅度下顿、拉黑漂再提竿。</p>
            <p>提竿力度短促有力，不要大力猛拉，防止断线跑鱼。</p>`,
  },
  {
    title: '线组搭配技巧',
    body: `<p>小鱼用细线小钩，大鱼用粗线大钩。</p>
            <p><strong>鲫鱼</strong>：主线1.0 + 子线0.6 / 0.8</p>
            <p><strong>鲤鱼</strong>：主线2.0 + 子线1.2 / 1.5</p>
            <p><strong>草鱼青鱼</strong>：主线3.0+ 子线2.0+</p>
            <p>线组越精细，鱼口越好，越不容易警惕。</p>`,
  },
];

router.get('/skill.php', (req, res) => {
  const cards = SKILL_CARDS.map(
    (c) => `
    <div class="skill-card">
        <div class="skill-title">${c.title}</div>
        <div class="skill-desc">
            ${c.body}
        </div>
    </div>`
  ).join('\n');

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>钓鱼技巧大全</title>
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
    margin-bottom:30px;
}
.wrap{
    max-width:580px;
    margin:0 auto;
}
.skill-card{
    background:#fff;
    border-radius:16px;
    padding:22px;
    margin-bottom:20px;
    box-shadow:0 4px 12px rgba(0,0,0,0.05);
}
.skill-title{
    font-size:18px;
    font-weight:bold;
    color:#0066aa;
    margin-bottom:12px;
    display:flex;
    align-items:center;
}
.skill-title::before{
    content:"💡";
    margin-right:8px;
}
.skill-desc{
    font-size:14px;
    color:#555;
    line-height:1.8;
}
.skill-desc p{
    margin:8px 0;
}
</style>
</head>
<body>

<a href="javascript:history.back()" class="back-btn">← 返回上一页</a>
<h2 class="page-title">🎣 钓鱼技巧大全</h2>

<div class="wrap">

${cards}

</div>

</body>
</html>`);
});

/* ================================ 钓友交流 chat.php ================================ */
router.get('/chat.php', (req, res) => {
  // 未登录也能进聊天室，但需要有个显示名（原项目此时用户名为空）
  const userName = req.session.username || '钓友游客';
  const rows = db.all('SELECT * FROM chat_msg ORDER BY id DESC LIMIT 50');

  const listHtml = rows.length
    ? rows
        .map(
          (row) => `
            <div class="msg-item">
                <span class="msg-user">${H.esc(row.username)}</span>
                <span class="msg-time">${H.esc(row.add_time)}</span>
                <div class="msg-content">${H.esc(row.msg)}</div>
            </div>`
        )
        .join('')
    : '            <div class="empty-tip">暂无聊天消息，快来发言吧！</div>';

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>钓友聊天室</title>
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
    margin:0 auto 20px;
    background:#fff;
    border-radius:16px;
    padding:20px;
    box-shadow:0 4px 12px rgba(0,0,0,0.05);
}
/* 聊天记录区域 */
.chat-box{
    height: 400px;
    overflow-y: auto;
    border: 1px solid #eee;
    border-radius:10px;
    padding:15px;
    margin-bottom:15px;
}
.msg-item{
    margin-bottom:12px;
    line-height:1.6;
}
.msg-user{
    color:#0066aa;
    font-weight:bold;
}
.msg-time{
    font-size:12px;
    color:#999;
    margin-left:8px;
}
.msg-content{
    font-size:14px;
    color:#333;
    margin-top:4px;
    padding-left:5px;
}
/* 发送区域 */
.send-area{
    display:flex;
    gap:10px;
}
.send-area input{
    flex:1;
    padding:12px;
    border:1px solid #eee;
    border-radius:10px;
    font-size:15px;
    outline:none;
}
.send-btn{
    padding:12px 20px;
    background:#0066aa;
    color:#fff;
    border:none;
    border-radius:10px;
    font-size:15px;
    cursor:pointer;
    white-space:nowrap;
}
.send-btn:hover{
    background:#005599;
}
.empty-tip{
    text-align:center;
    color:#999;
    padding:40px 0;
}
</style>
</head>
<body>

<a href="javascript:history.back()" class="back-btn">← 返回上一页</a>
<h2 class="page-title">💬 钓友在线聊天室</h2>

<div class="box">
    <!-- 聊天记录 -->
    <div class="chat-box">
${listHtml}
    </div>

    <!-- 发送消息表单 -->
    <form method="post" class="send-area">
        <input type="text" name="msg" placeholder="输入消息（当前昵称：${H.esc(userName)}）" required>
        <button class="send-btn">发送</button>
    </form>
</div>

</body>
</html>`);
});

router.post('/chat.php', (req, res) => {
  const userName = req.session.username || '钓友游客';
  const msg = H.str(req.body.msg);
  if (msg) {
    db.run('INSERT INTO chat_msg (username, msg, add_time) VALUES (?,?,?)', userName, msg, H.now());
  }
  res.redirect('chat.php');
});

/* ================================ 我的收藏 collect.php ================================ */
router.get('/collect.php', (req, res) => {
  if (!requireUser(req, res)) return;
  const userId = req.session.user_id;

  if (req.query.del !== undefined) {
    db.run('DELETE FROM collect WHERE id = ? AND user_id = ?', H.intval(req.query.del), userId);
    return res.redirect('collect.php');
  }

  const rows = db.all(
    `SELECT c.*, f.field_name, f.img_url
     FROM collect c
     LEFT JOIN fishing_field f ON c.tid = f.id AND c.type = 'field'
     WHERE c.user_id = ?
     ORDER BY c.add_time DESC`,
    userId
  );

  const listHtml = rows.length
    ? rows
        .map(
          (row) => `
        <div class="collect-item">
            ${
              row.img_url
                ? `<img src="${H.esc(row.img_url)}" class="collect-img">`
                : '<div class="collect-img"></div>'
            }
            <div class="collect-info">
                <h4>${H.esc(row.field_name || '未知内容')}</h4>
                <p>收藏时间：${H.esc(row.add_time)}</p>
            </div>
            <a href="?del=${row.id}" class="del-btn" onclick="return confirm('确定取消收藏？')">取消</a>
        </div>`
        )
        .join('')
    : '        <div class="empty-tip">暂无收藏内容，快去挑选喜欢的钓场吧~</div>';

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>我的收藏</title>
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
    margin:0 auto;
    background:#fff;
    border-radius:16px;
    padding:22px;
    box-shadow:0 4px 12px rgba(0,0,0,0.05);
}
.collect-item{
    display:flex;
    align-items:center;
    padding:15px 0;
    border-bottom:1px solid #f0f0f0;
}
.collect-item:last-child{
    border-bottom:none;
}
.collect-img{
    width:70px;
    height:70px;
    border-radius:10px;
    object-fit:cover;
    background:#eee;
}
.collect-info{
    flex:1;
    margin:0 15px;
}
.collect-info h4{
    font-size:16px;
    color:#222;
    margin-bottom:6px;
}
.collect-info p{
    font-size:13px;
    color:#888;
}
.del-btn{
    padding:6px 12px;
    background:#ff4444;
    color:#fff;
    border:none;
    border-radius:6px;
    font-size:13px;
    cursor:pointer;
    text-decoration:none;
}
.empty-tip{
    text-align:center;
    color:#999;
    padding:40px 0;
    font-size:15px;
}
</style>
</head>
<body>

<a href="javascript:history.back()" class="back-btn">← 返回上一页</a>
<h2 class="page-title">⭐ 我的收藏</h2>

<div class="box">
${listHtml}
</div>

</body>
</html>`);
});

/* ================================ 联系我们 contact.php ================================ */
router.get('/contact.php', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>联系我们</title>
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
    margin-bottom:15px;
    font-size:17px;
}
/* 联系方式区域 */
.info-item{
    font-size:15px;
    color:#555;
    line-height:2;
    margin:8px 0;
}
.info-item strong{
    color:#222;
    width:80px;
    display:inline-block;
}
/* 表单样式 */
.form-item{
    margin-bottom:12px;
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
.form-item textarea{
    height:120px;
    resize:none;
}
.btn-submit{
    width:100%;
    padding:13px;
    background:#0066aa;
    color:#fff;
    border:none;
    border-radius:10px;
    font-size:16px;
    cursor:pointer;
}
.btn-submit:hover{
    background:#005599;
}
</style>
</head>
<body>

<a href="javascript:history.back()" class="back-btn">← 返回上一页</a>
<h2 class="page-title">📞 联系我们</h2>

<!-- 平台联系方式 -->
<div class="box">
    <h3>官方联系方式</h3>
    <div class="info-item">
        <strong>联系电话：</strong>13800138000
    </div>
    <div class="info-item">
        <strong>电子邮箱：</strong>fishing@163.com
    </div>
    <div class="info-item">
        <strong>客服微信：</strong>FishingClub001
    </div>
    <div class="info-item">
        <strong>工作时间：</strong>周一至周日 08:00 - 22:00
    </div>
    <div class="info-item">
        <strong>地址：</strong>垂钓休闲俱乐部服务中心
    </div>
</div>

<!-- 在线留言 -->
<div class="box">
    <h3>在线留言</h3>
    <form method="post">
        <div class="form-item">
            <input type="text" name="name" placeholder="请输入您的姓名" required>
        </div>
        <div class="form-item">
            <input type="tel" name="phone" placeholder="请输入联系电话（选填）">
        </div>
        <div class="form-item">
            <input type="email" name="email" placeholder="请输入邮箱（选填）">
        </div>
        <div class="form-item">
            <textarea name="content" placeholder="请输入您的咨询、建议或留言..." required></textarea>
        </div>
        <button class="btn-submit">提交留言</button>
    </form>
</div>

</body>
</html>`);
});

router.post('/contact.php', (req, res) => {
  const name = H.str(req.body.name);
  const phone = H.str(req.body.phone);
  const email = H.str(req.body.email);
  const content = H.str(req.body.content);

  if (!name || !content) {
    return res.type('html').send(H.alertBack('姓名和留言内容不能为空！'));
  }

  db.run(
    `INSERT INTO contact_msg (contact_name, contact_phone, contact_email, msg_content, add_time, user_id, username)
     VALUES (?,?,?,?,?,?,?)`,
    name, phone, email, content, H.now(),
    req.session.user_id || null, req.session.username || null
  );
  res.type('html').send(H.alertGo('留言提交成功，我们会尽快回复您！', 'contact.php'));
});

module.exports = { router, requireUser, PUBLIC_DIR };
