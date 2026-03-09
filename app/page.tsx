'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type Order = {
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
  status: string;
  notes: string;
  imported_at: string;
  updated_at: string;
};

type Product = {
  sku: string;
  name: string;
  image_path: string;
};

type Stats = {
  total: number;
  pending: number;
  image_sent: number;
  review_requested: number;
  completed: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending: '未対応',
  image_sent: '画像送付済',
  review_requested: 'レビュー依頼済',
  completed: '完了',
};

const STATUS_OPTIONS = [
  { value: 'pending', label: '未対応' },
  { value: 'image_sent', label: '画像送付済' },
  { value: 'review_requested', label: 'レビュー依頼済' },
  { value: 'completed', label: '完了' },
];

type Page = 'orders' | 'import' | 'products';

export default function Home() {
  const [page, setPage] = useState<Page>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, image_sent: 0, review_requested: 0, completed: 0 });
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ sku: '', name: '' });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (search) params.set('search', search);
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setStats(data.stats || { total: 0, pending: 0, image_sent: 0, review_requested: 0, completed: 0 });
    } catch {
      showToast('データの取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search, showToast]);

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data.products || []);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const updateStatus = async (order_number: string, status: string) => {
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_number, status }),
    });
    showToast(`「${STATUS_LABELS[status]}」に更新しました`);
    fetchOrders();
  };

  const openProductBySku = (sku: string) => {
    const product = products.find(p => p.sku === sku);
    if (product) {
      setEditProduct(product);
      setProductForm({ sku: product.sku, name: product.name });
    } else {
      setEditProduct(null);
      setProductForm({ sku: sku, name: '' });
    }
    setProductImageFile(null);
    setShowProductModal(true);
  };

  const toggleSelectOrder = (orderNumber: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderNumber) ? prev.filter(id => id !== orderNumber) : [...prev, orderNumber]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map(o => o.order_number));
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`選択した ${selectedOrderIds.length} 個の注文を「${STATUS_LABELS[status]}」に更新しますか？`)) return;

    setBulkProcessing(true);
    try {
      await Promise.all(selectedOrderIds.map(id => fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: id, status }),
      })));
      showToast(`${selectedOrderIds.length}件を「${STATUS_LABELS[status]}」に更新しました`);
      setSelectedOrderIds([]);
      fetchOrders();
    } finally {
      setBulkProcessing(false);
    }
  };

  const bulkSendEmails = async () => {
    const targets = orders.filter(o => selectedOrderIds.includes(o.order_number) && !isAmazonEmail(o.customer_email || ''));
    if (targets.length === 0) {
      showToast('送信可能な注文が選択されていません', 'error');
      return;
    }

    if (!confirm(`選択した ${targets.length} 件の注文にレビュー依頼メールを一括送信しますか？\n（Amazon匿名アドレスは除外されます）`)) return;

    setBulkProcessing(true);
    let successCount = 0;
    try {
      for (const order of targets) {
        const product = productMap[order.product_sku];
        const res = await fetch('/api/send-review-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_number: order.order_number,
            customer_email: order.customer_email,
            customer_name: order.customer_name,
            recipient_name: order.recipient_name,
            product_sku: order.product_sku,
            image_path: product?.image_path,
          }),
        });
        if (res.ok) successCount++;
      }
      showToast(`✅ ${successCount}件のメール送信を完了しました`);
      setSelectedOrderIds([]);
      fetchOrders();
    } finally {
      setBulkProcessing(false);
    }
  };

  const sendReviewEmail = async (order: Order) => {
    if (sendingEmail) return;
    if (!order.customer_email || order.customer_email.includes('marketplace')) {
      showToast('このメールアドレスには送信できません（Amazon匿名アドレス）', 'error');
      return;
    }
    const product = productMap[order.product_sku];
    if (!confirm(`${order.customer_name}様へレビュー依頼メールを送信しますか？\n\n【送信内容の確認】\n・宛先: ${order.customer_email}\n・注文番号: ${order.order_number}\n・商品名: ${product?.name || order.product_sku}\n・画像: ${product?.image_path ? 'あり' : 'なし'}\n\n※「OK」を押すと送信されます。`)) return;

    setSendingEmail(order.order_number);
    try {
      const res = await fetch('/api/send-review-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: order.order_number,
          customer_email: order.customer_email,
          customer_name: order.customer_name,
          recipient_name: order.recipient_name,
          product_sku: order.product_sku,
          image_path: product?.image_path,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ レビュー依頼メールを送信しました！');
        fetchOrders();
        if (selectedOrder?.order_number === order.order_number) {
          setSelectedOrder({ ...selectedOrder, status: 'review_requested' });
        }
      } else {
        showToast(data.error || 'メール送信に失敗しました', 'error');
      }
    } finally {
      setSendingEmail(null);
    }
  };

  const handleCsvImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/import', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) {
        setImportResult({ type: 'success', msg: `✅ ${data.count}件の注文をインポートしました` });
        fetchOrders();
      } else {
        setImportResult({ type: 'error', msg: `❌ ${data.error}` });
      }
    } catch {
      setImportResult({ type: 'error', msg: '❌ インポートに失敗しました' });
    } finally {
      setImporting(false);
    }
  };

  const saveProduct = async () => {
    const form = new FormData();
    form.append('sku', productForm.sku);
    form.append('name', productForm.name);
    if (productImageFile) form.append('image', productImageFile);
    if (editProduct?.image_path) form.append('existing_image', editProduct.image_path);
    const res = await fetch('/api/products', { method: 'POST', body: form });
    const data = await res.json();
    if (data.success) {
      showToast('商品を保存しました');
      setShowProductModal(false);
      setEditProduct(null);
      setProductImageFile(null);
      fetchProducts();
    } else {
      showToast(data.error || '保存に失敗しました', 'error');
    }
  };

  const deleteProduct = async (sku: string) => {
    if (!confirm(`SKU「${sku}」を削除しますか？`)) return;
    await fetch(`/api/products?sku=${encodeURIComponent(sku)}`, { method: 'DELETE' });
    showToast('商品を削除しました');
    fetchProducts();
  };

  const productMap = Object.fromEntries(products.map(p => [p.sku, p]));

  const navigateTo = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
  };

  const isAmazonEmail = (email: string) => email.includes('marketplace.amazon');

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <h1>🌸 画像配信管理</h1>
          <div className="subtitle">Shirasaka Flower</div>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item${page === 'orders' ? ' active' : ''}`} onClick={() => navigateTo('orders')}>
            <span className="icon">📋</span> 注文一覧
          </button>
          <button className={`nav-item${page === 'import' ? ' active' : ''}`} onClick={() => navigateTo('import')}>
            <span className="icon">📥</span> CSVインポート
          </button>
          <button className={`nav-item${page === 'products' ? ' active' : ''}`} onClick={() => navigateTo('products')}>
            <span className="icon">🖼️</span> 商品画像設定
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Mobile header */}
        <div className="mobile-header">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="mobile-title">🌸 画像配信管理</span>
        </div>

        {/* ===== ORDERS PAGE ===== */}
        {page === 'orders' && (
          <>
            <div className="page-header">
              <h2>注文一覧</h2>
              <p>画像配信・レビュー依頼状況を管理します</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card total">
                <div className="stat-label">総注文数</div>
                <div className="stat-value">{stats.total}</div>
              </div>
              <div className="stat-card pending">
                <div className="stat-label">未対応</div>
                <div className="stat-value">{stats.pending}</div>
              </div>
              <div className="stat-card sent">
                <div className="stat-label">画像送付済</div>
                <div className="stat-value">{stats.image_sent + stats.review_requested}</div>
              </div>
              <div className="stat-card done">
                <div className="stat-label">完了</div>
                <div className="stat-value">{stats.completed}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">注文リスト</span>
                <div className="toolbar">
                  <input
                    className="search-input"
                    placeholder="注文番号・顧客名・SKUで検索…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">全ステータス</option>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" onClick={fetchOrders}>🔄</button>
                </div>
              </div>

              {selectedOrderIds.length > 0 && (
                <div className="bulk-actions-bar">
                  <span className="selected-count">{selectedOrderIds.length}件 選択中</span>
                  <div className="bulk-buttons">
                    <button
                      className="btn btn-email btn-sm"
                      onClick={bulkSendEmails}
                      disabled={bulkProcessing}
                    >
                      {bulkProcessing ? '処理中...' : '📧 一括メール送信'}
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => bulkUpdateStatus('completed')}
                      disabled={bulkProcessing}
                    >
                      ✅ 一括完了にする
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrderIds([])}>解除</button>
                  </div>
                </div>
              )}

              <div className="table-wrap">
                {loading ? (
                  <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
                ) : orders.length === 0 ? (
                  <div className="empty-state">
                    <div className="icon">📭</div>
                    <h3>注文がありません</h3>
                    <p>CSVインポートから注文データを取り込んでください</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th>画像</th>
                        <th>受注番号</th>
                        <th className="hide-mobile">GoQ番号</th>
                        <th>注文者</th>
                        <th className="hide-mobile">送付先</th>
                        <th>SKU</th>
                        <th className="hide-mobile">出荷日</th>
                        <th className="hide-mobile">ギフト</th>
                        <th>ステータス</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => {
                        const product = productMap[order.product_sku];
                        const isAmazon = isAmazonEmail(order.customer_email || '');
                        return (
                          <tr key={order.id} className={selectedOrderIds.includes(order.order_number) ? 'row-selected' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.includes(order.order_number)}
                                onChange={() => toggleSelectOrder(order.order_number)}
                              />
                            </td>
                            <td
                              onClick={() => openProductBySku(order.product_sku)}
                              style={{ cursor: 'pointer' }}
                              title="タップして画像を登録/変更"
                            >
                              {product?.image_path ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={product.image_path} alt={product.name} className="product-thumb-clickable" />
                              ) : (
                                <div className="no-image-thumb-clickable">🌸</div>
                              )}
                            </td>
                            <td className="small muted">{order.order_number}</td>
                            <td className="small muted hide-mobile">{order.goq_number}</td>
                            <td>{order.customer_name}</td>
                            <td className="muted hide-mobile">{order.recipient_name}</td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent-secondary)' }}>
                                {order.product_sku}
                              </span>
                            </td>
                            <td className="small muted hide-mobile">{order.ship_date}</td>
                            <td className="hide-mobile">
                              {order.gift_message ? (
                                <div className="gift-message" title={order.gift_message}>🎁 {order.gift_message}</div>
                              ) : <span className="muted">—</span>}
                            </td>
                            <td>
                              <select
                                className="status-select"
                                value={order.status}
                                onChange={e => updateStatus(order.order_number, e.target.value)}
                              >
                                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td>
                              <div className="actions">
                                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(order)}>詳細</button>
                                {!isAmazon && order.status !== 'review_requested' && order.status !== 'completed' && (
                                  <button
                                    className="btn btn-email btn-sm"
                                    onClick={() => sendReviewEmail(order)}
                                    disabled={sendingEmail === order.order_number}
                                    title="レビュー依頼メール送信"
                                  >
                                    {sendingEmail === order.order_number ? '送信中…' : '📧'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== IMPORT PAGE ===== */}
        {page === 'import' && (
          <>
            <div className="page-header">
              <h2>CSVインポート</h2>
              <p>AmazonのGoQ出荷CSVをインポートします（ShiftJIS対応）</p>
            </div>
            <div className="import-container">
              <div
                className={`dropzone${dragOver ? ' drag-over' : ''}`}
                onClick={() => csvInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleCsvImport(file);
                }}
              >
                <div className="icon">📄</div>
                <h3>CSVをここにドロップ</h3>
                <p>またはタップしてファイルを選択</p>
                <p style={{ marginTop: '8px', fontSize: '12px' }}>ShiftJIS / UTF-8 対応</p>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="file-input"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvImport(f); }}
                />
              </div>

              {importing && (
                <div className="import-progress">
                  <div className="spinner" />インポート処理中…
                </div>
              )}
              {importResult && (
                <div className={`import-result ${importResult.type}`}>{importResult.msg}</div>
              )}

              <div style={{ marginTop: '24px', padding: '20px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>📌 インポートの手順</h3>
                <ol style={{ paddingLeft: '20px', lineHeight: '2', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <li>AmazonのGoQ管理画面から注文CSVをダウンロード</li>
                  <li>上のエリアにCSVをドロップ（スマホは「ファイルを選択」）</li>
                  <li>注文一覧に自動反映されます</li>
                  <li>同じ注文番号は上書き（重複なし）</li>
                </ol>
              </div>
            </div>
          </>
        )}

        {/* ===== PRODUCTS PAGE ===== */}
        {page === 'products' && (
          <>
            <div className="page-header">
              <h2>商品画像設定</h2>
              <p>SKUコードに商品画像を登録します。スマホで撮影した写真も登録できます。</p>
            </div>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditProduct(null);
                  setProductForm({ sku: '', name: '' });
                  setProductImageFile(null);
                  setShowProductModal(true);
                }}
              >
                + 商品を追加
              </button>
            </div>

            {products.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="icon">🖼️</div>
                  <h3>商品が登録されていません</h3>
                  <p>「商品を追加」ボタンからSKUと画像を登録してください</p>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="products-grid">
                  {products.map(product => (
                    <div key={product.sku} className="product-card">
                      {product.image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_path} alt={product.name} className="product-image" />
                      ) : (
                        <div className="product-image-placeholder">🌸</div>
                      )}
                      <div className="product-info">
                        <div className="product-sku">{product.sku}</div>
                        <div className="product-name">{product.name}</div>
                      </div>
                      <div className="product-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setEditProduct(product);
                          setProductForm({ sku: product.sku, name: product.name });
                          setProductImageFile(null);
                          setShowProductModal(true);
                        }}>編集</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(product.sku)}>削除</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== ORDER DETAIL MODAL ===== */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">注文詳細</span>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            {(() => {
              const product = productMap[selectedOrder.product_sku];
              const isAmazon = isAmazonEmail(selectedOrder.customer_email || '');
              return (
                <div>
                  {product?.image_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_path} alt={product.name} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} />
                  )}
                  <dl className="order-detail">
                    <dt>受注番号</dt><dd>{selectedOrder.order_number}</dd>
                    <dt>GoQ管理番号</dt><dd>{selectedOrder.goq_number}</dd>
                    <dt>注文者</dt><dd>{selectedOrder.customer_name}</dd>
                    <dt>送付先</dt><dd>{selectedOrder.recipient_name}</dd>
                    <dt>メールアドレス</dt>
                    <dd style={{ fontSize: '12px', wordBreak: 'break-all', color: isAmazon ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {selectedOrder.customer_email}
                      {isAmazon && ' ※Amazon匿名アドレス'}
                    </dd>
                    <dt>商品SKU</dt><dd style={{ fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{selectedOrder.product_sku}</dd>
                    <dt>出荷日</dt><dd>{selectedOrder.ship_date}</dd>
                    <dt>お届け日</dt><dd>{selectedOrder.delivery_date}</dd>
                    {selectedOrder.gift_message && (
                      <>
                        <dt>🎁 ギフトメッセージ</dt>
                        <dd style={{ color: 'var(--orange)', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13px' }}>
                          {selectedOrder.gift_message}
                        </dd>
                      </>
                    )}
                  </dl>

                  <div style={{ marginTop: '16px' }}>
                    <div className="form-label">ステータス変更</div>
                    <select
                      className="filter-select"
                      style={{ width: '100%', marginBottom: '12px' }}
                      value={selectedOrder.status}
                      onChange={e => {
                        updateStatus(selectedOrder.order_number, e.target.value);
                        setSelectedOrder({ ...selectedOrder, status: e.target.value });
                      }}
                    >
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>

                    {!isAmazon && (
                      <button
                        className="btn btn-email"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => sendReviewEmail(selectedOrder)}
                        disabled={!!sendingEmail}
                      >
                        📧 レビュー依頼メールを送信する
                      </button>
                    )}
                    {isAmazon && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                        ※ Amazon匿名アドレスのため直接メール送信はできません
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===== PRODUCT MODAL ===== */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editProduct ? '商品を編集' : '商品を追加'}</span>
              <button className="modal-close" onClick={() => setShowProductModal(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">SKUコード *</label>
              <input
                className="form-input"
                placeholder="例: arange3000Flower"
                value={productForm.sku}
                onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))}
                disabled={!!editProduct}
              />
            </div>
            <div className="form-group">
              <label className="form-label">商品名</label>
              <input
                className="form-input"
                placeholder="例: アレンジ3000円 フラワー"
                value={productForm.name}
                onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">商品画像</label>
              {editProduct?.image_path && !productImageFile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editProduct.image_path} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
              )}
              {productImageFile && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={URL.createObjectURL(productImageFile)} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
              )}
              {/* スマホ: カメラ撮影ボタン + ファイル選択ボタン */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div
                  className="image-upload-area"
                  style={{ flex: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {productImageFile ? `✅ ${productImageFile.name}` : '📷 写真を撮る / 選択'}
                </div>
              </div>
              {/* capture="environment" でスマホのリアカメラを起動 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="file-input"
                onChange={e => setProductImageFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowProductModal(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={saveProduct}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
