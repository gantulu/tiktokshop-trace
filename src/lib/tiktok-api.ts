import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
const functionsUrl = `${supabaseUrl}/functions/v1`;
const bucket = 'tiktok-order-images';

async function request<T>(fn: string, path = '', init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${functionsUrl}/${fn}${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}

const toLegacy = async (order: any) => ({
  id: order.id,
  fields: {
    order_id: order.order_id,
    pengirim: order.pengirim ?? '',
    nomor_pengirim: order.nomor_pengirim ?? '',
    kota_pengirim: order.kota_pengirim ?? '',
    penerima: order.penerima ?? '',
    nomor_penerima: order.nomor_penerima ?? '',
    alamat_penerima: order.alamat_penerima ?? '',
    shipping_date: order.shipping_date ?? '',
    kurir: order.courier ?? '',
    nomor_resi: order.tracking_number ?? '',
    produk_subtotal: order.subtotal ?? 0,
    produk_name: order.items?.[0]?.product_name ?? '',
    produk_img: order.items?.[0]?.product_image_url ? await signedImage(order.items[0].product_image_url) : '',
    produk_img_path: order.items?.[0]?.product_image_url ?? '',
    produk_jumlah: order.items?.[0]?.quantity ?? 1,
    produk_weight: order.items?.[0]?.weight ?? '',
    payment_status: order.payment_status,
    shipping_status: order.shipping_status,
    konfirmasi_qris_img: order.qris_image_path ? await signedImage(order.qris_image_path) : '',
    qris_image_path: order.qris_image_path ?? null,
    payment_evidence_path: order.payment_evidence_path ?? null,
    payment_evidence_url: order.payment_evidence_url ?? null,
    created_at: order.created_at,
  },
});

async function signedImage(path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export const tiktokApi = {
  async getAllOrders() {
    const result = await request<{ data: any[] }>('get-tiktok', '?mode=admin&page=1&limit=100');
    return Promise.all((result.data ?? []).map(toLegacy));
  },
  async getOrderById(orderId: string, phone: string) {
    const result = await request<{ data: any }>(
      'get-tiktok',
      `?order_id=${encodeURIComponent(orderId)}&nomor_penerima=${encodeURIComponent(phone)}`,
    );
    return result.data ? await toLegacy(result.data) : null;
  },
  async createOrder(fields: Record<string, any>) {
    const quantity = Number(fields.produk_jumlah || 1);
    const subtotal = Number(fields.produk_subtotal || 0);
    const result = await request<{ data: any }>('crud-tiktok-2', '', {
      method: 'POST',
      body: JSON.stringify({
        order: {
          pengirim: fields.pengirim,
          nomor_pengirim: fields.nomor_pengirim,
          kota_pengirim: fields.kota_pengirim,
          penerima: fields.penerima,
          nomor_penerima: fields.nomor_penerima,
          alamat_penerima: fields.alamat_penerima,
          shipping_date: fields.shipping_date || null,
          subtotal,
        },
        items: [{
          product_name: fields.produk_name,
          product_image_url: fields.produk_img_path || null,
          quantity,
          weight: fields.produk_weight || null,
          unit_price: Math.floor(subtotal / Math.max(quantity, 1)),
          subtotal,
        }],
      }),
    });
    return result.data;
  },
  async updateOrder(orderId: string, fields: Record<string, any>) {
    return request('crud-tiktok-2', '', {
      method: 'PATCH',
      body: JSON.stringify({
        order_id: orderId,
        order: {
          penerima: fields.penerima,
          nomor_penerima: fields.nomor_penerima,
          alamat_penerima: fields.alamat_penerima,
          courier: fields.kurir,
          tracking_number: fields.nomor_resi,
          shipping_date: fields.shipping_date,
        },
      }),
    });
  },
  async deleteOrder(orderId: string, phone: string) {
    return request('crud-tiktok-2', `?order_id=${encodeURIComponent(orderId)}&nomor_penerima=${encodeURIComponent(phone)}`, {
      method: 'DELETE',
    });
  },
  async uploadImage(file: File) {
    const signed = await request<{ data: { path: string; token: string } }>('crud-tiktok-2', '', {
      method: 'POST',
      body: JSON.stringify({ action: 'upload-url', content_type: file.type, size: file.size }),
    });
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(signed.data.path, signed.data.token, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    return signed.data.path;
  },
  async getImageUrl(path: string) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
};
