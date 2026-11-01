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
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const pick = (source: Record<string, any>, fields: string[]) => Object.fromEntries(fields.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]]));
const validItems = (items: unknown): items is Record<string, any>[] => Array.isArray(items) && items.every((item) =>
  isObject(item) && typeof item.product_name === "string" && !!item.product_name.trim() &&
  Number.isInteger(item.quantity) && item.quantity > 0 &&
  Number.isSafeInteger(item.unit_price) && item.unit_price >= 0 &&
  Number.isSafeInteger(item.subtotal) && item.subtotal >= 0
);
function makeOrderId() {
  const d = new Date();
  const day = [d.getUTCFullYear(), String(d.getUTCMonth()+1).padStart(2,"0"), String(d.getUTCDate()).padStart(2,"0")].join("");
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return `TTS-${day}-${String(n).padStart(6,"0")}`;
}
const extension = (type: string) => type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["GET","POST","PATCH","DELETE"].includes(req.method)) return json({ error: "Method not allowed" }, 405);
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !serviceKey) return json({ error: "Server configuration error" }, 500);
  const db = createClient(baseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id")?.trim();
  const phone = url.searchParams.get("nomor_penerima")?.trim();
  try {
    if (req.method === "POST") {
      const body = await req.json();
      if (!isObject(body)) return json({ error: "JSON object is required" }, 400);
      if (body.action === "upload-url") {
        if (typeof body.content_type !== "string" || !ALLOWED_TYPES.has(body.content_type)) return json({ error: "Only JPEG, PNG, and WebP are allowed" }, 415);
        if (!Number.isInteger(body.size) || body.size < 1 || body.size > MAX_IMAGE_BYTES) return json({ error: "Image must be 5 MB or smaller" }, 413);
        const path = `orders/${crypto.randomUUID()}.${extension(body.content_type)}`;
        const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
        if (error) throw error;
        return json({ data: { bucket: BUCKET, path, token: data.token, signedUrl: data.signedUrl } }, 201);
      }
      if (!isObject(body.order)) return json({ error: "JSON body with order is required" }, 400);
      const input = body.order;
      for (const field of ["penerima","nomor_penerima","alamat_penerima"]) {
        if (typeof input[field] !== "string" || !input[field].trim()) return json({ error: field + " is required" }, 400);
      }
      if (!Number.isSafeInteger(input.subtotal) || input.subtotal < 0) return json({ error: "Invalid subtotal" }, 400);
      const items = body.items ?? [];
      if (!validItems(items)) return json({ error: "Invalid items" }, 400);
      if (items.reduce((sum, item) => sum + item.subtotal, 0) !== input.subtotal) return json({ error: "Subtotal must equal item subtotals" }, 400);
      const fields = ["pengirim","nomor_pengirim","kota_pengirim","penerima","nomor_penerima","alamat_penerima","shipping_date","subtotal"];
      let created: Record<string, any> | null = null;
      let lastError: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const result = await db.from("tiktok_orders").insert({
          ...pick(input, fields), order_id: makeOrderId(), payment_status: "pending", shipping_status: "unfulfilled",
        }).select("id, order_id, penerima, nomor_penerima, alamat_penerima, subtotal, payment_status, shipping_status, created_at").single();
        if (!result.error) { created = result.data; break; }
        lastError = result.error;
        if (result.error.code !== "23505") throw result.error;
      }
      if (!created) throw lastError ?? new Error("Order key generation failed");
      if (items.length) {
        const { error } = await db.from("tiktok_order_items").insert(items.map((item) => ({
          ...pick(item, ["product_name","product_image_url","quantity","weight","unit_price","subtotal"]), order_id: created!.id,
        })));
        if (error) {
          await db.from("tiktok_orders").delete().eq("id", created.id);
          throw error;
        }
      }
      const { error: eventError } = await db.from("tiktok_order_events").insert({
        order_id: created.id, event_type: "order_created", new_value: { order_id: created.order_id }, actor: "public_api",
      });
      if (eventError) {
        await db.from("tiktok_orders").delete().eq("id", created.id);
        throw eventError;
      }
      return json({ data: created, message: "Order created" }, 201);
    }
    if (req.method === "PATCH") {
      const body = await req.json();
      const token = req.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
      if (token && isObject(body) && typeof body.order_id === "string" && isObject(body.order)) {
        const { data: authData, error: authError } = await db.auth.getUser(token);
        const role = authData.user?.app_metadata?.role;
        if (authError || !authData.user || !["admin", "superadmin"].includes(role)) {
          return json({ error: "Admin authentication required" }, 401);
        }
        const allowed = ["penerima", "nomor_penerima", "alamat_penerima", "shipping_date", "courier", "tracking_number", "payment_status", "shipping_status"];
        const changes = pick(body.order, allowed);
        if (!Object.keys(changes).length) return json({ error: "No supported order fields supplied" }, 400);
        const { data: current, error: currentError } = await db.from("tiktok_orders").select("*").eq("order_id", body.order_id).maybeSingle();
        if (currentError) throw currentError;
        if (!current) return json({ error: "Order not found" }, 404);
        const { data: updated, error } = await db.from("tiktok_orders").update({
          ...changes, updated_at: new Date().toISOString(),
        }).eq("id", current.id).select("*").single();
        if (error) throw error;
        const { error: eventError } = await db.from("tiktok_order_events").insert({
          order_id: current.id, event_type: "admin_order_updated",
          old_value: pick(current, Object.keys(changes)), new_value: changes,
          actor: authData.user.id,
        });
        if (eventError) throw eventError;
        return json({ data: updated, message: "Order updated" });
      }
    }
    if (!orderId || !phone) return json({ error: "order_id and nomor_penerima are required" }, 400);
    const { data: order, error: lookupError } = await db.from("tiktok_orders")
      .select("id, order_id, nomor_penerima, payment_status, shipping_status")
      .eq("order_id", orderId).eq("nomor_penerima", phone).maybeSingle();
    if (lookupError) throw lookupError;
    if (!order) return json({ error: "Order not found" }, 404);
    if (req.method === "GET") return json({ data: order });
    if (req.method === "PATCH") {
      const body = await req.json();
      const path = isObject(body) && typeof body.payment_evidence_path === "string" ? body.payment_evidence_path.trim() : "";
      if (!path.startsWith("orders/")) return json({ error: "Valid payment_evidence_path is required" }, 400);
      const { data: updated, error } = await db.from("tiktok_orders")
        .update({ payment_evidence_path: path, updated_at: new Date().toISOString() })
        .eq("id", order.id).eq("payment_status", "pending")
        .select("id, order_id, payment_status, shipping_status, payment_evidence_path, updated_at").maybeSingle();
      if (error) throw error;
      if (!updated) return json({ error: "Evidence can only be submitted while payment is pending" }, 409);
      const { error: eventError } = await db.from("tiktok_order_events").insert({
        order_id: order.id, event_type: "payment_evidence_submitted", new_value: { payment_evidence_path: path }, actor: "public_api",
      });
      if (eventError) throw eventError;
      return json({ data: updated, message: "Payment evidence submitted" });
    }
    if (order.payment_status !== "pending" || order.shipping_status !== "unfulfilled") return json({ error: "Order cannot be cancelled" }, 409);
    const { data: cancelled, error } = await db.from("tiktok_orders")
      .update({ payment_status: "cancelled", shipping_status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id).eq("payment_status", "pending").eq("shipping_status", "unfulfilled")
      .select("id, order_id, payment_status, shipping_status, updated_at").maybeSingle();
    if (error) throw error;
    if (!cancelled) return json({ error: "Order state changed" }, 409);
    const { error: eventError } = await db.from("tiktok_order_events").insert({
      order_id: order.id, event_type: "order_cancelled",
      old_value: { payment_status: order.payment_status, shipping_status: order.shipping_status },
      new_value: { payment_status: "cancelled", shipping_status: "cancelled" }, actor: "public_api",
    });
    if (eventError) throw eventError;
    return json({ data: cancelled, message: "Order cancelled" });
  } catch (error) {
    console.error("crud-tiktok-2:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Request could not be completed" }, 500);
  }
});
