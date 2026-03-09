import { supabaseAdmin } from './supabase';

export type Order = {
  id: number;
  order_number: string;
  goq_number: string;
  ship_date: string;
  delivery_date: string;
  customer_email: string;
  customer_name: string;
  recipient_name: string;
  gift_message: string;
  product_sku: string;
  status: 'pending' | 'image_sent' | 'review_requested' | 'completed';
  notes: string;
  imported_at: string;
  updated_at: string;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  image_path: string;
  created_at: string;
};

// ────────────────────────────────────────────
// Orders
// ────────────────────────────────────────────
export async function getAllOrders(filter?: { status?: string; search?: string }): Promise<Order[]> {
  let query = supabaseAdmin
    .from('image_orders')
    .select('*')
    .order('imported_at', { ascending: false });

  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status);
  }
  if (filter?.search) {
    const s = `%${filter.search}%`;
    query = query.or(
      `customer_name.ilike.${s},recipient_name.ilike.${s},order_number.ilike.${s},product_sku.ilike.${s}`
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Order[];
}

export async function upsertOrder(order: Omit<Order, 'id' | 'imported_at' | 'updated_at'>): Promise<void> {
  const { error } = await supabaseAdmin
    .from('image_orders')
    .upsert(
      { ...order, updated_at: new Date().toISOString() },
      { onConflict: 'order_number', ignoreDuplicates: false }
    );
  if (error) throw error;
}

export async function getOrderImages(order_number: string) {
  const { data, error } = await supabaseAdmin
    .from('order_images')
    .select('*')
    .eq('order_number', order_number)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addOrderImage(order_number: string, image_path: string) {
  const { data, error } = await supabaseAdmin
    .from('order_images')
    .insert([{ order_number, image_path }])
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteOrderImage(id: number) {
  const { error } = await supabaseAdmin
    .from('order_images')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function updateOrderStatus(orderNumber: string, status: string, notes?: string): Promise<void> {
  const update: Record<string, string> = { status, updated_at: new Date().toISOString() };
  if (notes !== undefined) update.notes = notes;
  const { error } = await supabaseAdmin
    .from('image_orders')
    .update(update)
    .eq('order_number', orderNumber);
  if (error) throw error;
}

export async function getOrderStats() {
  const { data, error } = await supabaseAdmin
    .from('image_orders')
    .select('status');
  if (error) throw error;
  const rows = (data || []) as { status: string }[];
  return {
    total: rows.length,
    pending: rows.filter(r => r.status === 'pending').length,
    image_sent: rows.filter(r => r.status === 'image_sent').length,
    review_requested: rows.filter(r => r.status === 'review_requested').length,
    completed: rows.filter(r => r.status === 'completed').length,
  };
}

// ────────────────────────────────────────────
// Products
// ────────────────────────────────────────────
export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await supabaseAdmin
    .from('image_products')
    .select('*')
    .order('sku');
  if (error) throw error;
  return (data || []) as Product[];
}

export async function upsertProduct(product: { sku: string; name: string; image_path: string }): Promise<void> {
  const { error } = await supabaseAdmin
    .from('image_products')
    .upsert(product, { onConflict: 'sku' });
  if (error) throw error;
}

export async function deleteProduct(sku: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('image_products')
    .delete()
    .eq('sku', sku);
  if (error) throw error;
}
