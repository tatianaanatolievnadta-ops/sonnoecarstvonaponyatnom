/**
 * Cloudflare Worker для ЮKassa (секретный ключ только здесь).
 *
 * Установка (один раз):
 * 1. https://dash.cloudflare.com → Workers → Create
 * 2. Вставь этот код
 * 3. Settings → Variables:
 *    YOOKASSA_SHOP_ID = твой shopId
 *    YOOKASSA_SECRET_KEY = секретный ключ
 * 4. Deploy → скопируй URL воркера в data/yookassa.js:
 *    createPaymentUrl: "https://XXXX.workers.dev/create"
 *    checkPaymentUrl: "https://XXXX.workers.dev/status"
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const shopId = env.YOOKASSA_SHOP_ID;
    const secret = env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secret) {
      return json({ error: "keys_missing" }, 500, cors);
    }

    if (url.pathname === "/create" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return json({ error: "bad_json" }, 400, cors);
      }
      const item = String(body.item || "sub");
      const amount = String(body.amount || "");
      const description = String(body.description || "Сонное царство").slice(0, 128);
      const returnUrl = String(body.return_url || "");
      if (!amount || !returnUrl) {
        return json({ error: "amount_or_return_missing" }, 400, cors);
      }

      const idem = crypto.randomUUID();
      const auth = btoa(`${shopId}:${secret}`);
      const res = await fetch("https://api.yookassa.ru/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Idempotence-Key": idem,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: { value: amount, currency: "RUB" },
          capture: true,
          confirmation: { type: "redirect", return_url: returnUrl },
          description,
          metadata: { item }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        return json({ error: "yookassa", detail: data }, res.status, cors);
      }
      return json(
        {
          id: data.id,
          status: data.status,
          confirmation_url: data.confirmation && data.confirmation.confirmation_url
        },
        200,
        cors
      );
    }

    if (url.pathname === "/status" && request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id_missing" }, 400, cors);
      const auth = btoa(`${shopId}:${secret}`);
      const res = await fetch("https://api.yookassa.ru/v3/payments/" + encodeURIComponent(id), {
        headers: { Authorization: `Basic ${auth}` }
      });
      const data = await res.json();
      if (!res.ok) return json({ error: "yookassa", detail: data }, res.status, cors);
      return json(
        {
          id: data.id,
          status: data.status,
          paid: !!data.paid,
          item: data.metadata && data.metadata.item
        },
        200,
        cors
      );
    }

    return json({ ok: true, routes: ["/create", "/status"] }, 200, cors);
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors }
  });
}
