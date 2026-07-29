// ============================================================
// Cloudflare Worker — 抗美援朝战役日记 API
// KV 存储格式: { battles: BattleCampaign[], updatedAt: number }
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

interface StoreData {
  battles: BattleCampaign[];
  updatedAt: number;
}

interface Env {
  KMYC_BATTLES: KVNamespace;
}

const KV_KEY = 'battles';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

async function getStore(env: Env): Promise<StoreData> {
  const raw = await env.KMYC_BATTLES.get(KV_KEY);
  if (!raw) return { battles: [], updatedAt: 0 };
  try {
    const parsed = JSON.parse(raw);
    // 兼容旧格式（裸数组）
    if (Array.isArray(parsed)) {
      return { battles: parsed, updatedAt: 0 };
    }
    return parsed;
  } catch {
    return { battles: [], updatedAt: 0 };
  }
}

async function putStore(env: Env, data: StoreData): Promise<void> {
  await env.KMYC_BATTLES.put(KV_KEY, JSON.stringify(data));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // ---- GET /api/battles → 获取全部（含时间戳） ----
    if (request.method === 'GET' && url.pathname === '/api/battles') {
      const store = await getStore(env);
      return new Response(
        JSON.stringify({ battles: store.battles, updatedAt: store.updatedAt, count: store.battles.length }),
        { headers: CORS_HEADERS },
      );
    }

    // ---- PUT /api/battles → 直接写入（客户端全权负责） ----
    if (request.method === 'PUT' && url.pathname === '/api/battles') {
      try {
        const body = (await request.json()) as { battles: BattleCampaign[]; updatedAt: number };
        if (!Array.isArray(body.battles)) {
          return new Response(JSON.stringify({ error: 'Invalid payload' }), {
            status: 400, headers: CORS_HEADERS,
          });
        }
        await putStore(env, { battles: body.battles, updatedAt: Date.now() });
        return new Response(
          JSON.stringify({ ok: true, updatedAt: now, count: body.battles.length }),
          { headers: CORS_HEADERS },
        );
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500, headers: CORS_HEADERS,
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: CORS_HEADERS,
    });
  },
};
