import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "tiktok-order-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: cors });
const isObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const pick = (source: Record<string, any>, fields: string[]) =>
  Object.fromEntries(fields.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]]));
const validItems = (items: unknown): items is Record<string, any>[] =>
  Array.isArray(items) && items.every((item) =>
    isObject(item) && typeof item.product_name === "string" && item.product_name.trim() &&
    Number.isInteger(item.quantity) && item.quantity > 0 &&
    Number.isSafeInteger(item.unit_price) && item.unit_price >= 0 &&
    Number.isSafeInteger(item.subtotal) && item.subtotal >= 0
  );

function makeOrderId() {
  const date = new Date();
  const day = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("");
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return `TTS-${day}-${String(random).padStart(6, "0")}`;
}
function extFor(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id")?.trim();
  const phone = url.searchParams.get("nomor_penerima")?.trim();

  try {
    if (req.method === "POST") {
      const body = await req.json();
      if (!isObject(body)) return json({ error: "JSON object is required" }, 400);

      // Signed Storage upload URL. The service-role key never leaves this function.
      if (body.action === "upload-url") {
        if (typeof body.content_type !== "string" || !ALLOWED_TYPES.has(body.content_type)) {
          return json({ error: "Only JPEG, PNG, and WebP images are allowed" }, 415);
        }
        if (!Number.isInteger(body.size) || body.size <= 0 || body.size > MAX_IMAGE_BYTES) {
          return json({ error: "Image size must be between 1 byte and 5 MB" }, 413);
        }
        const path = `orders/${crypto.randomUUID()}.${extFor(body.content_type)}`;
        const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
        if (error) throw error;
        return json({ data: { bucket: BUCKET, path, token: data.token, signedUrl: data.signedUrl } }, 201);
      }

      if (!isObject(body.order)) return json({ error: "JSON body with an order object is required" }, 400);
      const input = body.order;
      for (const field of ["penerima", "nomor_penerima", "alamat_penerima"]) {
        if (typeof input[field] !== "string" || !input[field].trim()) return json({ error: field + " is required" }, 400);
      }
      if (!Number.isSafeInteger(input.subtotal) || input.subtotal < 0) return json({ error: "subtotal must be a non-negative integer" }, 400);
      const items = body.items ?? [];
      if (!validItems(items)) return json({ error: "items contain invalid product or price values" }, 400);
      if (items.reduce((sum, item) => sum + item.subtotal, 0) !== input.subtotal) {
        return json({ error: "subtotal must equal the sum of item subtotals" }, 400);
      }

      const orderFields = ["pengirim", "nomor_pengirim", "kota_pengirim", "penerima", "nomor_penerima", "alamat_penerima", "shipping_date", "subtotal"];
      let created: Record<string, any> | null = null;
      let createError: any = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const candidate = { ...pick(input, orderFields), order_id: makeOrderId(), payment_status: "pending", shipping_status: "unfulfilled" };
        const result = await db.from("tiktok_orders").insert(candidate)
          .select("id, order_id, penerima, nomor_penerima, alamat_penerima, subtotal, payment_status, shipping_status, created_at").single();
        if (!result.error) { created = result.data; break; }
        createError = result.error;
        if (result.error.code !== "23505") throw result.error;
      }
      if (!created) throw createError ?? new Error("Could not allocate order key");

      if (items.length) {
        const rows = items.map((item) => ({ ...pick(item, ["product_name", "product_image_url", "quantity", "weight", "unit_price", "subtotal"]), order_id: created!.id }));
        const { error } = await db.from("tiktok_order_items").insert(rows);
        if (error) {
          await db.from("tiktok_orders").delete().eq("id", created.id);
          throw error;
        }
      }
      const { error: eventError } = await db.from("tiktok_order_events").insert({
        order_id: created.id, event_type: "order_created",
        new_value: { order_id: created.order_id }, actor: "public_api",
      });
      if (eventError) {
        await db.from("tiktok_orders").delete().eq("id", created.id);
        throw eventError;
      }
      return json({ data: created, message: "Order created" }, 201);
    }

    if (!orderId || !phone) return json({ error: "order_id and nomor_penerima are required" }, 400);
    const { data: existing, error: lookupError } = await db.from("tiktok_orders")
      .select("id, order_id, nomor_penerima, payment_status, shipping_status")
      .eq("order_id", orderId).eq("nomor_penerima", phone).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return json({ error: "Order not found" }, 404);

    if (req.method === "GET") {
      const { data, error } = await db.from("tiktok_orders").select("*").eq("id", existing.id).single();
      if (error) throw error;
      return json({ data });
    }

    if (req.method === "PATCH") {
      const body = await req.json();
      if (!isObject(body)) return json({ error: "JSON object is required" }, 400);
      const imagePath = typeof body.payment_evidence_path === "string" ? body.payment_evidence_path.trim() : "";
      if (!imagePath || !imagePath.startsWith("orders/")) return json({ error: "payment_evidence_path is required" }, 400);
      const { data: updated, error } = await db.from("tiktok_orders")
        .update({ payment_evidence_path: imagePath, updated_at: new Date().toISOString() })
        .eq("id", existing.id).eq("payment_status", "pending")
        .select("id, order_id, payment_status, shipping_status, payment_evidence_path, updated_at").maybeSingle();
      if (error) throw error;
      if (!updated) return json({ error: "Evidence can only be submitted for pending orders" }, 409);
      const { error: eventError } = await db.from("tiktok_order_events").insert({
        order_id: existing.id, event_type: "payment_evidence_submitted",
        old_value: null, new_value: { payment_evidence_path: imagePath }, actor: "public_api",
      });
      if (eventError) throw eventError;
      return json({ data: updated, message: "Payment evidence submitted" });
    }

    if (existing.payment_status !== "pending" || existing.shipping_status !== "unfulfilled") {
      return json({ error: "Only pending, unfulfilled orders can be cancelled" }, 409);
    }
    const { data: cancelled, error } = await db.from("tiktok_orders")
      .update({ payment_status: "cancelled", shipping_status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", existing.id).eq("payment_status", "pending").eq("shipping_status", "unfulfilled")
      .select("id, order_id, payment_status, shipping_status, updated_at").maybeSingle();
    if (error) throw error;
    if (!cancelled) return json({ error: "Order state changed; cancellation was not applied" }, 409);
    const { error: eventError } = await db.from("tiktok_order_events").insert({
      order_id: existing.id, event_type: "order_cancelled",
      old_value: { payment_status: existing.payment_status, shipping_status: existing.shipping_status },
      new_value: { payment_status: "cancelled", shipping_status: "cancelled" }, actor: "public_api",
    });
    if (eventError) throw eventError;
    return json({ data: cancelled, message: "Order cancelled; history retained" });
  } catch (error) {
    console.error("crud-tiktok-2:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Request could not be completed" }, 500);
  }
});
