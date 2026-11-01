import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function requireAdmin(req: Request, client: ReturnType<typeof db>) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return false;
  const role = data.user.app_metadata?.role;
  return role === "admin" || role === "superadmin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const client = db();
  const url = new URL(req.url);

  if (url.searchParams.get("mode") === "admin") {
    if (!await requireAdmin(req, client)) return json({ error: "Admin authentication required" }, 401);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const q = url.searchParams.get("q")?.trim() || "";
    const paymentStatus = url.searchParams.get("payment_status");
    const shippingStatus = url.searchParams.get("shipping_status");
    let query = client.from("tiktok_orders").select("*", { count: "exact" });
    if (q) query = query.or(`order_id.ilike.%${q}%,penerima.ilike.%${q}%,nomor_penerima.ilike.%${q}%,tracking_number.ilike.%${q}%`);
    if (paymentStatus) query = query.eq("payment_status", paymentStatus);
    if (shippingStatus) query = query.eq("shipping_status", shippingStatus);
    const { data: orders, error, count } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) {
      console.error("get-tiktok admin list:", error.message);
      return json({ error: "Unable to retrieve orders" }, 500);
    }
    const ids = (orders ?? []).map((o) => o.id);
    const { data: items, error: itemsError } = ids.length
      ? await client.from("tiktok_order_items").select("*").in("order_id", ids)
      : { data: [], error: null };
    if (itemsError) return json({ error: "Unable to retrieve order items" }, 500);
    const mapped = (orders ?? []).map((order) => ({
      ...order,
      items: (items ?? []).filter((item) => item.order_id === order.id),
    }));
    return json({ data: mapped, pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) } });
  }

  const orderId = url.searchParams.get("order_id")?.trim();
  const phone = url.searchParams.get("nomor_penerima")?.trim();
  if (!orderId || !phone) return json({ error: "order_id and nomor_penerima are required" }, 400);
  if (orderId.length > 100 || phone.length > 30) return json({ error: "Invalid lookup parameters" }, 400);
  const { data: order, error } = await client.from("tiktok_orders")
    .select("id, order_id, pengirim, nomor_pengirim, kota_pengirim, penerima, nomor_penerima, alamat_penerima, shipping_date, courier, tracking_number, subtotal, payment_status, shipping_status, payment_evidence_path, qris_image_path, created_at, updated_at")
    .eq("order_id", orderId).eq("nomor_penerima", phone).maybeSingle();
  if (error) {
    console.error("get-tiktok lookup:", error.message);
    return json({ error: "Unable to retrieve order" }, 500);
  }
  if (!order) return json({ error: "Order not found" }, 404);
  const [{ data: items, error: itemError }, { data: events, error: eventError }] = await Promise.all([
    client.from("tiktok_order_items").select("id, product_name, product_image_url, quantity, weight, unit_price, subtotal")
      .eq("order_id", order.id).order("created_at", { ascending: true }),
    client.from("tiktok_order_events").select("event_type, old_value, new_value, created_at")
      .eq("order_id", order.id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (itemError || eventError) return json({ error: "Unable to retrieve order details" }, 500);
  let evidenceUrl: string | null = null;
  let qrisUrl: string | null = null;
  if (order.payment_evidence_path) {
    const { data } = await client.storage.from("tiktok-order-images").createSignedUrl(order.payment_evidence_path, 3600);
    evidenceUrl = data?.signedUrl ?? null;
  }
  if (order.qris_image_path) {
    const { data } = await client.storage.from("tiktok-order-images").createSignedUrl(order.qris_image_path, 3600);
    qrisUrl = data?.signedUrl ?? null;
  }
  return json({ data: { ...order, payment_evidence_url: evidenceUrl, qris_image_url: qrisUrl, items: items ?? [], events: events ?? [] } });
});
