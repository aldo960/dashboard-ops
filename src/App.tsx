import React, { useState, useMemo, useEffect } from "react";
import { 
  Search, Plus, Truck as TruckIcon, List, LogOut, CheckCircle2, Clock,
  AlertCircle, Pencil, Trash2, X, Save, Box, ChevronDown, ChevronRight,
  ArrowLeft, AlertTriangle, Archive, Printer, FileText, CheckSquare,
  Tag, ArrowRightLeft, Database, Layers, Calendar, ClipboardList,
  Settings, Info, Package, User
} from "lucide-react";

// --- Tipos e Interfaces ---
interface MasterItem { id: string; lineNo: string; itemNumber: string; orderedBoxes: number; orderedQty: number; }
interface PalletLineItem { id: string; lineNo: string; itemNumber: string; boxes: number; qtyPerBox: number; addedBy?: string; }
interface PalletItem { id: string; number: number; boxes: number; weight: string; items: PalletLineItem[]; }
interface Order { id: string; status: string; po: string; freight: string; pallets: number; normalPallets?: number; loomPallets?: number; boxes: number; weight: string; notes?: string; looseBoxes?: number; shipmentDate?: string; truckId?: string; palletList?: PalletItem[]; masterItems?: MasterItem[]; isManualOverride?: boolean; }

// --- Constantes ---
const LOOM_SIZES = ["15000", "4200", "25000", "8500"];

// --- Helpers de Fecha ---
const formatForInput = (usDate: string) => {
  if (!usDate) return "";
  const [m, d, y] = usDate.split('/');
  if (y && m && d) return `${y.length === 2 ? '20'+y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return usDate;
};
const formatFromInput = (isoDate: string) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split('-');
  if (y && m && d) return `${m}/${d}/${y}`;
  return isoDate;
};
const getTodayUSFormat = () => {
  const t = new Date();
  return `${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')}/${t.getFullYear()}`;
};
const parseDateStr = (s: string) => {
  const p = s.split('/');
  return p.length === 3 ? new Date(Number(p[2]), Number(p[0]) - 1, Number(p[1])) : new Date(s);
};
const isLoomPallet = (p: PalletItem) => p.items.some(i => i.boxes === 0 && LOOM_SIZES.includes(String(i.qtyPerBox)));

// --- Mock Data Generator (Fallback) ---
const getMockOrders = (): Order[] => [
  { id: "ORD-1001", status: "Completed", po: "PO-001", freight: "Prepaid", pallets: 2, normalPallets: 2, loomPallets: 0, boxes: 10, weight: "1500.00", shipmentDate: getTodayUSFormat(), truckId: "Truck 1", palletList: [], masterItems: [], isManualOverride: true },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState("Order Summary");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedTrucks, setExpandedTrucks] = useState<Record<string, boolean>>({});
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [newOrderForm, setNewOrderForm] = useState({ id: "", po: "", shipmentDate: "", freight: "Select Freight Terms", truckId: "N/A", notes: "" });
  const [supabaseClient, setSupabaseClient] = useState<any>(null);

  // --- Inicialización Dinámica de Supabase para evitar errores de compilación ---
  useEffect(() => {
    const initSupabase = async () => {
      let url = "";
      let key = "";

      // Intento leer de import.meta.env (Vite) de forma segura
      try {
        // @ts-ignore
        url = import.meta.env.VITE_SUPABASE_URL;
        // @ts-ignore
        key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      } catch (e) {
        // Fallback si import.meta no existe
        url = "https://exprkynttidzrzwfurvc.supabase.co";
        key = "sb_publishable_hDkOmJfbzd_A1Yyy6NiS5w_pYTfpOSV";
      }

      if (!url || url.includes("TU_PROYECTO")) {
        setOrders(getMockOrders());
        return;
      }

      // Cargar Supabase desde CDN si no está disponible como módulo
      if (!(window as any).supabase) {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.async = true;
        script.onload = () => {
          const client = (window as any).supabase.createClient(url, key);
          setSupabaseClient(client);
        };
        document.head.appendChild(script);
      } else {
        const client = (window as any).supabase.createClient(url, key);
        setSupabaseClient(client);
      }
    };

    initSupabase();
  }, []);

  // --- Sincronización con Supabase ---
  useEffect(() => {
    if (!supabaseClient) return;

    const fetchOrders = async () => {
      const { data, error } = await supabaseClient.from('orders').select('*');
      if (!error && data) setOrders(data);
    };

    fetchOrders();

    const subscription = supabaseClient
      .channel('orders_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => { supabaseClient.removeChannel(subscription); };
  }, [supabaseClient]);

  const saveOrderToCloud = async (order: Order) => {
    if (!supabaseClient) return;
    await supabaseClient.from('orders').upsert(order);
  };

  // --- Lógica de Dashboard ---
  const { activeDates, pastCompletedDates, delayedOrdersList } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const filtered = orders.filter(o => (o.id || '').toLowerCase().includes(searchLower) || (o.po || '').toLowerCase().includes(searchLower));
    const delayed = filtered.filter(o => o.status === 'Delayed');
    const activeRaw = filtered.filter(o => o.status !== 'Delayed');
    
    const groups: any = {};
    activeRaw.forEach(o => {
      const d = o.shipmentDate || 'Unscheduled';
      const t = o.truckId || 'Unassigned';
      if (!groups[d]) groups[d] = {};
      if (!groups[d][t]) groups[d][t] = [];
      groups[d][t].push(o);
    });

    const active: any[] = [];
    const past: any[] = [];
    const today = new Date(); today.setHours(0,0,0,0);

    Object.entries(groups).forEach(([date, trucksMap]: any) => {
      const oDate = date === 'Unscheduled' ? today : parseDateStr(date);
      const trucks = Object.entries(trucksMap).map(([id, ords]: any) => ({
        id, orders: ords,
        summary: {
          pallets: ords.reduce((s: any, o: any) => s + (Number(o.pallets)||0), 0),
          boxes: ords.reduce((s: any, o: any) => s + (Number(o.boxes)||0), 0),
          weight: ords.reduce((s: any, o: any) => s + parseFloat(String(o.weight||"0").replace(/,/g, '')||"0"), 0).toFixed(2)
        }
      })).sort((a,b) => a.id.localeCompare(b.id));

      if (oDate < today && trucks.every(t => t.orders.every((o: any) => o.status === 'Completed'))) {
        past.push({ date, trucks });
      } else {
        active.push({ date, trucks });
      }
    });

    return { 
      activeDates: active.sort((a,b) => parseDateStr(a.date).getTime() - parseDateStr(b.date).getTime()), 
      pastCompletedDates: past.sort((a,b) => parseDateStr(b.date).getTime() - parseDateStr(a.date).getTime()), 
      delayedOrdersList: delayed 
    };
  }, [orders, searchTerm]);

  // Auto-save al editar
  useEffect(() => {
    if (!editingOrder) return;
    let final = { ...editingOrder };
    if (activeTab === "Order Details" && !final.isManualOverride) {
      const list = final.palletList || [];
      let nP = 0, lP = 0;
      list.forEach(p => isLoomPallet(p) ? lP++ : nP++);
      final.pallets = list.length;
      final.normalPallets = nP;
      final.loomPallets = lP;
      final.boxes = list.reduce((s, p) => s + (Number(p.boxes)||0), 0) + (Number(final.looseBoxes) || 0);
      final.weight = list.reduce((s, p) => s + parseFloat(String(p.weight || "0").replace(/,/g, '')||"0"), 0).toFixed(2);
    }
    setOrders(prev => prev.map(o => o.id === final.id ? final : o));
    saveOrderToCloud(final);
  }, [editingOrder]);

  const totals = useMemo(() => {
    if (!editingOrder) return { pallets: 0, normalPallets: 0, loomPallets: 0, boxes: 0, weight: 0 };
    if (editingOrder.isManualOverride && activeTab === "Order Summary") {
      return { pallets: editingOrder.pallets, normalPallets: editingOrder.normalPallets || editingOrder.pallets, loomPallets: editingOrder.loomPallets || 0, boxes: editingOrder.boxes, weight: parseFloat(editingOrder.weight || "0") };
    }
    const list = editingOrder.palletList || [];
    let nP = 0, lP = 0;
    list.forEach(p => isLoomPallet(p) ? lP++ : nP++);
    const w = list.reduce((s, p) => s + parseFloat(String(p.weight || "0").replace(/,/g, '') || "0"), 0);
    const b = list.reduce((s, p) => s + (Number(p.boxes) || 0), 0) + (Number(editingOrder.looseBoxes) || 0);
    return { pallets: list.length, normalPallets: nP, loomPallets: lP, boxes: b, weight: w };
  }, [editingOrder, activeTab]);

  const handleLogin = (e: any) => { e.preventDefault(); const u = new FormData(e.target).get('username') as string; if(u) setCurrentUser(u); };
  const handleInputChange = (field: keyof Order, val: any) => editingOrder && setEditingOrder({ ...editingOrder, [field]: val });
  
  const handleCreateOrder = async (e: any) => {
    e.preventDefault();
    const newOrd: Order = { 
      ...newOrderForm, shipmentDate: formatFromInput(newOrderForm.shipmentDate), 
      status: "In Progress", pallets: 0, boxes: 0, weight: "0.00", 
      truckId: newOrderForm.truckId === "N/A" ? "Unassigned" : newOrderForm.truckId,
      palletList: [], masterItems: [], isManualOverride: false 
    };
    await saveOrderToCloud(newOrd);
    setOrders([...orders, newOrd]);
    setEditingOrder(newOrd);
    setActiveTab("Order Details");
  };

  if (!currentUser) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200">
        <div className="flex justify-center mb-6"><div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><User className="w-8 h-8"/></div></div>
        <h1 className="text-2xl font-black text-center text-slate-800 mb-8">Dashboard de Operaciones</h1>
        <div className="space-y-4">
          <input name="username" placeholder="Tu Nombre" required className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500" />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg transition-all">Ingresar al Sistema</button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b sticky top-0 z-30 px-8 flex justify-between items-center h-16 shadow-sm">
        <div className="flex items-center gap-12 h-full">
          <h1 className="text-xl font-black text-indigo-600">Dashboard</h1>
          <nav className="flex h-full items-center gap-4">
            <button onClick={() => setActiveTab("Order Summary")} className={`h-full px-4 text-sm font-bold border-b-2 transition-all ${activeTab.includes("Summary") ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-slate-500 hover:text-slate-800"}`}>Dashboard</button>
            <button onClick={() => setActiveTab("Create Order")} className={`h-full px-4 text-sm font-bold border-b-2 transition-all ${activeTab === "Create Order" ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-slate-500 hover:text-slate-800"}`}>Nueva Orden</button>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold">
          <span className="text-slate-500">Usuario: <span className="text-slate-800">{currentUser}</span></span>
          <button onClick={() => setCurrentUser(null)} className="p-2 text-slate-400 hover:text-red-500"><LogOut className="w-5 h-5"/></button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-8">
        {activeTab === "Order Summary" && (
          <div className="space-y-8">
            <div className="flex justify-between items-end">
              <div className="w-full max-w-md relative">
                <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4"/>
                <input placeholder="Buscar Orden o PO..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            {activeDates.map(group => (
              <section key={group.date} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3"><Calendar className="w-5 h-5 text-indigo-600"/><h2 className="font-bold text-slate-700">Entregas del {group.date}</h2></div>
                </div>
                <div className="p-6 space-y-6">
                  {group.trucks.map((t: any) => (
                    <div key={t.id}>
                      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><TruckIcon className="w-3 h-3"/> {t.id}</span>
                        <div className="flex gap-4 text-[11px] font-bold text-slate-500"><span>{t.summary.pallets} Plts</span><span className="text-indigo-600">{t.summary.weight} LBS</span></div>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {t.orders.map((o: Order) => (
                          <div key={o.id} onClick={() => { setEditingOrder(o); setActiveTab("Order Details"); }} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm w-full sm:w-64 hover:border-indigo-400 cursor-pointer transition-all group relative">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${o.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{o.status}</p>
                            <h3 className="font-black text-slate-800">{o.id}</h3>
                            <p className="text-xs text-slate-500 mt-2 font-medium">PO: <span className="text-slate-800">{o.po}</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {activeTab === "Order Details" && editingOrder && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div><h2 className="text-2xl font-black text-slate-800">Orden {editingOrder.id}</h2><p className="text-sm text-indigo-600 font-bold">PO: {editingOrder.po}</p></div>
                <button onClick={() => setActiveTab("Order Summary")} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600"><ArrowLeft className="w-4 h-4"/> Volver</button>
             </div>
             <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                   <div><label className="block text-xs font-black text-slate-400 uppercase mb-2">Estado</label>
                   <select value={editingOrder.status} onChange={e => handleInputChange('status', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold">
                     <option value="In Progress">En Progreso</option><option value="Completed">Completado</option><option value="Delayed">Demorado</option>
                   </select></div>
                   <div className="flex gap-4">
                      <div className="flex-1 p-4 bg-indigo-50 rounded-xl border border-indigo-100"><p className="text-[10px] font-black text-indigo-400 uppercase">Pallets</p><p className="text-2xl font-black text-indigo-700">{totals.pallets}</p></div>
                      <div className="flex-1 p-4 bg-emerald-50 rounded-xl border border-emerald-100"><p className="text-[10px] font-black text-emerald-400 uppercase">Peso Total</p><p className="text-2xl font-black text-emerald-700">{totals.weight.toFixed(0)} lbs</p></div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === "Create Order" && (
          <div className="max-w-2xl mx-auto bg-white p-10 rounded-2xl shadow-xl border border-slate-200">
            <h2 className="text-3xl font-black text-slate-800 mb-8">Nueva Orden de Embarque</h2>
            <form onSubmit={handleCreateOrder} className="grid grid-cols-2 gap-6">
              <div className="col-span-2"><label className="block text-sm font-bold text-slate-600 mb-2">ID de Orden</label><input required value={newOrderForm.id} onChange={e => setNewOrderForm({...newOrderForm, id: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: ORD-9900" /></div>
              <div><label className="block text-sm font-bold text-slate-600 mb-2">PO Reference</label><input value={newOrderForm.po} onChange={e => setNewOrderForm({...newOrderForm, po: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg outline-none" /></div>
              <div><label className="block text-sm font-bold text-slate-600 mb-2">Fecha de Envío</label><input type="date" required value={newOrderForm.shipmentDate} onChange={e => setNewOrderForm({...newOrderForm, shipmentDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg outline-none" /></div>
              <div className="col-span-2 flex justify-end gap-4 mt-4"><button type="button" onClick={() => setActiveTab("Order Summary")} className="px-6 py-2 font-bold text-slate-500">Cancelar</button><button type="submit" className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Crear Orden</button></div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}