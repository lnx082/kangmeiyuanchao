'use strict';
// ============================================================
// 抗美援朝胜利战役日记 — 云端 API（腾讯云 SCF 版）
// 【版本 v5】修复签名 bug：headers['host'] 取不到 { Host } 的值，
//             导致签名串里出现 host=undefined，COS 一直报 SignatureDoesNotMatch
// 触发方式：函数 URL（API 网关触发器已下线，改用函数 URL）
//           同时兼容 API 网关事件格式
// 存储：COS 对象 battles.json（单文件整体读写）
// 接口：GET  <函数URL>/api/battles   读取全部战役（含 updatedAt）
//       PUT  <函数URL>/api/battles   整体写入（客户端全权负责）
// 运行环境：Node.js 16 / 18，零第三方依赖，控制台直接粘贴或上传 zip
// 环境变量：COS_BUCKET / COS_REGION / COS_SECRET_ID / COS_SECRET_KEY
//           CORS_MODE（可选）= platform（默认）| function，见下方说明
// 入口函数：main_handler
// ============================================================

const https = require('https');
const crypto = require('crypto');

// 读取环境变量并清理：去掉首尾空格、去掉误加的成对引号（密钥填错常见原因）
function envClean(name) {
  let v = process.env[name] || '';
  v = v.trim();
  if (v.length >= 2) {
    const first = v.charAt(0);
    const last = v.charAt(v.length - 1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      v = v.slice(1, -1).trim();
    }
  }
  return v;
}

const COS_BUCKET = envClean('COS_BUCKET');
const COS_REGION = envClean('COS_REGION');
const COS_KEY = 'battles.json';
const COS_SECRET_ID = envClean('COS_SECRET_ID');
const COS_SECRET_KEY = envClean('COS_SECRET_KEY');

// ---------- CORS 处理模式 ----------
// platform（默认）：由"函数 URL"平台的 CORS 配置添加响应头，函数不再重复添加，
//                   避免出现两个 Access-Control-Allow-Origin 导致浏览器拒绝请求
// function       ：由函数自己添加 CORS 响应头（平台 CORS 未启用或不通时用这个兜底）
const CORS_MODE = (process.env.CORS_MODE || 'platform').toLowerCase();
const SEND_CORS = CORS_MODE === 'function';

const JSON_HEADER = { 'Content-Type': 'application/json' };
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
// 注意：官方示例中 HttpString 的方法名是小写（put/get），此处按 lowerMethod 控制
function cosAuth(method, pathname, headers, nowSec, lowerMethod) {
  const signTime = `${nowSec - 60};${nowSec + 600}`;
  const methodInSign = lowerMethod ? String(method).toLowerCase() : String(method).toUpperCase();

  // 注意：键名需转小写用于签名，但取值必须用【原始键名】取，
  // 否则 headers['host'] 取不到 { Host: ... } 的值，会拼出 host=undefined
  const headerEntries = Object.keys(headers)
    .map((k) => [k.toLowerCase(), headers[k]])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const headerKeys = headerEntries.map((e) => e[0]);
  const headerStr = headerEntries.map((e) => `${e[0]}=${urlEncode(e[1])}`).join('&');

  // HttpString = Method \n UriPathname \n HttpParameters \n HttpHeaders \n
  const httpString = `${methodInSign}\n${encodePath(pathname)}\n\n${headerStr}\n`;
  // StringToSign = sha1 \n QSignTime \n SHA1(HttpString) \n
  const stringToSign = `sha1\n${signTime}\n${sha1Hex(httpString)}\n`;
  // SignKey = HMAC-SHA1(SecretKey, QKeyTime)（hex 字符串）
  const signKey = hmacSha1Hex(COS_SECRET_KEY, signTime);
  // Signature = HMAC-SHA1(SignKey, StringToSign)
  const signature = hmacSha1Hex(signKey, stringToSign);

  return {
    authorization:
      `q-sign-algorithm=sha1&q-ak=${COS_SECRET_ID}&q-sign-time=${signTime}&q-key-time=${signTime}` +
      `&q-header-list=${headerKeys.join(';')}&q-url-param-list=&q-signature=${signature}`,
    httpString,
    httpStringSha1: sha1Hex(httpString),
    methodInSign,
  };
}

// ---------- 直连 COS（https + 手写签名，无 SDK 依赖） ----------
function cosRequestOnce(method, body, lowerMethod) {
  return new Promise((resolve, reject) => {
    const host = `${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com`;
    const headers = { Host: host };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
    }
    const auth = cosAuth(method, `/${COS_KEY}`, headers, Math.floor(Date.now() / 1000), lowerMethod);
    headers.Authorization = auth.authorization;

    const req = https.request(
      { host, method, path: `/${COS_KEY}`, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            body: data,
            httpString: auth.httpString,
            httpStringSha1: auth.httpStringSha1,
            methodInSign: auth.methodInSign,
          }),
        );
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(body, 'utf8');
    req.end();
  });
}

// 签名方法名大小写以官方示例（小写）为主，若报签名不匹配则自动改用大写重试一次，
// 两种写法都能自动适配；两次都失败时返回信息更全的一次，便于排查密钥问题。
async function cosRequest(method, body) {
  const first = await cosRequestOnce(method, body, true);
  if (isAuthError(first)) {
    const second = await cosRequestOnce(method, body, false);
    if (!isAuthError(second)) return second;
    return Object.assign({}, second, { triedBothCasing: true });
  }
  return first;
}

function isAuthError(res) {
  return res.status === 403 && /SignatureDoesNotMatch|InvalidAccessKeyId|AccessDenied/i.test(res.body || '');
}

function cosError(label, res) {
  return new Error(
    `COS ${label} 失败: HTTP ${res.status}` +
      ` [签署方法名=${res.methodInSign}${res.triedBothCasing ? '（已回退大写重试）' : ''}]` +
      ` sha1(HttpString)=${res.httpStringSha1}` +
      ` | ${String(res.body || '').slice(0, 600)}`,
  );
}

// ---------- 存储读写 ----------
async function readStore() {
  const res = await cosRequest('GET');
  if (res.status === 404) return { battles: [], updatedAt: 0 }; // 首次使用，尚无数据
  if (res.status !== 200) {
    throw cosError('GET', res);
  }
  const parsed = JSON.parse(res.body);
  if (Array.isArray(parsed)) return { battles: parsed, updatedAt: 0 }; // 兼容旧格式（裸数组）
  return parsed;
}

async function writeStore(data) {
  const res = await cosRequest('PUT', JSON.stringify(data));
  if (res.status !== 200 && res.status !== 204) {
    throw cosError('PUT', res);
  }
}

// ---------- 事件解析（兼容 函数URL / API 网关 两种格式） ----------
function parseEvent(event) {
  const ctx = event.requestContext || {};
  const ctxHttp = ctx.http || {};

  const method = String(event.httpMethod || ctxHttp.method || ctx.httpMethod || 'GET').toUpperCase();

  // 函数 URL 未必转发路径，因此不强制校验路径，仅用于错误提示
  const path = String(event.path || ctxHttp.path || ctx.path || '/');

  let raw = '';
  if (typeof event.body === 'string') {
    raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  } else if (event.body && typeof event.body === 'object') {
    raw = JSON.stringify(event.body);
  }

  return { method, path, raw };
}

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: SEND_CORS ? Object.assign({}, JSON_HEADER, CORS_HEADERS) : JSON_HEADER,
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  };
}

// ---------- 入口 ----------
exports.main_handler = async (event) => {
  try {
    const { method, path, raw } = parseEvent(event || {});

    // 预检请求
    if (method === 'OPTIONS') {
      return reply(200, '');
    }

    // GET → 读取全部（含时间戳）
    if (method === 'GET') {
      const store = await readStore();
      return reply(200, {
        battles: store.battles,
        updatedAt: store.updatedAt,
        count: store.battles.length,
      });
    }

    // PUT（兼容 POST）→ 整体写入，客户端全权负责
    if (method === 'PUT' || method === 'POST') {
      const body = JSON.parse(raw || '{}');
      if (!Array.isArray(body.battles)) {
        return reply(400, { error: 'Invalid payload', path });
      }
      const now = Date.now();
      await writeStore({ battles: body.battles, updatedAt: now });
      return reply(200, { ok: true, updatedAt: now, count: body.battles.length });
    }

    return reply(405, { error: 'Method not allowed', method, path });
  } catch (e) {
    return reply(500, { error: String((e && e.message) || e) });
  }
};

// 仅用于本地自测，不影响云端行为
exports.__test = { cosAuth, parseEvent, envClean };
