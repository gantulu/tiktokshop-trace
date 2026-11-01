/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { tiktokApi, supabase } from './lib/tiktok-api';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Package, 
  ChevronLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  User, 
  MapPin, 
  CreditCard, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
  ShoppingBag,
  ShieldCheck,
  Download
} from 'lucide-react';

// ==========================================
// 1. GLOBAL STYLES & ZOOM DISABLE (STRICT)
// ==========================================
const GlobalStyles = () => (
  <style>{`
    /* STRICT ZOOM DISABLE & LAYOUT */
    html, body, #root {
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #F8F8F8; /* TikTok light gray bg */
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #161823; /* TikTok black text */
      -webkit-font-smoothing: antialiased;
    }
    
    html, body {
      touch-action: none;
      overscroll-behavior: none;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }

    .app-container {
      max-width: 500px;
      height: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      background: #F8F8F8; /* Page background */
      position: relative;
      box-shadow: 0 0 40px rgba(0,0,0,0.05);
      overflow: hidden;
    }

    .scrollable-main {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 100px;
    }

    .scrollable-main::-webkit-scrollbar { display: none; }
    .scrollable-main { -ms-overflow-style: none; scrollbar-width: none; }

    .glass {
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-top: 1px solid #F1F1F2;
    }

    .tiktok-gradient {
      background: #FE2C55; /* Solid TikTok Red is often used for buttons */
    }

    .tiktok-gradient-active {
      background: #E6284D;
    }

    .white-card {
      background: #FFFFFF;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 8px;
    }

    .premium-card {
      background: #FFFFFF;
      border-radius: 12px;
      transition: all 0.2s ease;
    }

    .premium-card:active {
      background: #FAFAFA;
      transform: scale(0.995);
    }

    input::placeholder {
      color: #BBBCC0;
    }

    .status-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .toast-container {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      pointer-events: none;
    }

    .toast {
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 50px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
  `}</style>
);

// ==========================================
// 2. UTILS & SERVICES
// ==========================================
const formatRupiah = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value || 0);
};

// All persistence and uploads go through Supabase Edge Functions / Storage.
// ==========================================
// 3. REUSABLE COMPONENTS
// ==========================================
const Toast = ({ message, onExited }: { message: string; onExited: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onExited, 2000);
    return () => clearTimeout(timer);
  }, [onExited]);

  return (
    <motion.div 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      className="toast"
    >
      <CheckCircle2 className="w-4 h-4 text-[#00F2EA]" />
      {message}
    </motion.div>
  );
};

const Header = ({ title, onBack, transparent = false, rightElement }: { title: string; onBack?: () => void; transparent?: boolean; rightElement?: React.ReactNode }) => (
  <header className={`sticky top-0 z-40 px-4 py-3 flex items-center justify-between ${transparent ? 'bg-transparent' : 'bg-white border-b border-[#F1F1F2]'}`}>
    <div className="flex items-center gap-2">
      {onBack && (
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onBack} 
          className="p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-[#161823]" />
        </motion.button>
      )}
    </div>
    <h1 className="text-[17px] font-bold tracking-tight text-[#161823] absolute left-1/2 -translate-x-1/2">{title}</h1>
    <div className="flex items-center">
      {rightElement}
    </div>
  </header>
);

const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false, icon: Icon, fullWidth = true }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'; className?: string; type?: 'button' | 'submit' | 'reset'; disabled?: boolean; icon?: any; fullWidth?: boolean }) => {
  const variants = {
    primary: "bg-[#FE2C55] text-white active:bg-[#E6284D]",
    secondary: "bg-[#161823] text-white active:bg-black",
    outline: "bg-white border border-[#D1D1D3] text-[#161823] active:bg-gray-50",
    ghost: "bg-[#F1F1F2] text-[#161823] active:bg-gray-200",
    danger: "bg-white border border-[#FE2C55] text-[#FE2C55] active:bg-red-50"
  };
  
  return (
    <motion.button 
      whileTap={{ scale: 0.98 }}
      type={type} 
      onClick={onClick} 
      disabled={disabled} 
      className={`${fullWidth ? 'w-full' : ''} font-bold py-2.5 px-6 rounded-md transition-all disabled:opacity-50 flex justify-center items-center gap-2 text-[15px] ${variants[variant]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </motion.button>
  );
};

const Input = ({ label, type = 'text', name, value, onChange, placeholder, required, icon: Icon }: { label?: string; type?: string; name?: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; required?: boolean; icon?: any }) => (
  <div className="mb-4">
    {label && <label className="block text-[13px] font-bold text-[#161823] mb-2 ml-1">{label}</label>}
    <div className="relative group">
      {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B91] group-focus-within:text-[#FE2C55] transition-colors" />}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`w-full ${Icon ? 'pl-11' : 'px-4'} py-2.5 bg-[#F1F1F2] border border-transparent rounded-md focus:outline-none focus:ring-1 focus:ring-[#FE2C55] focus:bg-white focus:border-[#FE2C55] transition-all text-[#161823] text-[14px] placeholder:text-[#BBBCC0]`}
      />
    </div>
  </div>
);

const StorageImageInput = ({
  label, value, onChange, placeholder
}: {
  label: string; value: string; onChange: (path: string) => void; placeholder?: string;
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    let active = true;
    if (!value) { setPreview(''); return; }
    tiktokApi.getImageUrl(value).then(url => { if (active) setPreview(url); }).catch(() => setPreview(''));
    return () => { active = false; };
  }, [value]);
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await tiktokApi.uploadImage(file);
      onChange(path);
    } catch (error) {
      console.error('Supabase Storage upload failed:', error);
      alert(error instanceof Error ? error.message : 'Gagal mengunggah gambar');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  return (
    <div className="mb-4">
      <label className="block text-[13px] font-bold text-[#161823] mb-2 ml-1">{label}</label>
      <div className="relative group flex gap-2">
        <input type="text" value={value} readOnly placeholder={placeholder || 'Path gambar Supabase Storage'}
          className="w-full px-4 py-2.5 bg-[#F1F1F2] border border-transparent rounded-md text-[#161823] text-[12px]" />
        <label className="cursor-pointer shrink-0">
          <input type="file" className="hidden" onChange={handleUpload} accept="image/jpeg,image/png,image/webp" />
          <div className="h-full px-3 flex items-center justify-center bg-[#F1F1F2] rounded-md">
            {uploading ? <span className="text-xs">Upload...</span> : <Plus className="w-5 h-5 text-[#8A8B91]" />}
          </div>
        </label>
      </div>
      {preview && <img src={preview} className="mt-2 w-20 h-20 rounded-md object-cover border" alt="Preview upload" />}
      {value && <button type="button" onClick={() => onChange('')} className="mt-2 text-xs text-red-500">Hapus gambar</button>}
    </div>
  );
};

const BottomDrawer = ({ isOpen, onClose, children, title }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; title?: string }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 max-w-[500px] mx-auto"
            onClick={onClose}
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 300,
              mass: 0.8
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] bg-white rounded-t-[20px] z-[60] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] overflow-hidden touch-none"
          >
            {/* Drag Handle */}
            <div className="w-full py-3 flex justify-center cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>

            {title && (
              <div className="px-6 pb-4 flex justify-between items-center border-b border-[#F1F1F2]">
                <h3 className="text-[18px] font-bold text-[#161823]">{title}</h3>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose} 
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#161823]" />
                </motion.button>
              </div>
            )}
            
            <div className="p-6 max-h-[85vh] overflow-y-auto overscroll-contain pb-12">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ==========================================
// 4. VIEWS
// ==========================================

const HomeView = ({ navigate }: { navigate: (path: string) => void }) => {
  const [orderId, setOrderId] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderId.trim() && recipientPhone.trim()) navigate(`/orderview/${encodeURIComponent(orderId.trim())}/${encodeURIComponent(recipientPhone.trim())}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full bg-[#F8F8F8]"
    >
      {/* Official Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-[#F1F1F2]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border border-[#F1F1F2]">
            <img 
              src="https://img.freepik.com/premium-photo/round-tiktok-logo-isolated-white-background_469489-1045.jpg?semt=ais_hybrid&w=32&q=80" 
              className="w-full h-full object-cover" 
              alt="TikTok Logo"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-[17px] font-bold text-[#161823]">TikTok Shop</span>
        </div>
        <button className="p-2 text-[#8A8B91]">
          <HelpCircle className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col px-6 pt-12">
        <div className="mb-10">
          <h1 className="text-[24px] font-black text-[#161823] mb-3 leading-tight">
            Lacak Pesanan <br />
            <span className="text-[#FE2C55]">TikTok Shop</span>
          </h1>
          <p className="text-[#8A8B91] text-[14px] leading-relaxed">
            Masukkan nomor pesanan dan nomor WhatsApp penerima untuk melihat detail paket.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#F1F1F2]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-[#161823] ml-1">Nomor Pesanan</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8B91] group-focus-within:text-[#FE2C55] transition-colors" />
                <input 
                  type="text"
                  placeholder="Contoh: 578291038471"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-[#F1F1F2] border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FE2C55]/20 focus:bg-white focus:border-[#FE2C55] transition-all text-[#161823] text-[15px] font-medium placeholder:text-[#BBBCC0]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-[#161823] ml-1">Nomor WhatsApp Penerima</label>
              <input type="tel" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} required
                placeholder="Contoh: 081234567890"
                className="w-full px-4 py-3.5 bg-[#F1F1F2] rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-[#FE2C55]/20" />
            </div>
            <Button type="submit" className="py-4 rounded-xl text-[16px]">Lacak Sekarang</Button>
          </form>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[#F1F1F2]">
            <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-[#4CAF50]" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[#161823]">Update Real-time</div>
              <div className="text-[11px] text-[#8A8B91]">Status kurir diperbarui setiap menit</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[#F1F1F2]">
            <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#FF9800]" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[#161823]">Belanja Aman</div>
              <div className="text-[11px] text-[#8A8B91]">Data pesanan Anda terlindungi sepenuhnya</div>
            </div>
          </div>
        </div>

        <div className="mt-auto py-8 text-center">
          <p className="text-[11px] text-[#BBBCC0]">
            &copy; 2024 TikTok Shop. All Rights Reserved. <br />
            Butuh bantuan? <span className="text-[#FE2C55] font-bold">Hubungi CS</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const OrdersView = ({ orderId, phone, navigate, showToast }: { orderId: string; phone: string; navigate: (path: string) => void; showToast: (msg: string) => void }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const data = await tiktokApi.getOrderById(orderId, phone);
      setOrder(data);
      if (!data) showToast("Pesanan tidak ditemukan!");
    } catch (err) { 
      console.error(err);
      showToast("Gagal mengambil data pesanan!");
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId, phone]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} disalin!`);
  };

  const handleDownloadQR = async () => {
    if (!order?.fields?.konfirmasi_qris_img) return;
    try {
      const response = await fetch(order.fields.konfirmasi_qris_img, { mode: 'cors' });
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `QRIS-${order.fields.order_id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast("QR Berhasil diunduh!");
    } catch (err) {
      console.error("Download failed, opening in new tab:", err);
      // Fallback: Open in new tab if fetch fails (likely CORS)
      window.open(order.fields.konfirmasi_qris_img, '_blank');
      showToast("Membuka gambar di tab baru...");
    }
  };

  if (loading) return (
    <div className="flex flex-col h-full bg-white items-center justify-center">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-8 h-8 border-2 border-gray-100 border-t-[#FE2C55] rounded-full"
      />
    </div>
  );

  if (!order) return (
    <div className="flex flex-col h-full bg-white p-8 items-center justify-center text-center">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-gray-300" />
      </div>
      <h3 className="text-lg font-bold text-[#161823] mb-2">Pesanan Tidak Ditemukan</h3>
      <p className="text-[#8A8B91] mb-8 text-[14px] font-medium">ID pesanan <span className="text-[#161823] font-bold">#{orderId}</span> tidak terdaftar di sistem kami.</p>
      <Button onClick={() => navigate('/')} variant="outline">Kembali ke Beranda</Button>
    </div>
  );

  const { fields } = order;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full bg-[#F8F8F8]"
    >
      <Header title="Detail Pesanan" onBack={() => navigate('/')} />
      
      <div className="scrollable-main">
        {/* Overload Alert Section */}
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-[#FFF1F3] px-4 py-3 mb-2 border-b border-[#FFE0E5] flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-[13px] font-bold text-[#161823]">Pemberitahuan Penting</h4>
            <motion.div 
              animate={{ 
                scale: [1, 1.1, 1],
                backgroundColor: ["#FE2C55", "#FF4D6D", "#FE2C55"]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.5,
                ease: "easeInOut"
              }}
              whileTap={{ scale: 0.9, rotate: -10 }}
              className="bg-[#FE2C55] text-white text-[10px] font-black px-2 py-1 rounded-md tracking-tighter cursor-pointer shadow-sm"
            >
              OVERLOAD
            </motion.div>
          </div>
          <p className="text-[11px] text-[#FE2C55] font-medium leading-relaxed">
            Mohon maaf, saat ini sedang terjadi lonjakan pesanan (Overload). Proses pengemasan & pengiriman mungkin memerlukan waktu tambahan 1-2 hari kerja.
          </p>
        </motion.div>

        {/* Status Section */}
        <div className="bg-white px-4 py-4 mb-2 border-b border-[#F1F1F2]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[15px] font-bold text-[#FE2C55]">Menunggu Pembayaran</span>
            <button 
              onClick={() => copyToClipboard(fields.order_id, 'Order ID')}
              className="flex items-center gap-1 text-[12px] text-[#8A8B91] active:text-[#161823]"
            >
              ID: {fields.order_id}
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[12px] text-[#8A8B91]">Selesaikan pembayaran untuk melanjutkan pesanan.</p>
        </div>

        {/* Shipping Address */}
        <div className="white-card mx-0 rounded-none mb-2">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-[#161823] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[14px] font-bold text-[#161823]">Alamat Pengiriman</span>

              </div>
              <div className="text-[13px] font-bold text-[#161823] mb-1">{fields.penerima} | {fields.nomor_penerima}</div>
              <p className="text-[12px] text-[#8A8B91] leading-relaxed">{fields.alamat_penerima}</p>
            </div>
          </div>
        </div>

        {/* Product Section */}
        <div className="white-card mx-0 rounded-none mb-2">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-[#161823]" />
            <span className="text-[13px] font-bold text-[#161823]">TikTok Shop Official</span>
          </div>
          <div className="flex gap-3 mb-4">
            <div className="w-20 h-20 bg-[#F8F8F8] rounded-md overflow-hidden shrink-0 border border-[#F1F1F2]">
              <img src={fields.produk_img || 'https://picsum.photos/seed/product/200'} className="w-full h-full object-cover" alt="product" />
            </div>
            <div className="flex-1 flex flex-col justify-between py-0.5">
              <div>
                <h2 className="text-[13px] font-medium text-[#161823] leading-tight line-clamp-2 mb-1">{fields.produk_name}</h2>
                <div className="text-[11px] text-[#8A8B91]">{fields.produk_weight}</div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-[#161823]">{formatRupiah(fields.produk_subtotal / (fields.produk_jumlah || 1))}</span>
                <span className="text-[12px] text-[#161823]">x{fields.produk_jumlah}</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-[#F1F1F2] flex justify-between items-center">
            <span className="text-[13px] text-[#161823]">Subtotal Produk</span>
            <span className="text-[14px] font-bold text-[#161823]">{formatRupiah(fields.produk_subtotal)}</span>
          </div>
        </div>

        {/* Shipping Info */}
        <div className="white-card mx-0 rounded-none mb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#161823]" />
              <span className="text-[13px] font-bold text-[#161823]">Opsi Pengiriman</span>
            </div>
            <span className="text-[13px] font-bold text-[#161823]">{fields.kurir || 'J&T Express'}</span>
          </div>
          <div className="flex items-center justify-between text-[12px] text-[#8A8B91]">
            <span>Nomor Resi</span>
            <button 
              onClick={() => fields.nomor_resi && copyToClipboard(fields.nomor_resi, 'Nomor Resi')}
              className="flex items-center gap-1 text-[#FE2C55] font-bold active:opacity-70"
            >
              {fields.nomor_resi || 'Sedang Diproses'}
              {fields.nomor_resi && <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="white-card mx-0 rounded-none mb-2">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-[#161823]" />
            <span className="text-[13px] font-bold text-[#161823]">Ringkasan Pembayaran</span>
          </div>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-[13px] text-[#8A8B91]">
              <span>Subtotal Produk</span>
              <span>{formatRupiah(fields.produk_subtotal)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-[#8A8B91]">
              <span>Biaya Pengiriman</span>
              <span>Rp0</span>
            </div>
          </div>
          <div className="pt-3 border-t border-[#F1F1F2] flex justify-between items-center">
            <span className="text-[15px] font-bold text-[#161823]">Total Pembayaran</span>
            <span className="text-[17px] font-bold text-[#FE2C55]">{formatRupiah(fields.produk_subtotal)}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] p-3 glass flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="text-[11px] text-[#8A8B91]">Total Pembayaran</div>
          <div className="text-[16px] font-bold text-[#FE2C55]">{formatRupiah(fields.produk_subtotal)}</div>
        </div>
        <Button onClick={() => setDrawerOpen(true)} className="flex-1" icon={CheckCircle2}>Bayar Sekarang</Button>
      </div>

      <BottomDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="Metode Pembayaran QRIS">
        <div className="text-center">
          <div className="bg-[#F8F8F8] p-6 rounded-xl mb-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-4 rounded-lg shadow-sm inline-block mb-4 border border-[#F1F1F2]"
            >
              {fields.konfirmasi_qris_img ? (
                <div className="flex flex-col items-center gap-4">
                  <img src={fields.konfirmasi_qris_img} className="w-48 h-48 object-contain" alt="QRIS" />
                  <Button 
                    variant="ghost" 
                    icon={Download} 
                    onClick={handleDownloadQR}
                    className="text-[12px] h-9"
                  >
                    Simpan Gambar QR
                  </Button>
                </div>
              ) : (
                <div className="w-48 h-48 flex flex-col items-center justify-center text-gray-300 bg-gray-50 rounded-lg">
                  <CreditCard className="w-10 h-10 mb-2" />
                  <span className="text-[10px] font-bold">QRIS TIDAK TERSEDIA</span>
                </div>
              )}
            </motion.div>
            <div className="text-[12px] text-[#8A8B91] mb-1">Total Tagihan</div>
            <div className="text-[22px] font-black text-[#161823]">{formatRupiah(fields.produk_subtotal)}</div>
          </div>

          <div className="space-y-3">
            <Button onClick={() => { setDrawerOpen(false); showToast("Konfirmasi terkirim!"); }} variant="primary">Konfirmasi Pembayaran</Button>
            <Button onClick={() => setDrawerOpen(false)} variant="ghost">Batal</Button>
          </div>
        </div>
      </BottomDrawer>

    </motion.div>
  );
};

const AdminView = ({ navigate, showToast }: { navigate: (path: string) => void; showToast: (msg: string) => void }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState<any>({
    order_id: '', produk_name: '', produk_img: '', produk_img_path: '', produk_jumlah: '', produk_weight: '', produk_subtotal: '',
    konfirmasi_qris_img: '', qris_image_path: '', pengirim: '', nomor_pengirim: '', kota_pengirim: '', penerima: '', nomor_penerima: '',
    alamat_penerima: '', shipping_date: '', nomor_resi: '', kurir: ''
  });

  const fetchOrders = async () => {
    setLoading(true);
    try { 
      const data = await tiktokApi.getAllOrders();
      setOrders(data); 
    }
    catch (err) { 
      console.error(err);
      showToast("Gagal memuat daftar pesanan!");
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const role = data.session?.user.app_metadata?.role;
      if (data.session && ['admin', 'superadmin'].includes(role)) { setIsAuthenticated(true); fetchOrders(); }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, produk_jumlah: Number(form.produk_jumlah), produk_subtotal: Number(form.produk_subtotal) };
    try {
      if (editingId) {
        await tiktokApi.updateOrder(form.order_id, payload);
        showToast("Pesanan diperbarui!");
      } else {
        const created = await tiktokApi.createOrder(payload);
        setForm({ ...payload, order_id: created.order_id });
        showToast(`Pesanan dibuat: ${created.order_id}`);
      }
      setIsModalOpen(false);
      fetchOrders();
    } catch (err) { 
      console.error(err);
      setLoading(false); 
      showToast("Gagal menyimpan!");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Hapus pesanan ini?")) {
      setLoading(true);
      try {
        throw new Error('Penghapusan permanen dinonaktifkan. Gunakan pembatalan pesanan.');
        showToast("Pesanan dihapus!");
        fetchOrders();
      } catch (err) {
        console.error(err);
        setLoading(false);
        showToast("Gagal menghapus!");
      }
    }
  };

  const filteredOrders = orders.filter(order => 
    order.fields.order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.fields.produk_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.fields.penerima?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} disalin!`);
  };

  if (!isAuthenticated) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col h-full bg-white p-8 items-center justify-center text-center"
      >
        <div className="w-16 h-16 bg-[#F1F1F2] rounded-full flex items-center justify-center mb-6">
          <ShieldCheck className="w-8 h-8 text-[#FE2C55]" />
        </div>
        <h3 className="text-lg font-bold text-[#161823] mb-2">Akses Admin</h3>
        <p className="text-[#8A8B91] mb-8 text-[14px]">Silakan masukkan kata sandi untuk mengakses panel manajemen.</p>
        
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { data, error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
          const role = data.user?.app_metadata?.role;
          if (error || !data.user || !['admin', 'superadmin'].includes(role)) {
            await supabase.auth.signOut();
            showToast("Login Admin gagal atau role tidak valid!");
            return;
          }
          setIsAuthenticated(true);
          showToast("Login Admin berhasil!");
          fetchOrders();
        }} className="w-full space-y-4">
          <Input type="email" placeholder="Email Admin" value={emailInput} onChange={e => setEmailInput(e.target.value)} required />
          <Input type="password" placeholder="Kata Sandi" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required icon={ShieldCheck} />
          <Button type="submit">Masuk</Button>
          <Button onClick={() => navigate('/')} variant="ghost">Batal</Button>
        </form>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full bg-[#F8F8F8]"
    >
      <Header 
        title="Manajemen Pesanan" 
        onBack={() => navigate('/')} 
        rightElement={
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => { setEditingId(null); setForm({}); setIsModalOpen(true); }}
            className="p-2 text-[#FE2C55]"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        }
      />
      
      <div className="scrollable-main">
        <div className="px-4 py-3">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B91]" />
              <input 
                type="text"
                placeholder="Cari ID, Produk, atau Penerima..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#F1F1F2] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#FE2C55] transition-all"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[14px] font-bold text-[#161823]">
              {searchQuery ? `Hasil Pencarian (${filteredOrders.length})` : `Semua Pesanan (${orders.length})`}
            </h2>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-6 h-6 border-2 border-gray-100 border-t-[#FE2C55] rounded-full mb-3"
              />
            </div>
          )}

          <div className="space-y-2">
            {!loading && filteredOrders.map((order, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                key={order.id} 
                className="white-card flex gap-3 items-center"
              >
                <div className="w-14 h-14 bg-[#F8F8F8] rounded-md overflow-hidden shrink-0 border border-[#F1F1F2]">
                  <img src={order.fields.produk_img || 'https://picsum.photos/seed/p/100'} className="w-full h-full object-cover" alt="p" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#161823] text-[13px] truncate mb-0.5">{order.fields.order_id}</div>
                  <div className="text-[11px] text-[#8A8B91] truncate">{order.fields.produk_name}</div>
                  <div className="text-[#FE2C55] font-bold text-[13px] mt-1">{formatRupiah(order.fields.produk_subtotal)}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingId(order.id); setForm(order.fields); setIsModalOpen(true); }} className="p-2 text-[#161823] hover:bg-gray-100 rounded-md transition-colors"><Edit2 className="w-4 h-4" /></button>
                  
                </div>
              </motion.div>
            ))}
            
            {!loading && filteredOrders.length === 0 && (
              <div className="text-center py-20">
                <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-[13px] text-[#8A8B91]">{searchQuery ? 'Tidak ada hasil yang cocok.' : 'Belum ada pesanan.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomDrawer isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Pesanan' : 'Tambah Pesanan'}>
        <form onSubmit={handleSubmit} className="space-y-6 pb-10">
          {/* Detail Produk */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-[#8A8B91] uppercase tracking-widest border-b border-[#F1F1F2] pb-1">Detail Produk</h4>
            <Input label="Order ID" value={form.order_id} onChange={e => setForm({...form, order_id: e.target.value})} required />
            <Input label="Nama Produk" value={form.produk_name} onChange={e => setForm({...form, produk_name: e.target.value})} required />
            <StorageImageInput label="Gambar Produk (Supabase Storage)" value={form.produk_img || ''} onChange={path => setForm({...form, produk_img: path})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Jumlah" type="number" value={form.produk_jumlah} onChange={e => setForm({...form, produk_jumlah: e.target.value})} required />
              <Input label="Berat" value={form.produk_weight} onChange={e => setForm({...form, produk_weight: e.target.value})} placeholder="Contoh: 300gr" />
            </div>
            <Input label="Tanggal Pengiriman" type="date" value={form.shipping_date} onChange={e => setForm({...form, shipping_date: e.target.value})} />
          </div>

          {/* Detail Pengirim */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-[#8A8B91] uppercase tracking-widest border-b border-[#F1F1F2] pb-1">Detail Pengirim</h4>
            <Input label="Nama Pengirim" value={form.pengirim} onChange={e => setForm({...form, pengirim: e.target.value})} />
            <Input label="Nomor Pengirim" value={form.nomor_pengirim} onChange={e => setForm({...form, nomor_pengirim: e.target.value})} />
            <Input label="Kota Pengirim" value={form.kota_pengirim} onChange={e => setForm({...form, kota_pengirim: e.target.value})} />
          </div>

          {/* Detail Penerima */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-[#8A8B91] uppercase tracking-widest border-b border-[#F1F1F2] pb-1">Detail Penerima</h4>
            <Input label="Nama Penerima" value={form.penerima} onChange={e => setForm({...form, penerima: e.target.value})} />
            <Input label="WhatsApp Penerima" value={form.nomor_penerima} onChange={e => setForm({...form, nomor_penerima: e.target.value})} />
            <Input label="Alamat Lengkap" value={form.alamat_penerima} onChange={e => setForm({...form, alamat_penerima: e.target.value})} />
          </div>

          {/* Logistik */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-[#8A8B91] uppercase tracking-widest border-b border-[#F1F1F2] pb-1">Logistik</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Kurir" value={form.kurir} onChange={e => setForm({...form, kurir: e.target.value})} />
              <Input label="No. Resi" value={form.nomor_resi} onChange={e => setForm({...form, nomor_resi: e.target.value})} />
            </div>
          </div>

          {/* Pembayaran */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold text-[#8A8B91] uppercase tracking-widest border-b border-[#F1F1F2] pb-1">Pembayaran</h4>
            <Input label="Total Harga (Subtotal)" type="number" value={form.produk_subtotal} onChange={e => setForm({...form, produk_subtotal: e.target.value})} required />
            <StorageImageInput label="Gambar QRIS (Supabase Storage)" value={form.qris_image_path || ''} onChange={path => setForm({...form, qris_image_path: path})} />
          </div>
          
          <Button type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan Pesanan'}</Button>
          
          {form.order_id && (
            <Button 
              type="button" 
              variant="ghost" 
              icon={Copy}
              onClick={() => copyToClipboard(`${window.location.origin}/#/orderview/${form.order_id}`, 'URL Pesanan')}
            >
              Salin URL Pesanan
            </Button>
          )}
        </form>
      </BottomDrawer>
    </motion.div>
  );
};

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.hash || '#/');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => setCurrentPath(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);

    // --- ZOOM BLOCKING LOGIC ---
    const preventZoom = (e: any) => {
      // Block Ctrl + Wheel zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const preventKeyZoom = (e: KeyboardEvent) => {
      // Block Ctrl/Cmd + (+, -, 0)
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
      }
    };

    const preventTouchZoom = (e: TouchEvent) => {
      // Block multi-touch (pinch zoom)
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Safari specific gesture blocking
    const preventGesture = (e: any) => {
      e.preventDefault();
    };

    // Add listeners with passive: false to allow preventDefault()
    window.addEventListener('wheel', preventZoom, { passive: false });
    window.addEventListener('keydown', preventKeyZoom, { passive: false });
    window.addEventListener('touchstart', preventTouchZoom, { passive: false });
    // @ts-ignore
    window.addEventListener('gesturestart', preventGesture, { passive: false });
    // @ts-ignore
    window.addEventListener('gesturechange', preventGesture, { passive: false });

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('wheel', preventZoom);
      window.removeEventListener('keydown', preventKeyZoom);
      window.removeEventListener('touchstart', preventTouchZoom);
      // @ts-ignore
      window.removeEventListener('gesturestart', preventGesture);
      // @ts-ignore
      window.removeEventListener('gesturechange', preventGesture);
    };
  }, []);

  const navigate = (path: string) => { window.location.hash = `#${path}`; };
  const showToast = (msg: string) => setToast(msg);

  let Component: any;
  let params: any = {};

  if (currentPath.startsWith('#/orderview/')) {
    Component = OrdersView;
    const parts = currentPath.replace('#/orderview/', '').split('/');
    params.orderId = decodeURIComponent(parts[0] || '');
    params.phone = decodeURIComponent(parts[1] || '');
  } else if (currentPath === '#/admin') Component = AdminView;
  else Component = HomeView;

  return (
    <>
      <GlobalStyles />
      <div className="app-container">
        <div className="toast-container">
          <AnimatePresence>
            {toast && <Toast message={toast} onExited={() => setToast(null)} />}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait">
          <Component key={currentPath} navigate={navigate} showToast={showToast} {...params} />
        </AnimatePresence>
      </div>
    </>
  );
}
