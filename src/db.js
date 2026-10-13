'use strict';

/**
 * SQLite 数据访问层。
 * 优先使用 Node 内置的 node:sqlite（Node >= 22.5，无需安装任何依赖）；
 * 若运行环境不支持，则回退到可选的 better-sqlite3。
 * 两者 API 高度一致，这里做一层薄封装。
 */

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'fishing.db');

function openDatabase() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  try {
    const { DatabaseSync } = require('node:sqlite');
    const raw = new DatabaseSync(DB_FILE);
    return { driver: 'node:sqlite', raw };
  } catch (err) {
    try {
      const Database = require('better-sqlite3');
      const raw = new Database(DB_FILE);
      return { driver: 'better-sqlite3', raw };
    } catch (err2) {
      throw new Error(
        '无法初始化 SQLite：当前 Node 版本既没有内置 node:sqlite，也未安装 better-sqlite3。\n' +
          '请使用 Node 22.5 以上版本运行，或执行 npm install better-sqlite3。\n' +
          'node:sqlite 错误：' +
          err.message +
          '\nbetter-sqlite3 错误：' +
          err2.message
      );
    }
  }
}

const { driver, raw } = openDatabase();

/** 把 undefined / boolean 规整为 SQLite 可接受的绑定值 */
function normalize(params) {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'number' && !Number.isFinite(p)) return null;
    return p;
  });
}

function exec(sql) {
  raw.exec(sql);
}

function run(sql, ...params) {
  const stmt = raw.prepare(sql);
  const res = stmt.run(...normalize(params));
  return {
    changes: Number(res.changes || 0),
    lastInsertRowid: Number(res.lastInsertRowid || 0),
  };
}

function get(sql, ...params) {
  const stmt = raw.prepare(sql);
  const row = stmt.get(...normalize(params));
  return row === undefined ? null : row;
}

function all(sql, ...params) {
  const stmt = raw.prepare(sql);
  return stmt.all(...normalize(params));
}

module.exports = { driver, raw, exec, run, get, all, DB_FILE };
