'use strict';

/**
 * 表结构 + 初始数据。
 * 结构与数据均来自原 MySQL 库 `fishing` 的导出（mysqldump），
 * 只做必要调整以让原程序中失效的功能真正可用：
 *   - users 增加 signature / email / reg_time（原表缺失，导致个人中心三处永远为空、改资料报错）
 *   - fishing_images.title 放开 NOT NULL + UNIQUE（原表约束导致后台上传轮播图必然失败）
 *   - contact_msg 合并 user.php 与 contact.php 两套字段
 *   - orders 补齐 admin_book.php 需要的 book_id / money
 *
 * 注意：本文件用于公开仓库。
 *  - 钓友账号已脱敏：用户名统一为 diaoyou01~06，密码哈希重新加盐生成，
 *    手机号/住址等个人信息已清除。
 *  - 后台账号为 admin / 123456（仅演示用），密码同样以 bcrypt 加盐存储，
 *    不再使用原库中可秒破的 MD5。code 里仍保留对历史 MD5 的兼容校验，
 *    便于已有部署平滑迁移。
 *
 * 另新增 login_attempt 表，用于后台登录失败次数限制（防暴力破解）。
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nickname TEXT DEFAULT '',
  create_time TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  create_time TEXT,
  nickname TEXT,
  phone TEXT,
  gender TEXT,
  address TEXT,
  avatar TEXT DEFAULT 'https://picsum.photos/id/1005/120/120',
  signature TEXT DEFAULT '热爱钓鱼，享受生活',
  email TEXT,
  reg_time TEXT
);

CREATE TABLE IF NOT EXISTS booking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  field_id INTEGER NOT NULL,
  book_time TEXT NOT NULL,
  book_period TEXT NOT NULL,
  people_num INTEGER NOT NULL DEFAULT 1,
  status INTEGER NOT NULL DEFAULT 0,
  add_time TEXT
);

CREATE TABLE IF NOT EXISTS chat_msg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  msg TEXT NOT NULL,
  add_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collect (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT,
  tid INTEGER,
  add_time TEXT
);

CREATE TABLE IF NOT EXISTS contact_msg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  msg_content TEXT NOT NULL,
  add_time TEXT NOT NULL,
  user_id INTEGER,
  username TEXT
);

CREATE TABLE IF NOT EXISTS fish_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  intro TEXT,
  img_url TEXT DEFAULT '',
  feed TEXT
);

CREATE TABLE IF NOT EXISTS fishing_field (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  field_name TEXT NOT NULL,
  field_desc TEXT NOT NULL,
  img_url TEXT DEFAULT '',
  fish_type TEXT,
  price_half INTEGER DEFAULT 0,
  price_full INTEGER DEFAULT 0,
  price_night INTEGER DEFAULT 0,
  fish_price TEXT,
  free_time TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS fishing_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  img_url TEXT NOT NULL,
  create_time TEXT
);

CREATE TABLE IF NOT EXISTS forum_post (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  create_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history_avatar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  avatar_name TEXT NOT NULL,
  upload_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  field_id INTEGER NOT NULL,
  order_date TEXT,
  order_time TEXT,
  people_num INTEGER NOT NULL DEFAULT 1,
  create_time TEXT,
  status INTEGER NOT NULL DEFAULT 1,
  book_id INTEGER,
  money INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempt (
  scope TEXT NOT NULL,
  ip TEXT NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_fail INTEGER NOT NULL DEFAULT 0,
  lock_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, ip)
);
`;

const SEED = {
  // 后台演示账号：admin / 123456。存 bcrypt 加盐哈希（$2y$ 前缀，对齐 PHP password_hash），
  // 不再沿用原库的 MD5 —— 无盐 MD5 在公开仓库里等于直接公开明文。
  admin: [
    [1, 'admin', '$2y$10$2SLyD52Uu.mHHQK1lgSkB.e9aRfLUZV9ovbDzZYKtjQFUQVd9H7FO', '超级管理员', '2026-06-15 14:45:49'],
  ],
  // 演示账号：已脱敏。用户名统一为 diaoyou01~06，密码统一 123456；
  // 密码哈希为重新加盐生成，与任何真实账号无关联。
  users: [
    [1, 'diaoyou01', '$2a$10$HI0M7ERrGF80ifNOP8UKSOQLqupzQnSl4l4cELYCARrZ9OcMS/D0a', '2026-05-29 02:42:21', null, null, '男', null, '1_1781666426.png'],
    [2, 'diaoyou02', '$2a$10$w4s6TyPXpGvE5hyXZngs4eR4ptVDoKzESQ6C6NGDDmdbrolsjZm9m', '2026-06-01 06:46:45', '管理员', null, null, null, 'https://picsum.photos/id/1005/120/120'],
    [3, 'diaoyou03', '$2a$10$7sfu306aabbQPXQwpu8NweppNXQJm2MQsF6ia1Zx0cbDh6udCjAKy', '2026-06-18 03:37:53', null, null, null, null, 'https://picsum.photos/id/1005/120/120'],
    [4, 'diaoyou04', '$2a$10$yL.7yDxnlzc7yXdBQdcc2ualuOj3DOcY7oXQ9m.ZJ/MhUkDeZzbzW', '2026-06-18 07:42:09', null, null, null, null, '4_1781768678.png'],
    [5, 'diaoyou05', '$2a$10$OxdYcs4aHdevMbUh3pDrHO.7QrCIwNv4izdCx3ouBcdfO6Xs4L4De', '2026-06-18 08:37:16', null, null, null, null, '5_1781772011.png'],
    [6, 'diaoyou06', '$2a$10$FfFg7TPi05os1VM0fuETKOsToq5.xqtHxIVtp11yorBODPrlDn19O', '2026-06-18 08:57:10', null, null, null, null, '6_1781773134.png'],
  ],
  booking: [
    [1, 1, 1, '2026-06-20', '08:00-12:00', 2, 1, '2026-06-18 08:23:44'],
    [2, 1, 2, '2026-06-21', '全天场', 1, 1, '2026-06-18 08:23:44'],
    [3, 2, 3, '2026-06-22', '夜场18:00-22:00', 3, 2, '2026-06-18 08:23:44'],
    [4, 3, 1, '2026-06-23', '09:00-13:00', 1, 2, '2026-06-18 08:23:44'],
    [5, 2, 5, '2026-06-24', '全天场', 2, 1, '2026-06-18 08:23:44'],
  ],
  chat_msg: [
    [1, '', 'hhh', '2026-06-10 10:26:19'],
    [2, '', '1', '2026-06-10 10:30:04'],
  ],
  fish_types: [
    [4, '青鱼', '力气大，被钓鱼人称为“水中霸王”，喜欢吃螺类，体型可达几十斤。', 'uploads/fish/13.png', '螺蛳肉、蚌肉、螺鲤、颗粒饵'],
    [2, '鲤鱼', '生命力强，体型较大，多在底层觅食，喜欢拱泥找食，警惕性高。', 'uploads/fish/11.png', '螺鲤、老坛玉米、红薯、商品饵'],
    [3, '草鱼', '食草性鱼类，生长快，个体大，喜欢在中上层水域活动，夏季活跃度高。', 'uploads/fish/12.png', '嫩玉米、青草饵料、颗粒饵、商品草鱼饵'],
    [6, '鲢鱼', '上层水域滤食性鱼类，喜食浮游生物，对酸臭饵料兴趣浓厚。', 'uploads/fish/15.png', '酸臭鲢鳙饵、豆腐渣、发酵饵'],
    [5, '鳊鱼', '肉质细嫩，适合垂钓，多在中层水域活动，喜食植物性饵料。', 'uploads/fish/14.png', '麸皮饵、奶香商品饵、嫩玉米、青草'],
    [12, '黄颡鱼', '俗称黄辣丁，肉食性鱼类，喜食腥味饵料，夜间活跃度高。', 'uploads/fish/21.png', '蚯蚓、红虫、鸡肝、腥味商品饵'],
    [10, '翘嘴', '上层掠食性鱼类，游速快，喜食小鱼，是路亚和手竿的热门目标鱼。', 'uploads/fish/19.png', '活虾、泥鳅、路亚亮片、米诺'],
    [11, '白条', '小型上层杂鱼，分布极广，抢食凶猛，多被当作“闹窝”鱼，也可作钓。', 'uploads/fish/20.png', '苍蝇、面食、小钩拉饵'],
    [9, '罗非鱼', '热带鱼种，生长快，食性杂，喜欢腥香饵料，在南方水域常见。', 'uploads/fish/18.png', '冷冻肝味饵、腥味商品饵、蚯蚓'],
    [8, '鲈鱼', '凶猛肉食性鱼类，路亚首选鱼种，捕食小鱼小虾，冲击力强。', 'uploads/fish/17.png', '小鱼虾、路亚软饵、米诺、VIB'],
    [7, '鳙鱼', '俗称胖头鱼，滤食性鱼类，头部大，肉质鲜美，喜食酸臭/草莓味饵料。', 'uploads/fish/16.png', '草莓味鲢鳙饵、酸臭饵、豆腐渣'],
    [13, '鲶鱼', '底层肉食性鱼类，喜食腐肉，夜间觅食活跃，体型可长到很大。', 'uploads/fish/22.png', '蚯蚓、鸡肝、泥鳅、腥味商品饵'],
    [14, '鳜鱼', '凶猛肉食性鱼类，伏击捕食，肉质细嫩，是名贵淡水鱼。', 'uploads/fish/23.png', '活饵小鱼虾、路亚软饵'],
    [15, '马口鱼', '小型溪流鱼种，喜清水急流，体色艳丽，适合路亚钓法。', 'uploads/fish/24.png', '路亚亮片、小钩飞蝇、活饵'],
  ],
  fishing_field: [
    [1, '青山湖钓场', '环境优美，鱼种丰富，收费50元/天', 'uploads/fish/5.png', '鲫鱼,鲤鱼,草鱼', 50, 100, 80, '鲤鱼15元/斤，草鱼20元/斤', '08:00-20:00'],
    [2, '碧水湾垂钓园', '深水鱼塘，大鱼多，适合竞技钓', 'uploads/fish/6.png', '翘嘴,鳊鱼,黄辣丁', 80, 150, 120, '按现场计价，禁止带走保护鱼类', '07:00-22:00'],
    [3, '红星水库', '自然水域，可夜钓，停车方便', 'uploads/fish/7.png', '青鱼,草鱼,鲤鱼', 60, 120, 100, '免费带走，限重5斤/人', '06:00-18:00'],
    [4, '田园垂钓中心', '农家乐+钓鱼一体，适合家庭游玩', 'uploads/fish/8.png', '鲶鱼,黑鱼,鲫鱼', 40, 80, 60, '鲫鱼12元/斤，其他鱼15元/斤', '09:00-21:00'],
    [5, '渔乐钓场', '高密度鱼塘，新手也能爆护', 'uploads/fish/9.png', '鲫鱼,鳊鱼,翘嘴', 50, 100, 80, '部分鱼种免费，按现场规则为准', '08:00-21:00'],
  ],
  fishing_images: [
    [1, '乡村钓场环境1', 'uploads/fish/1.png', '2026-05-29 02:30:53'],
    [2, '乡村钓场环境2', 'uploads/fish/2.png', '2026-05-29 02:30:53'],
    [3, '乡村钓场环境3', 'uploads/fish/3.png', '2026-05-29 02:30:53'],
    [4, '乡村钓场环境4', 'uploads/fish/4.png', '2026-05-29 02:30:53'],
  ],
  history_avatar: [
    [1, 1, '1_1781666426.png', '2026-06-17 11:20:26'],
    [2, 4, '4_1781768678.png', '2026-06-18 15:44:38'],
    [3, 5, '5_1781772011.png', '2026-06-18 16:40:11'],
    [4, 6, '6_1781773134.png', '2026-06-18 16:58:54'],
  ],
  orders: [
    [1, 1, 3, '2026-06-09', '全天', 5, '2026-06-08 15:06:15', 1],
    [3, 1, 1, '2026-06-11', '上午 8:00-12:00', 1, '2026-06-08 15:08:55', 3],
    [5, 1, 5, '2026-06-12', '上午 8:00-12:00', 7, '2026-06-08 15:30:28', 1],
    [6, 1, 1, '2026-06-02', '上午 8:00-12:00', 1, '2026-06-08 15:33:31', 3],
    [7, 1, 1, '2026-06-18', '上午 8:00-12:00', 1, '2026-06-08 15:53:32', 1],
    [8, 4, 3, '2026-06-19', '上午 8:00-12:00', 4, '2026-06-18 15:43:40', 1],
    [9, 5, 2, '2026-06-20', '上午 8:00-12:00', 1, '2026-06-18 16:38:36', 1],
    [10, 1, 1, '2026-06-05', '上午 8:00-12:00', 8, '2026-06-18 16:46:30', 1],
    [11, 6, 3, '2026-06-19', '下午 13:00-18:00', 7, '2026-06-18 16:58:07', 1],
  ],
};

module.exports = { SCHEMA, SEED };
