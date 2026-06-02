import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COOKIE_FILE = path.join(__dirname, '../../data/cookies.json');

/**
 * Cookie 管理服务地址（懒读取，确保 dotenv 已加载后才取值）
 */
function getCookieManagerUrl() {
  return (process.env.COOKIE_MANAGER_URL || '').replace(/\/$/, '');
}

/**
 * 从 Cookie 管理服务获取有效 Cookie（内部函数）
 * @returns {Promise<Object|null>}
 */
function fetchCookieFromManager() {
  const COOKIE_MANAGER_URL = getCookieManagerUrl();
  if (!COOKIE_MANAGER_URL) return Promise.resolve(null);

  return new Promise(resolve => {
    const url = `${COOKIE_MANAGER_URL}/api/accounts/cookie`;
    const mod = url.startsWith('https') ? https : http;

    const req = mod.get(url, { timeout: 3000 }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.success && data.data?.cookies) {
            const uid = data.data.uid || '?';
            console.log(`🍪 [Cookie管理服务] 已获取账号 UID:${uid} 的 Cookie`);
            resolve(data.data.cookies);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
  const dataDir = path.dirname(COOKIE_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * 保存Cookie到文件
 * @param {Object} cookies - Cookie对象
 */
export function saveCookies(cookies) {
  try {
    ensureDataDir();
    const data = {
      cookies,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(data, null, 2));
    console.log('✅ Cookies已保存到本地');
    return true;
  } catch (error) {
    console.error('❌ 保存Cookies失败:', error);
    return false;
  }
}

/**
 * 从文件加载Cookie（本地回退逻辑）
 * @returns {Object|null}
 */
function loadCookiesFromFile() {
  try {
    if (!fs.existsSync(COOKIE_FILE)) {
      console.log('⚠️  未找到保存的Cookies');
      return null;
    }

    const data = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));

    // 检查Cookie是否过期(30天)
    const daysPassed = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
    if (daysPassed > 30) {
      console.log('⚠️  Cookies已过期');
      return null;
    }

    console.log(`✅ 已加载保存的Cookies (保存于 ${data.date})`);
    return data.cookies;
  } catch (error) {
    console.error('❌ 加载Cookies失败:', error);
    return null;
  }
}

/**
 * 加载 Cookie：优先从 Cookie 管理服务获取，失败时回退到本地文件
 * @returns {Promise<Object|null>}
 */
export async function loadCookies() {
  // 1. 尝试 Cookie 管理服务（仅在配置了 COOKIE_MANAGER_URL 时）
  if (getCookieManagerUrl()) {
    const remoteCookies = await fetchCookieFromManager();
    if (remoteCookies) return remoteCookies;
    console.warn('⚠️  Cookie管理服务不可用，回退到本地文件');
  }
  // 2. 回退：本地 cookies.json
  return loadCookiesFromFile();
}

/**
 * 加载 Cookie 并返回来源信息
 * @returns {Promise<{cookies: Object|null, source: 'remote'|'local'|null}>}
 */
export async function loadCookiesWithSource() {
  if (getCookieManagerUrl()) {
    const remoteCookies = await fetchCookieFromManager();
    if (remoteCookies) return { cookies: remoteCookies, source: 'remote' };
    console.warn('⚠️  Cookie管理服务不可用，回退到本地文件');
  }
  const localCookies = loadCookiesFromFile();
  return { cookies: localCookies, source: localCookies ? 'local' : null };
}

/**
 * 清除保存的Cookie
 */
export function clearCookies() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      fs.unlinkSync(COOKIE_FILE);
      console.log('✅ Cookies已清除');
    }
    return true;
  } catch (error) {
    console.error('❌ 清除Cookies失败:', error);
    return false;
  }
}

/**
 * 获取Cookie字符串(用于HTTP请求)
 * @param {Object} cookies - Cookie对象
 * @returns {string} - Cookie字符串
 */
export function getCookieString(cookies) {
  if (!cookies) return '';
  
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}
