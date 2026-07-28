// ============================================================
// Cloudflare Worker — 抗美援朝战役日记 API
// 使用 KV 存储战役数据，支持多端同步
// ============================================================

interface BattleCampaign {
  id: string;
  name: string;
  nameEn: string;
  startDate: string;
  endDate: string;
  coordinates: { lat: number; lng: number };
  location: string;
  result: 'victory' | 'stalemate' | 'defeat' | 'withdrawal';
  resultSummary: string;
  diaryEntry: string;
  participatingUnits: string[];
  significance: string;
  imageUrl?: string;
}

interface Env {
  KMYC_BATTLES: KVNamespace;
}

const KV_KEY = 'battles';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ============================================================
// 从 KV 读取全部战役
// ============================================================
async function getBattles(env: Env): Promise<BattleCampaign[]> {
  const raw = await env.KMYC_BATTLES.get(KV_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ============================================================
// 写入全部战役到 KV
// ============================================================
async function putBattles(env: Env, battles: BattleCampaign[]): Promise<void> {
  await env.KMYC_BATTLES.put(KV_KEY, JSON.stringify(battles));
}

// ============================================================
// Worker 入口
// ============================================================
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // ---- GET /api/battles → 获取全部战役 ----
    if (request.method === 'GET' && url.pathname === '/api/battles') {
      const battles = await getBattles(env);
      return new Response(JSON.stringify({ battles, count: battles.length }), {
        headers: CORS_HEADERS,
      });
    }

    // ---- PUT /api/battles → 全量替换（同步） ----
    if (request.method === 'PUT' && url.pathname === '/api/battles') {
      try {
        const body = (await request.json()) as { battles: BattleCampaign[] };
        if (!Array.isArray(body.battles)) {
          return new Response(JSON.stringify({ error: 'Invalid payload' }), {
            status: 400,
            headers: CORS_HEADERS,
          });
        }
        await putBattles(env, body.battles);
        return new Response(
          JSON.stringify({ ok: true, count: body.battles.length }),
          { headers: CORS_HEADERS },
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ error: String(e) }),
          { status: 500, headers: CORS_HEADERS },
        );
      }
    }

    // ---- 404 ----
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: CORS_HEADERS,
    });
  },
};
