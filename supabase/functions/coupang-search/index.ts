// Supabase Edge Function: coupang-search
//
// research/index.html(쇼핑 쇼츠 리서치)이 호출한다. 쿠팡 파트너스 오픈API의 "상품검색"을
// 그대로 프록시해서, 키워드로 검색한 쿠팡 상품(이름/가격/이미지/로켓배송 여부/링크)을 돌려준다.
// SECRET_KEY를 브라우저에 노출하면 안 되므로, keyword-tool의 keyword-search 함수와
// 동일한 패턴으로 이 함수가 서버 쪽에서 서명해 대신 호출하는 역할만 한다.
//
// 주의: 쿠팡 파트너스 상품검색 API는 리뷰수/평점/판매량을 제공하지 않는다 (상품명/가격/
// 이미지/링크/로켓배송여부/랭킹만 제공). 리뷰수 등은 이 API로는 얻을 수 없다.
// 또한 이 API는 1시간에 최대 10회로 호출 제한이 매우 빡빡하니, 프론트에서 남용하지 않게 주의.
//
// 배포 방법 (Supabase CLI 필요, 최초 1회):
//   1) npm install -g supabase
//   2) supabase login
//   3) supabase link --project-ref mguhphgvzwftzzwmuklg
//   4) supabase secrets set COUPANG_ACCESS_KEY=xxxx COUPANG_SECRET_KEY=xxxx
//      (partners.coupang.com 마이페이지 > API 정보에서 발급 — COUPANG_SETUP.md 참고)
//   5) supabase functions deploy coupang-search
//
// 배포 후 클라이언트에서 호출하는 URL:
//   https://mguhphgvzwftzzwmuklg.supabase.co/functions/v1/coupang-search?keyword=무선청소기

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const ACCESS_KEY = Deno.env.get("COUPANG_ACCESS_KEY");
const SECRET_KEY = Deno.env.get("COUPANG_SECRET_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOMAIN = "https://api-gateway.coupang.com";
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";

// 쿠팡 API가 요구하는 signed-date: "YYMMDD'T'HHMMSS'Z'" (UTC 기준, 구분자 없음)
function signedDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yy = pad(d.getUTCFullYear() % 100);
  const MM = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const HH = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${yy}${MM}${dd}T${HH}${mm}${ss}Z`;
}

// message = signed-date + method + path + query (구분자 없이 이어붙임), HMAC-SHA256 → hex
async function sign(message: string, secretKey: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
  return Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ACCESS_KEY || !SECRET_KEY) {
      throw new Error(
        "COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY가 설정되지 않았습니다 " +
          "(supabase secrets set ... — COUPANG_SETUP.md 참고)",
      );
    }

    const url = new URL(req.url);
    const keyword = (url.searchParams.get("keyword") || "").trim();
    if (!keyword) throw new Error("keyword 파라미터가 없습니다");
    const limit = Math.min(Math.max(+(url.searchParams.get("limit") || 20), 1), 50);

    const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
    const datetime = signedDate();
    const signature = await sign(`${datetime}GET${PATH}${query}`, SECRET_KEY);
    const authorization =
      `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;

    const resp = await fetch(`${DOMAIN}${PATH}?${query}`, {
      method: "GET",
      headers: { Authorization: authorization },
    });

    const raw = await resp.json().catch(() => null);
    if (!resp.ok || !raw || (raw.rCode && raw.rCode !== "0")) {
      const detail = (raw && (raw.rMessage || raw.message)) || `HTTP ${resp.status}`;
      throw new Error(`쿠팡 파트너스 API 오류: ${detail}`);
    }

    const list: Record<string, unknown>[] = Array.isArray(raw?.data?.productData) ? raw.data.productData : [];
    const items = list.map((p) => ({
      productId: p.productId,
      name: p.productName,
      price: p.productPrice,
      image: p.productImage,
      url: p.productUrl,
      isRocket: !!p.isRocket,
      isFreeShipping: !!p.isFreeShipping,
      rank: p.rank,
    }));

    return new Response(
      JSON.stringify({ ok: true, keyword, items }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
