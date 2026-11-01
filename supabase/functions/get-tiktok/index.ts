import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id")?.trim();
  const phone = url.searchParams.get("nomor_penerima")?.trim();
  if (!orderId || !phone) return json({ error: "order_id and nomor_penerima are required" }, 400);
  if (orderId.length > 100 || phone.length > 30) return json({ error: "Invalid lookup parameters" }, 400);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error } = await db.from("tiktok_orders")
    .select("id, order_id, pengirim, nomor_pengirim, kota_pengirim, penerima, nomor_penerima, alamat_penerima, shipping_date, courier, tracking_number, subtotal, payment_status, shipping_status, payment_evidence_path, created_at, updated_at")
    .eq("order_id", orderId).eq("nomor_penerima", phone).maybeSingle();
  if (error) {
    console.error("get-tiktok lookup:", error.message);
    return json({ error: "Unable to retrieve order" }, 500);
  }
  if (!order) return json({ error: "Order not found" }, 404);
  const [{ data: items, error: itemError }, { data: events, error: eventError }] = await Promise.all([
    db.from("tiktok_order_items").select("id, product_name, product_image_url, quantity, weight, unit_price, subtotal")
      .eq("order_id", order.id).order("created_at", { ascending: true }),
    db.from("tiktok_order_events").select("event_type, old_value, new_value, created_at")
      .eq("order_id", order.id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (itemError || eventError) return json({ error: "Unable to retrieve order details" }, 500);
  let evidenceUrl: string | null = null;
  if (order.payment_evidence_path) {
    const { data } = await db.storage.from("tiktok-order-images").createSignedUrl(order.payment_evidence_path, 3600);
    evidenceUrl = data?.signedUrl ?? null;
  }
  return json({ data: { ...order, payment_evidence_url: evidenceUrl, items: items ?? [], events: events ?? [] } });
});
