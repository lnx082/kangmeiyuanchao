'use strict';
// ============================================================
// 抗美援朝胜利战役日记 — 云端 API（腾讯云 SCF 版）
// 存储：COS 对象 battles.json（单文件整体读写）
// 接口：GET /api/battles   读取全部战役（含 updatedAt）
//       PUT /api/battles   整体写入（客户端全权负责）
// 运行环境：Node.js 16 / 18，零第三方依赖，控制台直接粘贴
// 环境变量：COS_BUCKET / COS_REGION / COS_SECRET_ID / COS_SECRET_KEY
// 入口函数：main_handler
// ============================================================

const https = require('https');
const crypto = require('crypto');

const COS_BUCKET = process.env.COS_BUCKET || '';
const COS_REGION = process.env.COS_REGION || '';
const COS_KEY = 'battles.json';
const COS_SECRET_ID = process.env.COS_SECRET_ID || '';
const COS_SECRET_KEY = process.env.COS_SECRET_KEY || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ---------- 工具 ----------
function urlEncode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

// COS 规范：路径分隔符 '/' 不编码
function encodePath(pathname) {
  return pathname
    .split('/')
    .map(urlEncode)
    .join('/');
}

function sha1Hex(str) {
  return crypto.createHash('sha1').update(str).digest('hex');
}

function hmacSha1Hex(key, str) {
  return crypto.createHmac('sha1', key).update(str).digest('hex');
}

// ---------- COS 请求签名（q-sign-algorithm=sha1，官方算法） ----------
// 参考：腾讯云 COS《请求签名》https://cloud.tencent.com/document/product/436/7778
function cosAuth(method, pathname, headers, nowSec) {
  const signTime = `${nowSec - 60};${nowSec + 600}`;

  const headerKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const headerStr = headerKeys
    .map((k) => `${k}=${urlEncode(headers[k])}`)
    .join('&');

  // HttpString = Method \n UriPathname \n HttpParameters \n HttpHeaders \n
  const httpString = `${method}\n${encodePath(pathname)}\n\n${headerStr}\n`;
  // StringToSign = sha1 \n QSignTime \n SHA1(HttpString) \n
  const stringToSign = `sha1\n${signTime}\n${sha1Hex(httpString)}\n`;
  // SignKey = HMAC-SHA1(SecretKey, QKeyTime)（hex 字符串）
  const signKey = hmacSha1Hex(COS_SECRET_KEY, signTime);
  // Signature = HMAC-SHA1(SignKey, StringToSign)
  const signature = hmacSha1Hex(signKey, stringToSign);

  return (
    `q-sign-algorithm=sha1&q-ak=${COS_SECRET_ID}&q-sign-time=${signTime}&q-key-time=${signTime}` +
    `&q-header-list=${headerKeys.join(';')}&q-url-param-list=&q-signature=${signature}`
  );
}

// ---------- 直连 COS（https + 手写签名，无 SDK 依赖） ----------
function cosRequest(method, body) {
  return new Promise((resolve, reject) => {
    const host = `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`;
    const headers = { Host: host };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
    }
    headers.Authorization = cosAuth(method, `/${COS_KEY}`, headers, Math.floor(Date.now() / 1000));

    const req = https.request(
      { host, method, path: `/${COS_KEY}`, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(body, 'utf8');
    req.end();
  });
}

// ---------- 存储读写 ----------
async function readStore() {
  const res = await cosRequest('GET');
  if (res.status === 404) return { battles: [], updatedAt: 0 }; // 首次使用，尚无数据
  if (res.status !== 200) {
    throw new Error(`COS GET 失败: HTTP ${res.status} ${res.body.slice(0, 200)}`);
  }
  const parsed = JSON.parse(res.body);
  if (Array.isArray(parsed)) return { battles: parsed, updatedAt: 0 }; // 兼容旧格式（裸数组）
  return parsed;
}

async function writeStore(data) {
  const res = await cosRequest('PUT', JSON.stringify(data));
  if (res.status !== 200 && res.status !== 204) {
    throw new Error(`COS PUT 失败: HTTP ${res.status} ${res.body.slice(0, 200)}`);
  }
}

// ---------- 入口 ----------
exports.main_handler = async (event) => {
  try {
    const method = (event.httpMethod || '').toUpperCase() || 'GET';
    const path = event.path || '/';

    // 预检请求
    if (method === 'OPTIONS') {
      return { statusCode: 200, headers: CORS, body: '' };
    }

    if (!path.endsWith('/api/battles')) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
    }

    // GET /api/battles → 读取全部（含时间戳）
    if (method === 'GET') {
      const store = await readStore();
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          battles: store.battles,
          updatedAt: store.updatedAt,
          count: store.battles.length,
        }),
      };
    }

    // PUT /api/battles → 整体写入（客户端全权负责）
    if (method === 'PUT') {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8')
        : (event.body || '');
      const body = JSON.parse(raw);
      if (!Array.isArray(body.battles)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid payload' }) };
      }
      const now = Date.now();
      await writeStore({ battles: body.battles, updatedAt: now });
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ok: true, updatedAt: now, count: body.battles.length }),
      };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: String((e && e.message) || e) }),
    };
  }
};
