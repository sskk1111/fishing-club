'use strict';

/**
 * 登录失败限制（防暴力破解）。
 *
 * 背景：原 PHP 版本的后台登录没有任何失败次数限制，可以无限次尝试密码；
 * 叠加管理后台密码为弱口令的场景，等于给了攻击者无限次的爆破机会。
 *
 * 策略：按「作用域 + 客户端 IP」计数，滑动窗口内失败达到上限即锁定一段时间。
 *  - 窗口内（WINDOW_MS）累计失败 MAX_FAILS 次 → 锁定 LOCK_MS
 *  - 成功登录立即清零
 *  - 超过窗口未再失败则计数自动作废
 *
 * 记录落库（SQLite），因此进程重启后锁定依然有效。
 * 客户端 IP 取自 req.ip —— server.js 里已设 `trust proxy`，
 * 线上经平台网关转发时能拿到真实来源 IP。
 */

const db = require('./db');

const MAX_FAILS = 5;              // 窗口内允许的失败次数
const WINDOW_MS = 15 * 60 * 1000; // 计数窗口 15 分钟
const LOCK_MS = 15 * 60 * 1000;   // 锁定时长 15 分钟

/** 取客户端 IP；取不到时归入 unknown，避免因为缺失而完全不计数 */
function clientIp(req) {
  const ip = (req && (req.ip || (req.socket && req.socket.remoteAddress))) || '';
  return String(ip).replace(/^::ffff:/, '') || 'unknown';
}

function readRow(scope, ip) {
  return db.get(
    'SELECT fail_count, last_fail, lock_until FROM login_attempt WHERE scope = ? AND ip = ?',
    scope,
    ip
  );
}

/**
 * 登录前置检查。
 * @returns {{locked: boolean, retryAfterMin: number}}
 */
function check(scope, ip) {
  const now = Date.now();
  const row = readRow(scope, ip);
  if (!row) return { locked: false, retryAfterMin: 0 };
  if (row.lock_until && row.lock_until > now) {
    return {
      locked: true,
      retryAfterMin: Math.max(1, Math.ceil((row.lock_until - now) / 60000)),
    };
  }
  return { locked: false, retryAfterMin: 0 };
}

/** 记录一次失败，达到上限则锁定 */
function onFail(scope, ip) {
  const now = Date.now();
  const row = readRow(scope, ip);
  let count = 1;
  if (row && row.last_fail && now - row.last_fail <= WINDOW_MS) {
    count = Number(row.fail_count || 0) + 1;
  }
  const lockUntil = count >= MAX_FAILS ? now + LOCK_MS : 0;
  db.run(
    `INSERT INTO login_attempt (scope, ip, fail_count, last_fail, lock_until)
     VALUES (?,?,?,?,?)
     ON CONFLICT(scope, ip) DO UPDATE SET
       fail_count = excluded.fail_count,
       last_fail  = excluded.last_fail,
       lock_until = excluded.lock_until`,
    scope,
    ip,
    count,
    now,
    lockUntil
  );
  return { count, locked: lockUntil > 0 };
}

/** 登录成功，清空该来源的失败计数 */
function onSuccess(scope, ip) {
  db.run('DELETE FROM login_attempt WHERE scope = ? AND ip = ?', scope, ip);
}

module.exports = { clientIp, check, onFail, onSuccess, MAX_FAILS, WINDOW_MS, LOCK_MS };
