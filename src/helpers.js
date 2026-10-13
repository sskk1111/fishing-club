'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/** 等价于 PHP htmlspecialchars()，用于所有输出到页面的动态内容 */
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** 等价于 PHP md5() */
function md5(text) {
  return crypto.createHash('md5').update(String(text), 'utf8').digest('hex');
}

/** 等价于 PHP password_hash($pwd, PASSWORD_DEFAULT)，即 bcrypt cost 10 */
function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), 10).replace(/^\$2a\$/, '$2y$');
}

/**
 * 校验密码。原项目里存在两种存储：
 *  - 管理员密码：md5 十六进制（32 位）
 *  - 钓友密码：bcrypt（$2y$ / $2a$ / $2b$）
 * 这里两种都兼容。
 */
function verifyPassword(plain, stored) {
  if (!stored) return false;
  const s = String(stored);
  if (/^[a-f0-9]{32}$/i.test(s)) return md5(plain) === s.toLowerCase();
  if (/^\$2[aby]\$/.test(s)) {
    try {
      return bcrypt.compareSync(String(plain), s.replace(/^\$2y\$/, '$2a$'));
    } catch (e) {
      return false;
    }
  }
  return false;
}

/** 'YYYY-MM-DD HH:mm:ss'，等价于 PHP date("Y-m-d H:i:s") */
function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' + p(d.getMonth() + 1) +
    '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) +
    ':' + p(d.getMinutes()) +
    ':' + p(d.getSeconds())
  );
}

/** 等价于 PHP mb_substr()，按字符（码点）截取 */
function mbSub(text, start, len) {
  const chars = Array.from(String(text === null || text === undefined ? '' : text));
  return chars.slice(start, len === undefined ? undefined : start + len).join('');
}

/** 跳转并提示，等价于 PHP 的 alert + location.href */
function alertGo(message, target) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><script>alert(${JSON.stringify(
    message
  )});location.href=${JSON.stringify(target)};</script></body></html>`;
}

/** alert 后返回上一页 */
function alertBack(message) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><script>alert(${JSON.stringify(
    message
  )});history.back();</script></body></html>`;
}

/** 从 URL 里取整数，等价于 PHP intval($_GET['x']) */
function intval(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/** 取字符串，去首尾空白 */
function str(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

module.exports = { esc, md5, hashPassword, verifyPassword, now, mbSub, alertGo, alertBack, intval, str };
