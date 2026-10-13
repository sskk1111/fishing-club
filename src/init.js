'use strict';

/** 建表 + 首次运行灌入初始数据（来自原 MySQL 库的导出） */

const { exec, get, run } = require('./db');
const { SCHEMA, SEED } = require('./schema');

function seed() {
  const row = get('SELECT COUNT(*) AS c FROM users');
  if (row && Number(row.c) > 0) return false; // 已有数据，不重复灌入

  run(
    `INSERT OR REPLACE INTO admin (id,username,password,nickname,create_time) VALUES (?,?,?,?,?)`,
    ...SEED.admin[0]
  );

  for (const u of SEED.users) {
    run(
      `INSERT OR REPLACE INTO users
       (id,username,password,create_time,nickname,phone,gender,address,avatar,signature,email,reg_time)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[7], u[8],
      '热爱钓鱼，享受生活', null, u[3]
    );
  }

  for (const r of SEED.booking) {
    run(
      `INSERT OR REPLACE INTO booking
       (id,user_id,field_id,book_time,book_period,people_num,status,add_time)
       VALUES (?,?,?,?,?,?,?,?)`,
      ...r
    );
  }

  for (const r of SEED.chat_msg) {
    run(`INSERT OR REPLACE INTO chat_msg (id,username,msg,add_time) VALUES (?,?,?,?)`, ...r);
  }

  for (const r of SEED.fish_types) {
    run(`INSERT OR REPLACE INTO fish_types (id,name,intro,img_url,feed) VALUES (?,?,?,?,?)`, ...r);
  }

  for (const r of SEED.fishing_field) {
    run(
      `INSERT OR REPLACE INTO fishing_field
       (id,field_name,field_desc,img_url,fish_type,price_half,price_full,price_night,fish_price,free_time)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ...r
    );
  }

  for (const r of SEED.fishing_images) {
    run(`INSERT OR REPLACE INTO fishing_images (id,title,img_url,create_time) VALUES (?,?,?,?)`, ...r);
  }

  for (const r of SEED.history_avatar) {
    run(
      `INSERT OR REPLACE INTO history_avatar (id,user_id,avatar_name,upload_time) VALUES (?,?,?,?)`,
      ...r
    );
  }

  for (const r of SEED.orders) {
    run(
      `INSERT OR REPLACE INTO orders
       (id,user_id,field_id,order_date,order_time,people_num,create_time,status)
       VALUES (?,?,?,?,?,?,?,?)`,
      ...r
    );
  }

  return true;
}

function init() {
  exec(SCHEMA);
  const didSeed = seed();
  return didSeed;
}

module.exports = { init };
