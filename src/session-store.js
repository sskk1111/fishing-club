'use strict';

/** express-session 的 SQLite 存储：重启服务后登录状态不丢 */

const session = require('express-session');
const db = require('./db');

class SqliteStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this.ttl = options.ttl || 1000 * 60 * 60 * 24 * 7; // 默认 7 天
  }

  get(sid, callback) {
    try {
      const row = db.get('SELECT data, expires FROM sessions WHERE sid = ?', sid);
      if (!row) return callback(null, null);
      if (Number(row.expires) < Date.now()) {
        db.run('DELETE FROM sessions WHERE sid = ?', sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.data));
    } catch (err) {
      return callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const expires = Date.now() + this.ttl;
      db.run(
        'INSERT OR REPLACE INTO sessions (sid, data, expires) VALUES (?,?,?)',
        sid,
        JSON.stringify(sess),
        expires
      );
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      db.run('DELETE FROM sessions WHERE sid = ?', sid);
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  touch(sid, sess, callback) {
    return this.set(sid, sess, callback);
  }
}

module.exports = SqliteStore;
