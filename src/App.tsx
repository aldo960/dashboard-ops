import React, { useState, useMemo, useEffect, useRef } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { 
  Search,
  Plus,
  Truck as TruckIcon,
  List,
  LogOut,
  Menu,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ArrowLeft,
  AlertTriangle,
  Archive,
  Printer,
  FileText,
  CheckSquare,
  Tag,
  ArrowRightLeft,
  Database,
  Calendar,
  Info,
  Package,
  Copy
} from "lucide-react";

// --- Supabase Setup ---
// NOTA: Crea un archivo .env.local en la raíz del proyecto con estas variables.
// Ejemplo: VITE_SUPABASE_URL=https://xxxx.supabase.co
//          VITE_SUPABASE_ANON_KEY=eyJhbGci...
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Si no hay credenciales reales, la app usará datos de demostración locales.
const IS_PLACEHOLDER_CREDENTIALS = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// Inicializa el cliente de Supabase sólo si las credenciales están disponibles.
const supabase: SupabaseClient | null = IS_PLACEHOLDER_CREDENTIALS
  ? null
  : createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });

// --- Constants ---
const LOOM_SIZES = ["15000", "4200", "25000", "8500"];

// --- Interfaces ---
interface MasterItem {
  id: string;
  lineNo: string;
  itemNumber: string;
  orderedBoxes: number; 
  orderedQty: number;
}

interface PalletLineItem {
  id: string;
  lineNo: string;
  itemNumber: string;
  boxes: number;
  qtyPerBox: number;
  addedBy?: string;
}

interface ItemNote {
  id: string;
  itemNumber: string;
  lot?: string;
  note: string;
  active: boolean;
}

interface PartnerPallet {
  id: string;
  number: string;
  boxes: string;
  weight: string;
}

interface PalletItem {
  id: string;
  number: number;
  boxes: number;
  weight: string;
  items: PalletLineItem[];
}

interface Order {
  id: string;
  status: "Completed" | "In Progress" | "Delayed" | string;
  po: string;
  freight: string;
  pallets: number;
  normalPallets?: number;
  loomPallets?: number;
  boxes: number;
  weight: string;
  notes?: string;
  looseBoxes?: number;
  shipmentDate?: string;
  truckId?: string;
  palletList?: PalletItem[]; 
  masterItems?: MasterItem[];
  isManualOverride?: boolean;
}

interface TruckData {
  id: string;
  summary: { pallets: number; normalPallets: number; loomPallets: number; weight: string; boxes: number; };
  orders: Order[];
}

interface DateGroup {
  date: string;
  trucks: TruckData[];
}

interface EditContext {
  orderId: string;
}


// --- Helpers ---
const formatForInput = (usDate: string) => {
  if (!usDate) return "";
  const [m, d, y] = usDate.split('/');
  if (y && m && d) {
    const fullYear = y.length === 2 ? `20${y}` : y;
    return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return usDate;
};

const formatFromInput = (isoDate: string) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split('-');
  if (y && m && d) return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${y}`;
  return isoDate;
};

const getTodayUSFormat = () => {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const parseDateStr = (dateStr: string) => {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('/');
  if (parts.length === 3) {
      const [m, d, y] = parts;
      return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(dateStr);
};

// Formatea "MM/DD/YYYY" → "March 11, 2026"
const formatDateLong = (usDate: string) => {
  const d = parseDateStr(usDate);
  if (isNaN(d.getTime())) return usDate;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const isLoomPallet = (p: PalletItem) => {
  return p.items.some(i => i.boxes === 0 && LOOM_SIZES.includes(String(i.qtyPerBox)));
};

// Mock Data Generator
const getMockOrders = (): Order[] => {
  const todayStr = getTodayUSFormat();
  const futureStr = "12/25/2026";
  return [
    { id: "ORD-1001", status: "Completed", po: "PO-001", freight: "Prepaid", pallets: 2, normalPallets: 2, loomPallets: 0, boxes: 10, weight: "1500.00", shipmentDate: todayStr, truckId: "Truck 1", palletList: [], masterItems: [], isManualOverride: true },
    { id: "ORD-1002", status: "In Progress", po: "PO-002", freight: "Collect", pallets: 4, normalPallets: 3, loomPallets: 1, boxes: 25, weight: "3200.00", shipmentDate: todayStr, truckId: "Truck 1", palletList: [], masterItems: [], isManualOverride: true },
    { id: "ORD-1003", status: "In Progress", po: "PO-003", freight: "CPT", pallets: 1, normalPallets: 1, loomPallets: 0, boxes: 5, weight: "800.00", shipmentDate: todayStr, truckId: "Unassigned", palletList: [], masterItems: [], isManualOverride: true },
    { id: "ORD-1004", status: "Delayed", po: "URGENT-004", freight: "PPD and Charge", pallets: 5, normalPallets: 5, loomPallets: 0, boxes: 40, weight: "5000.00", shipmentDate: todayStr, truckId: "Truck 2", palletList: [], masterItems: [], isManualOverride: true },
    { id: "ORD-1005", status: "In Progress", po: "PO-005", freight: "Prepaid", pallets: 8, normalPallets: 6, loomPallets: 2, boxes: 60, weight: "8500.00", shipmentDate: futureStr, truckId: "Truck 3", palletList: [], masterItems: [], isManualOverride: true }
  ];
};


// --- Rabbit Logo ---
function RabbitLogo({ className = "" }: { className?: string }) {
  const C = "#3b1c78"; // dark purple
  const P = "#f9b8c8"; // pink
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Left ear */}
      <rect x="28" y="3"   width="15" height="42" rx="7.5" fill={C}/>
      <rect x="31.5" y="7" width="8"  height="32" rx="4"   fill={P}/>
      {/* Right ear */}
      <rect x="57" y="3"   width="15" height="42" rx="7.5" fill={C}/>
      <rect x="60.5" y="7" width="8"  height="32" rx="4"   fill={P}/>
      {/* Body */}
      <rect x="19" y="30" width="62" height="60" rx="16" fill={C}/>
      {/* Cheeks */}
      <circle cx="37.5" cy="55" r="9" fill={P}/>
      <circle cx="62.5" cy="55" r="9" fill={P}/>
      {/* Left sparkles */}
      <line x1="11" y1="39" x2="16" y2="46" stroke={C} strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="7"  y1="52" x2="16" y2="52" stroke={C} strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="11" y1="65" x2="16" y2="58" stroke={C} strokeWidth="3.5" strokeLinecap="round"/>
      {/* Right sparkles */}
      <line x1="89" y1="39" x2="84" y2="46" stroke={C} strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="93" y1="52" x2="84" y2="52" stroke={C} strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="89" y1="65" x2="84" y2="58" stroke={C} strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  );
}

// --- Main Component ---
export default function App() {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(!IS_PLACEHOLDER_CREDENTIALS);
  const [loginError, setLoginError] = useState<string | null>(null);

  // --- Main State: Single Master List ---
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [activeTab, setActiveTab] = useState("Order Summary");
  const [searchTerm, setSearchTerm] = useState("");
  
  // --- UI States ---
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedTrucks, setExpandedTrucks] = useState<Record<string, boolean>>({});
  const [expandedPallets, setExpandedPallets] = useState<Record<string, boolean>>({});

  // --- Edit States ---
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [_activeOrderContext, setActiveOrderContext] = useState<EditContext | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- Order History ---

  // --- Concurrent Edit Merge (silent — UI suppressed, state kept for realtime logic) ---
  const [, setPendingRemoteUpdate] = useState<Order | null>(null);
  const editingOrderRef = useRef<Order | null>(null);
  const isSavingRef = useRef(false);
  const savingCountRef = useRef(0);
  const refetchTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => { editingOrderRef.current = editingOrder; }, [editingOrder]);

  // --- Pallet Form States ---
  const [editingPalletId, setEditingPalletId] = useState<string | null>(null);
  const [movingPalletId, setMovingPalletId] = useState<string | null>(null);
  const [targetPosition, setTargetPosition] = useState<number>(1);
  const [movingLineItemId, setMovingLineItemId] = useState<string | null>(null);
  const [targetPalletNumber, setTargetPalletNumber] = useState<number>(1);
  const [lineItemForm, setLineItemForm] = useState<PalletLineItem>({ id: "", lineNo: "", itemNumber: "", boxes: 0, qtyPerBox: 0 });
  const [editingLineItemId, setEditingLineItemId] = useState<string | null>(null);
  
  const [newOrderForm, setNewOrderForm] = useState({ id: "", po: "", shipmentDate: "", freight: "Select Freight Terms", truckId: "N/A", notes: "" });

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState<'looms'|'standard'>('looms');
  const [bulkForm, setBulkForm] = useState({ loomSize: "15000", lineNo: "1", numPallets: "", weight: "", itemNo: "", boxes: "", qtyPerBox: "" });

  const [showRenumberForm, setShowRenumberForm] = useState<boolean>(false);
  const [renumberStartFrom, setRenumberStartFrom] = useState<number>(1);
  const [partnerPalletList, setPartnerPalletList] = useState<PartnerPallet[]>([]);
  const [partnerPalletForm, setPartnerPalletForm] = useState({ number: '', boxes: '', weight: '' });
  const [mergingPalletId, setMergingPalletId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');

  const [detailsTab, setDetailsTab] = useState<'general' | 'packing_list' | 'weight_sheet' | 'items' | 'order_check'>('general');
  const [expandedCheckLines, setExpandedCheckLines] = useState<Record<string, boolean>>({});
  const [newItemNumberForm, setNewItemNumberForm] = useState("");
  const [newItemTargetQtyForm, setNewItemTargetQtyForm] = useState<number>(0);
  const [newItemLineNoForm, setNewItemLineNoForm] = useState<string>("");
  const [itemNotes, setItemNotes] = useState<ItemNote[]>([]);
  const [newItemNoteForm, setNewItemNoteForm] = useState<string>("");
  const [newItemLotForm, setNewItemLotForm] = useState<string>("");
  const [editingMasterItemId, setEditingMasterItemId] = useState<string | null>(null);
  const itemsEndRef = useRef<HTMLDivElement>(null);

  const [printMode, setPrintMode] = useState<'none' | 'labels_all' | 'pallet_sheets_all' | 'packing_list' | 'weight_sheet' | 'label_single' | 'pallet_sheet_single' | 'truck_report' | 'consolidation_form' | 'label_4x2' | 'label_4x4'>('none');
  const [labelContent, setLabelContent] = useState('');
  const [labelSize, setLabelSize] = useState<'4x2' | '4x4'>('4x2');
  const [printTargetPallet, setPrintTargetPallet] = useState<PalletItem | null>(null);
  const [reportDate, setReportDate] = useState(getTodayUSFormat());
  const [, setTodos] = useState<any[]>([]);
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);
  // --- Supabase Auth: restore session on load ---
  useEffect(() => {
    if (IS_PLACEHOLDER_CREDENTIALS) return;
    supabase!.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user?.email ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription: authSub } } = supabase!.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user?.email ?? null);
    });
    return () => authSub.unsubscribe();
  }, []);

  // --- Fetch Data & Setup Real-time Subscription ---
  useEffect(() => {
    // Si no hay credenciales, usamos datos de demostración locales
    if (IS_PLACEHOLDER_CREDENTIALS) {
      setOrders(getMockOrders());
      setExpandedDates(prev => ({ ...prev, [getTodayUSFormat()]: true, "12/25/2026": true }));
      setExpandedTrucks(prev => ({ ...prev, [`${getTodayUSFormat()}-Truck 1`]: true }));
      return;
    }

    // No intentar cargar datos hasta que el usuario esté autenticado
    if (!currentUser) return;

    // Helper: map DB row (with joined pallets/pallet_items/order_items) → Order interface
    const mapOrderFromDB = (data: any): Order => {
      const { pallets: palletsArr, order_items: orderItemsArr, ...orderFields } = data;
      return {
        ...orderFields,
        palletList: ((palletsArr || []) as any[])
          .sort((a: any, b: any) => a.number - b.number)
          .map((p: any) => ({
            id: p.id,
            number: p.number,
            weight: p.weight || '0.00',
            boxes: ((p.pallet_items || []) as any[]).reduce((s: number, i: any) => s + (Number(i.boxes) || 0), 0),
            items: ((p.pallet_items || []) as any[]).map((i: any) => ({
              id: i.id,
              lineNo: i.line_no || '',
              itemNumber: i.item_number || '',
              boxes: i.boxes || 0,
              qtyPerBox: i.qty_per_box || 0,
              addedBy: i.added_by || '',
            })),
          })),
        masterItems: ((orderItemsArr || []) as any[])
          .sort((a: any, b: any) => parseInt(a.line_no) - parseInt(b.line_no))
          .map((m: any) => ({
            id: m.id,
            lineNo: m.line_no || '',
            itemNumber: m.item_number || '',
            orderedBoxes: m.ordered_boxes || 0,
            orderedQty: m.ordered_qty || 0,
          })),
      };
    };

    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase!
          .from('orders')
          .select('*, pallets(*, pallet_items(*)), order_items(*)');
        if (error) throw error;

        if (data && data.length > 0) {
          setOrders(data.map(mapOrderFromDB));
          setExpandedDates(prev => ({ ...prev, [getTodayUSFormat()]: true }));
        } else {
          // BD vacía: cargar datos de ejemplo para demostración
          setOrders(prev => (prev.length === 0 ? getMockOrders() : prev));
          setExpandedDates(prev => ({ ...prev, [getTodayUSFormat()]: true, "12/25/2026": true }));
          setExpandedTrucks(prev => ({ ...prev, [`${getTodayUSFormat()}-Truck 1`]: true }));
        }
      } catch (err) {
        console.error("Error al obtener datos de Supabase:", err);
        setOrders(prev => (prev.length === 0 ? getMockOrders() : prev));
        setExpandedDates(prev => ({ ...prev, [getTodayUSFormat()]: true, "12/25/2026": true }));
      }
    };

    // Helper: re-fetch a single order and update state (used by realtime handlers)
    const refetchOrderData = async (orderId: string) => {
      if (!supabase) return;
      try {
        const { data } = await supabase
          .from('orders')
          .select('*, pallets(*, pallet_items(*)), order_items(*)')
          .eq('id', orderId)
          .single();
        if (data) {
          const mapped = mapOrderFromDB(data);
          // Always update the orders list so the dashboard reflects new totals
          setOrders(prev => prev.map(o => o.id === orderId ? mapped : o));
          // Only notify of remote change if the user has this order open and we're not the ones saving
          if (editingOrderRef.current?.id === orderId && !isSavingRef.current) {
            setPendingRemoteUpdate(mapped);
          }
        }
      } catch (err) {
        console.error("Error refetching order:", err);
      }
    };

    // Debounced wrapper — prevents a flood of DB reads when 20 items arrive in quick succession
    const debouncedRefetch = (orderId: string) => {
      clearTimeout(refetchTimersRef.current[orderId]);
      refetchTimersRef.current[orderId] = setTimeout(() => refetchOrderData(orderId), 800);
    };

    fetchOrders();

    const fetchTodos = async () => {
      const { data } = await supabase!.from('warehouse_todos').select('*').order('created_at', { ascending: false });
      if (data) setTodos(data);
    };
    fetchTodos();

    const fetchItemNotes = async () => {
      const { data } = await supabase!.from('item_notes').select('*').eq('active', true);
      if (data) setItemNotes(data.map((n: any) => ({ id: n.id, itemNumber: n.item_number, lot: n.lot || '', note: n.note, active: n.active })));
    };
    fetchItemNotes();

    // Suscripción a cambios en tiempo real en las 3 tablas
    const channel = supabase!
      .channel('public:all-tables')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        if (!isSavingRef.current) fetchOrders();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => { fetchOrders(); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => { fetchOrders(); })
      // Pallets — debounced refetch so 20 inserts don't fire 20 DB reads
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pallets' }, (payload) => {
        const orderId = (payload.new as any)?.order_id || (payload.old as any)?.order_id;
        if (orderId) debouncedRefetch(orderId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pallet_items' }, (payload) => {
        const orderId = (payload.new as any)?.order_id || (payload.old as any)?.order_id;
        if (orderId) debouncedRefetch(orderId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
        const orderId = (payload.new as any)?.order_id || (payload.old as any)?.order_id;
        if (orderId) debouncedRefetch(orderId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_todos' }, () => {
        fetchTodos();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_notes' }, () => {
        supabase!.from('item_notes').select('*').eq('active', true).then(({ data }) => {
          if (data) setItemNotes(data.map((n: any) => ({ id: n.id, itemNumber: n.item_number, lot: n.lot || '', note: n.note, active: n.active })));
        });
      })
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [currentUser]);

  // Refresh data when user returns to the browser tab (catches missed realtime events)
  useEffect(() => {
    if (!currentUser || !supabase) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        supabase.from('orders').select('*, pallets(*, pallet_items(*)), order_items(*)').then(({ data }) => {
          if (data) setOrders(data.map((d: any) => {
            const { pallets: palletsArr, order_items: orderItemsArr, ...orderFields } = d;
            return {
              ...orderFields,
              palletList: ((palletsArr || []) as any[]).sort((a: any,b: any) => a.number - b.number).map((p: any) => ({
                id: p.id, number: p.number, weight: p.weight || '0.00',
                boxes: ((p.pallet_items || []) as any[]).reduce((s: number, i: any) => s + (Number(i.boxes)||0), 0),
                items: ((p.pallet_items || []) as any[]).map((i: any) => ({ id: i.id, lineNo: i.line_no||'', itemNumber: i.item_number||'', boxes: i.boxes||0, qtyPerBox: i.qty_per_box||0, addedBy: i.added_by||'' })),
              })),
              masterItems: ((orderItemsArr || []) as any[]).sort((a: any,b: any) => parseInt(a.line_no)-parseInt(b.line_no)).map((m: any) => ({ id: m.id, lineNo: m.line_no||'', itemNumber: m.item_number||'', orderedBoxes: m.ordered_boxes||0, orderedQty: m.ordered_qty||0 })),
            };
          }));
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    // Also refresh every 3 minutes as a safety net
    const interval = setInterval(onVisible, 3 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(interval); };
  }, [currentUser]);

const saveOrderToCloud = async (order: Order) => {
    if (IS_PLACEHOLDER_CREDENTIALS || !supabase) return;
    // Strip normalized fields — they live in pallets/pallet_items/order_items tables now
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { palletList, masterItems, ...orderFields } = order;
    savingCountRef.current++;
    isSavingRef.current = true;
    try {
      const { error } = await supabase.from('orders').upsert(orderFields, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.error("Error guardando orden en Supabase:", err);
    } finally {
      setTimeout(() => {
        savingCountRef.current = Math.max(0, savingCountRef.current - 1);
        if (savingCountRef.current === 0) isSavingRef.current = false;
      }, 6000);
    }
  };

  const deleteOrderFromCloud = async (orderId: string) => {
    if (IS_PLACEHOLDER_CREDENTIALS || !supabase) return;
    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
    } catch (err) {
      console.error("Error eliminando orden en Supabase:", err);
    }
  };

  // --- Dynamic Grouping Logic ---
  const { activeDates, pastCompletedDates, delayedOrdersList } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    // 1. Filter by search
    const filtered = orders.filter(o =>
      (o.id || '').toLowerCase().includes(searchLower) ||
      (o.po || '').toLowerCase().includes(searchLower) ||
      (o.masterItems || []).some(m => (m.itemNumber || '').toLowerCase().includes(searchLower))
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 2. Separate delayed — explicit 'Delayed' status OR auto-classify past non-completed orders
    const delayed = filtered.filter(o => {
      if (o.status === 'Delayed') return true;
      if (o.status === 'Completed') return false;
      if (o.shipmentDate) {
        const d = parseDateStr(o.shipmentDate);
        return !isNaN(d.getTime()) && d < today;
      }
      return false;
    });
    const active = filtered.filter(o => !delayed.includes(o));

    // 3. Dynamically group by Date -> Truck
    const groups: Record<string, Record<string, Order[]>> = {};
    active.forEach(o => {
      const dStr = o.shipmentDate || 'Unscheduled';
      const tStr = o.truckId || 'Unassigned';
      if (!groups[dStr]) groups[dStr] = {};
      if (!groups[dStr][tStr]) groups[dStr][tStr] = [];
      groups[dStr][tStr].push(o);
    });

    const activeGroups: DateGroup[] = [];
    const pastGroups: DateGroup[] = [];

    // 4. Format, sort, and separate completed old ones
    Object.entries(groups).forEach(([date, trucksMap]) => {
      const orderDate = date === 'Unscheduled' ? today : parseDateStr(date);
      const trucks = Object.entries(trucksMap).map(([tid, ords]) => ({
        id: tid,
        orders: ords,
        summary: {
          pallets: ords.reduce((s, o) => {
            if (o.isManualOverride) return s + (Number(o.pallets) || 0);
            return s + (o.palletList?.length || 0);
          }, 0),
          normalPallets: ords.reduce((s, o) => {
            if (o.isManualOverride) return s + (Number(o.normalPallets) || 0);
            return s + (o.palletList?.filter(p => !isLoomPallet(p)).length || 0);
          }, 0),
          loomPallets: ords.reduce((s, o) => {
            if (o.isManualOverride) return s + (Number(o.loomPallets) || 0);
            return s + (o.palletList?.filter(p => isLoomPallet(p)).length || 0);
          }, 0),
          boxes: ords.reduce((s, o) => {
            if (o.isManualOverride) return s + (Number(o.boxes) || 0);
            return s + (o.palletList?.reduce((bs, p) => bs + (Number(p.boxes) || 0), 0) || 0) + (Number(o.looseBoxes) || 0);
          }, 0),
          weight: ords.reduce((s, o) => {
            if (o.isManualOverride) return s + parseFloat(String(o.weight || "0").replace(/,/g, '') || "0");
            return s + (o.palletList?.reduce((ws, p) => ws + parseFloat(String(p.weight || "0").replace(/,/g, '') || "0"), 0) || 0);
          }, 0).toFixed(2)
        }
      })).sort((a, b) => a.id.localeCompare(b.id));

      const isOld = orderDate < today;
      const allCompleted = trucks.every(t => t.orders.every(o => o.status === 'Completed'));

      if (isOld && allCompleted) {
        pastGroups.push({ date, trucks });
      } else {
        activeGroups.push({ date, trucks });
      }
    });

    activeGroups.sort((a, b) => parseDateStr(a.date).getTime() - parseDateStr(b.date).getTime());
    pastGroups.sort((a, b) => parseDateStr(b.date).getTime() - parseDateStr(a.date).getTime()); // Descending order for history

    return { activeDates: activeGroups, pastCompletedDates: pastGroups, delayedOrdersList: delayed };
  }, [orders, searchTerm]);

  // --- Auto-Save Effect (Updates UI locally instantly, debounces cloud save) ---
  useEffect(() => {
    if (!editingOrder) return;
    // If ID changed in Quick Edit, skip auto-save — explicit Save button handles it
    if (isQuickEditOpen && editingOrder.id !== _activeOrderContext?.orderId) return;

    let finalOrder = { ...editingOrder };
    let updatedTotals = false;

    if (activeTab === "Order Details" && !finalOrder.isManualOverride) {
      const list = finalOrder.palletList || [];
      let normalP = 0, loomP = 0;
      list.forEach(p => { if (isLoomPallet(p)) loomP++; else normalP++; });
      const weightSum = list.reduce((s, p) => s + parseFloat(String(p.weight || "0").replace(/,/g, '')||"0"), 0);
      const boxSum = list.reduce((s, p) => s + (Number(p.boxes)||0), 0) + (Number(finalOrder.looseBoxes) || 0);

      if (finalOrder.pallets !== list.length || finalOrder.boxes !== boxSum || finalOrder.weight !== weightSum.toFixed(2) || finalOrder.normalPallets !== normalP || finalOrder.loomPallets !== loomP) {
        finalOrder.pallets = list.length;
        finalOrder.normalPallets = normalP;
        finalOrder.loomPallets = loomP;
        finalOrder.boxes = boxSum;
        finalOrder.weight = weightSum.toFixed(2);
        updatedTotals = true;
      }
    }

    if (updatedTotals) {
      setEditingOrder(finalOrder);
      return;
    }

    // Optimistic update: runs immediately so the UI feels instant
    setOrders(prev => prev.map(o => o.id === finalOrder.id ? finalOrder : o));

    // Debounced cloud save: waits 1500ms after the last change before hitting Supabase
    const timer = setTimeout(() => {
      saveOrderToCloud(finalOrder);
    }, 1500);

    // Cleanup: cancels the pending save if editingOrder changes again before 1500ms
    return () => clearTimeout(timer);
  }, [editingOrder]);

  // --- Totals Functions ---
  const totals = useMemo(() => {
    if (!editingOrder) return { pallets: 0, normalPallets: 0, loomPallets: 0, boxes: 0, weight: 0 };
    if (editingOrder.isManualOverride && activeTab === "Order Summary") {
      return { 
        pallets: editingOrder.pallets, 
        normalPallets: editingOrder.normalPallets || editingOrder.pallets, 
        loomPallets: editingOrder.loomPallets || 0,
        boxes: editingOrder.boxes, 
        weight: parseFloat(editingOrder.weight || "0") 
      };
    }
    const list = editingOrder.palletList || [];
    let normalP = 0;
    let loomP = 0;
    list.forEach(p => { if (isLoomPallet(p)) loomP++; else normalP++; });
    const weightSum = list.reduce((s, p) => s + parseFloat(String(p.weight || "0").replace(/,/g, '') || "0"), 0);
    const boxSum = list.reduce((s, p) => s + (Number(p.boxes) || 0), 0) + (Number(editingOrder.looseBoxes) || 0);
    return { pallets: list.length, normalPallets: normalP, loomPallets: loomP, boxes: boxSum, weight: weightSum };
  }, [editingOrder, activeTab]);

  const getPackedQtyForLine = (lineNo: string, order: Order | null) => {
    if (!order?.palletList) return 0;
    let total = 0;
    order.palletList.forEach(p => (p.items || []).forEach(i => { 
      if (i.lineNo === lineNo) {
        const isLoom = i.boxes === 0 && LOOM_SIZES.includes(String(i.qtyPerBox));
        total += isLoom ? Number(i.qtyPerBox) : (Number(i.boxes)||0) * (Number(i.qtyPerBox)||0);
      }
    }));
    return total;
  };

  const getPackedBoxesForLine = (lineNo: string, order: Order | null) => {
    if (!order?.palletList) return 0;
    let total = 0;
    order.palletList.forEach(p => (p.items || []).forEach(i => { 
      if (i.lineNo === lineNo) {
        const isLoom = i.boxes === 0 && LOOM_SIZES.includes(String(i.qtyPerBox));
        total += isLoom ? 1 : (Number(i.boxes)||0);
      }
    }));
    return total;
  };

  const getBackorders = (order: Order) => {
    if (!order.masterItems || order.masterItems.length === 0) return [];
    const backorders: {lineNo: string, missingQty: number, missingBoxes: number}[] = [];
    order.masterItems.forEach(m => {
      const packedQty = getPackedQtyForLine(m.lineNo, order);
      const packedBoxes = getPackedBoxesForLine(m.lineNo, order);
      const mQty = Number(m.orderedQty) || 0;
      const mBoxes = Number(m.orderedBoxes) || 0;
      if (mBoxes > 0 && ((mQty > 0 && packedQty < mQty) || packedBoxes < mBoxes)) {
        backorders.push({ lineNo: m.lineNo, missingQty: Math.max(0, mQty - packedQty), missingBoxes: Math.max(0, mBoxes - packedBoxes) });
      }
    });
    return backorders;
  };

  const checkOrderIncomplete = (order: Order) => getBackorders(order).length > 0;

  // --- Truck Report ---
  const reportDateData = useMemo(() => {
    return activeDates.find(d => formatForInput(d.date) === formatForInput(reportDate));
  }, [activeDates, reportDate]);

  const truckReportSummary = useMemo(() => {
    let grandTrucks = 0, grandLoomPlts = 0, grandNormalPlts = 0, grandBoxes = 0, grandWeight = 0;
    const trucks = (reportDateData?.trucks || []).map(t => {
      let tLoom = 0, tNormal = 0, tBoxes = 0, tWeight = 0;
      const ordersData = (t.orders || []).map(o => {
        let oLoom = 0, oNormal = 0;
        if (o.isManualOverride) {
          oLoom   = Number(o.loomPallets)   || 0;
          oNormal = Number(o.normalPallets) || 0;
        } else {
          (o.palletList || []).forEach(p => {
            const isLoom = (p.items || []).some(i => LOOM_SIZES.includes(i.itemNumber || ""));
            if(isLoom) oLoom++; else oNormal++;
          });
        }
        tLoom += oLoom; tNormal += oNormal;
        
        const calcWeight = (o.palletList || []).reduce((acc, p) => acc + parseFloat(String(p.weight||"0").replace(/,/g, '')||"0"), 0);
        const calcBoxes = (o.palletList || []).reduce((acc, p) => acc + (Number(p.boxes)||0), 0) + (Number(o.looseBoxes) || 0);

        const finalBoxes = o.isManualOverride ? (Number(o.boxes) || 0) + (Number(o.looseBoxes) || 0) : calcBoxes;
        const manualW = parseFloat(String(o.weight||"0").replace(/,/g, ''));
        const finalWeight = o.isManualOverride ? (isNaN(manualW) ? 0 : manualW) : calcWeight;

        tBoxes += finalBoxes; tWeight += finalWeight;
        return { ...o, loomPlts: oLoom, normalPlts: oNormal, finalBoxes, finalWeight };
      });
      grandTrucks++; grandLoomPlts += tLoom; grandNormalPlts += tNormal; grandBoxes += tBoxes; grandWeight += tWeight;
      return { ...t, ordersData, tLoom, tNormal, tBoxes, tWeight };
    });
    return { trucks, grandTrucks, grandLoomPlts, grandNormalPlts, grandBoxes, grandWeight };
  }, [reportDateData]);

  // --- UI Functions and Actions ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    // Demo mode: accept any name
    if (IS_PLACEHOLDER_CREDENTIALS) {
      if (email.trim()) setCurrentUser(email.trim());
      return;
    }
    setLoginError(null);
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) setLoginError('Incorrect email or password.');
  };

  const handleLogout = async () => {
    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.id || !newOrderForm.shipmentDate) return;
    const formatted = formatFromInput(newOrderForm.shipmentDate);
    const assignedTruck = newOrderForm.truckId === "N/A" ? "Unassigned" : newOrderForm.truckId;
    const newOrder: Order = { 
      ...newOrderForm, id: newOrderForm.id, shipmentDate: formatted, status: "In Progress", 
      pallets: 0, normalPallets: 0, loomPallets: 0, boxes: 0, weight: "0.00", truckId: assignedTruck, palletList: [], masterItems: [], isManualOverride: false
    };
    
    // Check for duplicate ID
    const isDuplicate = orders.some(o => o.id === newOrder.id);
    if (isDuplicate) {
      // Suggest a BO suffix
      let suffix = '-BO'; let counter = 2;
      while (orders.some(o => o.id === newOrder.id + suffix)) { suffix = `-BO${counter}`; counter++; }
      const suggestedId = newOrder.id + suffix;
      setConfirmDialog({
        isOpen: true,
        title: "Orden ya existe",
        message: `La orden "${newOrder.id}" ya existe. Para un back order, se sugiere el ID: "${suggestedId}". ¿Deseas crearla con ese ID?`,
        onConfirm: () => {
          const boOrder = { ...newOrder, id: suggestedId };
          setOrders(prev => [...prev, boOrder]);
          saveOrderToCloud(boOrder);
          setEditingOrder(boOrder);
          setActiveOrderContext({ orderId: boOrder.id });
          setDetailsTab('general');
          setActiveTab("Order Details");
          setNewOrderForm({ id: "", po: "", shipmentDate: "", freight: "Select Freight Terms", truckId: "N/A", notes: "" });
          setConfirmDialog(null);
        }
      });
      return;
    }

    // Quick local update
    setOrders(prev => [...prev, newOrder]);
    saveOrderToCloud(newOrder);
    
    setEditingOrder(newOrder);
    setActiveOrderContext({ orderId: newOrder.id });
    setDetailsTab('general');
    setActiveTab("Order Details");
    setNewOrderForm({ id: "", po: "", shipmentDate: "", freight: "Select Freight Terms", truckId: "N/A", notes: "" });
  };

  const executeDeleteOrder = async (context: EditContext) => {
    setOrders(prev => prev.filter(o => o.id !== context.orderId)); // Clear UI
    await deleteOrderFromCloud(context.orderId); // Clear Cloud
    setConfirmDialog(null);
  };

  const openFullDetails = (order: Order) => {
    // Deep copy para evitar que referencias compartidas contaminen otras órdenes
    setEditingOrder(JSON.parse(JSON.stringify(order)));
    setActiveOrderContext({ orderId: order.id });
    setDetailsTab('general');
    setActiveTab("Order Details");
    setEditingPalletId(null);
  };

  const openQuickEdit = (order: Order) => {
    setEditingOrder(JSON.parse(JSON.stringify(order)));
    setActiveOrderContext({ orderId: order.id });
    setIsQuickEditOpen(true);
  };

  const closeAndNavigateSummary = () => {
    setIsQuickEditOpen(false);
    setPendingRemoteUpdate(null);
    // Limpiar editingOrder al salir para que no contamine la siguiente orden
    if (activeTab === "Order Details") {
      setEditingOrder(null);
      setActiveTab("Order Summary");
    }
  };

  const handleQuickEditSave = async () => {
    if (!editingOrder) return;
    const originalId = _activeOrderContext?.orderId ?? '';
    const newId = editingOrder.id.trim();
    if (newId && newId !== originalId) {
      // ID changed: remove old, insert new
      setOrders(prev => prev.filter(o => o.id !== originalId).concat({ ...editingOrder, id: newId }));
      if (originalId) await deleteOrderFromCloud(originalId);
      await saveOrderToCloud({ ...editingOrder, id: newId });
      setActiveOrderContext({ orderId: newId });
    } else {
      // Always do explicit save so no changes are lost when closing
      setOrders(prev => prev.map(o => o.id === editingOrder.id ? editingOrder : o));
      await saveOrderToCloud(editingOrder);
    }
    closeAndNavigateSummary();
  };

  const handleInputChange = (field: keyof Order, value: any) => {
    if (!editingOrder) return;
    const updated = { ...editingOrder, [field]: value };
    // Keep pallets in sync with normalPallets + loomPallets when override is on
    if ((field === 'normalPallets' || field === 'loomPallets') && updated.isManualOverride) {
      updated.pallets = (Number(updated.normalPallets) || 0) + (Number(updated.loomPallets) || 0);
    }
    setEditingOrder(updated);
  };

const toggleDate = (date: string, trucks?: TruckData[]) => {
    const isOpening = !expandedDates[date];
    setExpandedDates(p => ({ ...p, [date]: !p[date] }));
    // When expanding a date, also expand all its trucks automatically
    if (isOpening && trucks && trucks.length > 0) {
      const truckUpdates: Record<string, boolean> = {};
      trucks.forEach(t => { truckUpdates[`${date}-${t.id}`] = true; });
      setExpandedTrucks(p => ({ ...p, ...truckUpdates }));
    }
  };
  const toggleTruck = (date: string, tid: string) => setExpandedTrucks(p => ({ ...p, [`${date}-${tid}`]: !p[`${date}-${tid}`] }));

  // --- Master Items ---
  const handleAddMasterItem = async () => {
    if (!editingOrder || !newItemNumberForm.trim()) return;
    const trimmed = newItemNumberForm.trim();

    // EDIT MODE: update existing item — single atomic state update to avoid stale closure overwrite
    if (editingMasterItemId) {
      const updatedLineNo = newItemLineNoForm.trim() || undefined;
      // Update local state once with all changes
      setEditingOrder(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          masterItems: (prev.masterItems || [])
            .map(m => m.id === editingMasterItemId
              ? { ...m, itemNumber: trimmed, orderedQty: newItemTargetQtyForm || 0, ...(updatedLineNo ? { lineNo: updatedLineNo } : {}) }
              : m
            )
            .sort((a, b) => parseInt(a.lineNo) - parseInt(b.lineNo))
        };
      });
      // DB updates
      if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
        await supabase.from('order_items').update({ item_number: trimmed, ordered_qty: newItemTargetQtyForm || 0, ...(updatedLineNo ? { line_no: updatedLineNo } : {}) }).eq('id', editingMasterItemId);
        if (newItemNoteForm.trim()) {
          await supabase.from('item_notes').upsert({
            item_number: trimmed,
            lot: newItemLotForm.trim() || null,
            note: newItemNoteForm.trim(),
            active: true,
          }, { onConflict: 'item_number' });
          setItemNotes(prev => {
            const exists = prev.find(n => n.itemNumber === trimmed);
            if (exists) return prev.map(n => n.itemNumber === trimmed ? { ...n, lot: newItemLotForm.trim(), note: newItemNoteForm.trim() } : n);
            return [...prev, { id: Date.now().toString(), itemNumber: trimmed, lot: newItemLotForm.trim(), note: newItemNoteForm.trim(), active: true }];
          });
        }
      }
      setNewItemNumberForm("");
      setNewItemTargetQtyForm(0);
      setNewItemLineNoForm("");
      setNewItemNoteForm("");
      setNewItemLotForm("");
      setEditingMasterItemId(null);
      setTimeout(() => (document.getElementById('item-number-input') as HTMLInputElement)?.focus(), 50);
      return;
    }

    // ADD MODE
    const currentLines = editingOrder.masterItems || [];
    const nextLineNo = currentLines.length > 0 ? Math.max(...currentLines.map(m => parseInt(m.lineNo) || 0)) + 1 : 1;
    const resolvedLineNo = newItemLineNoForm.trim() ? newItemLineNoForm.trim() : nextLineNo.toString();

    const doAdd = async () => {
      const newMaster: MasterItem = { id: `m_${Date.now()}`, lineNo: resolvedLineNo, itemNumber: trimmed, orderedBoxes: 0, orderedQty: newItemTargetQtyForm || 0 };
      setEditingOrder({ ...editingOrder, masterItems: [...currentLines, newMaster].sort((a, b) => parseInt(a.lineNo) - parseInt(b.lineNo)) });
      setNewItemNumberForm("");
      setNewItemTargetQtyForm(0);
      setNewItemLineNoForm("");
      setNewItemNoteForm("");
      setNewItemLotForm("");
      setTimeout(() => (document.getElementById('item-number-input') as HTMLInputElement)?.focus(), 50);
      if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
        isSavingRef.current = true; savingCountRef.current++;
        await supabase.from('order_items').insert({ id: newMaster.id, order_id: editingOrder.id, line_no: newMaster.lineNo, item_number: newMaster.itemNumber, ordered_boxes: 0, ordered_qty: newMaster.orderedQty });
        setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
      }
      if (newItemNoteForm.trim() && !IS_PLACEHOLDER_CREDENTIALS && supabase) {
        await supabase.from('item_notes').upsert({
          item_number: trimmed,
          lot: newItemLotForm.trim() || null,
          note: newItemNoteForm.trim(),
          active: true,
        }, { onConflict: 'item_number' });
        setItemNotes(prev => {
          const exists = prev.find(n => n.itemNumber === trimmed);
          if (exists) return prev.map(n => n.itemNumber === trimmed ? { ...n, lot: newItemLotForm.trim(), note: newItemNoteForm.trim() } : n);
          return [...prev, { id: Date.now().toString(), itemNumber: trimmed, lot: newItemLotForm.trim(), note: newItemNoteForm.trim(), active: true }];
        });
      }
    };

    const duplicate = currentLines.find(m => m.itemNumber.trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setConfirmDialog({
        isOpen: true,
        title: "Item duplicado",
        message: `Item "${trimmed}" was already added on Line ${duplicate.lineNo}. Do you want to add it anyway?`,
        onConfirm: () => { doAdd(); setConfirmDialog(null); }
      });
    } else {
      await doAdd();
    }
  };

  const handleUpdateMasterItem = async (id: string, field: keyof MasterItem, value: any) => {
    if (!editingOrder) return;
    setEditingOrder({ ...editingOrder, masterItems: editingOrder.masterItems?.map(m => m.id === id ? { ...m, [field]: value } : m) });
    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
      const dbField = field === 'lineNo' ? 'line_no' : field === 'itemNumber' ? 'item_number' : field === 'orderedBoxes' ? 'ordered_boxes' : field === 'orderedQty' ? 'ordered_qty' : field;
      await supabase.from('order_items').update({ [dbField]: value }).eq('id', id);
    }
  };

  const handleDeleteMasterItem = (id: string) => {
    if (!editingOrder) return;
    setConfirmDialog({
      isOpen: true, title: "Delete Item", message: "Are you sure you want to remove this item from the list?",
      onConfirm: async () => {
        setEditingOrder({ ...editingOrder, masterItems: editingOrder.masterItems?.filter(m => m.id !== id) });
        setConfirmDialog(null);
        if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
          isSavingRef.current = true; savingCountRef.current++;
          await supabase.from('order_items').delete().eq('id', id);
          setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
        }
      }
    });
  };

  // --- Pallet Functions ---
  const handleAddPallet = async () => {
    if (!editingOrder) return;
    const list = editingOrder.palletList || [];
    const nextNum = list.length > 0 ? Math.max(...list.map(p => p.number)) + 1 : 1;
    const newPallet: PalletItem = { id: `p_${Date.now()}`, number: nextNum, boxes: 0, weight: "0.00", items: [] };
    // Optimistic update
    setEditingOrder({ ...editingOrder, palletList: [...list, newPallet] });
    setEditingPalletId(newPallet.id);
    // DB INSERT
    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
      isSavingRef.current = true;
      savingCountRef.current++;
      await supabase.from('pallets').insert({ id: newPallet.id, order_id: editingOrder.id, number: newPallet.number, weight: newPallet.weight, boxes: 0 });
      setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
    }
  };

  const handleRenumberPallets = async () => {
    if (!editingOrder?.palletList) return;
    const sorted = [...editingOrder.palletList].sort((a, b) => a.number - b.number);
    const renumbered = sorted.map((p, i) => ({ ...p, number: renumberStartFrom + i }));
    setEditingOrder({ ...editingOrder, palletList: renumbered });
    setShowRenumberForm(false);
    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
      await Promise.all(renumbered.map(p => supabase!.from('pallets').update({ number: p.number }).eq('id', p.id)));
    }
  };

  const handleMergePallets = async () => {
    if (!editingOrder?.palletList || !mergingPalletId || !mergeTargetId) return;
    const source = editingOrder.palletList.find(p => p.id === mergingPalletId);
    const target = editingOrder.palletList.find(p => p.id === mergeTargetId);
    if (!source || !target) return;
    const mergedItems = [...(target.items || []), ...(source.items || [])];
    const mergedBoxes = (Number(target.boxes) || 0) + (Number(source.boxes) || 0);
    const updatedList = editingOrder.palletList.map(p => {
      if (p.id === mergeTargetId) return { ...p, items: mergedItems, boxes: mergedBoxes };
      if (p.id === mergingPalletId) return { ...p, items: [], boxes: 0 };
      return p;
    });
    setEditingOrder({ ...editingOrder, palletList: updatedList });
    setMergingPalletId(null);
    setMergeTargetId('');
    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
      isSavingRef.current = true;
      savingCountRef.current++;
      await Promise.all((source.items || []).map(item =>
        supabase!.from('pallet_items').update({ pallet_id: mergeTargetId }).eq('id', item.id)
      ));
      await supabase!.from('pallets').update({ boxes: mergedBoxes }).eq('id', mergeTargetId);
      await supabase!.from('pallets').update({ boxes: 0 }).eq('id', mergingPalletId);
      setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
    }
  };

  const executeDeletePallet = async (pid: string) => {
    if (!editingOrder) return;
    const filteredList = editingOrder.palletList?.filter(p => p.id !== pid) || [];
    const reorganizedList = filteredList.map((p, index) => ({ ...p, number: index + 1 }));
    setEditingOrder({ ...editingOrder, palletList: reorganizedList });
    setConfirmDialog(null);
    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
      isSavingRef.current = true;
      savingCountRef.current++;
      // DELETE cascades to pallet_items automatically
      await supabase.from('pallets').delete().eq('id', pid);
      // Renumber remaining pallets
      await Promise.all(reorganizedList.map(p => supabase!.from('pallets').update({ number: p.number }).eq('id', p.id)));
      setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
    }
  };

  const handleSaveLineItem = async () => {
    if (!editingOrder || !editingPalletId || !lineItemForm.itemNumber) return;
    if (editingLineItemId) {
      // UPDATE existing item
      setEditingOrder(prev => {
        if (!prev) return prev;
        return { ...prev, palletList: prev.palletList?.map(p => p.id !== editingPalletId ? p : {
          ...p,
          items: p.items.map(i => i.id === editingLineItemId ? { ...lineItemForm, addedBy: i.addedBy || currentUser || 'Unknown' } : i),
          boxes: p.items.map(i => i.id === editingLineItemId ? { ...lineItemForm } : i).reduce((s, i) => s + (Number(i.boxes) || 0), 0),
        })};
      });
      if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
        isSavingRef.current = true; savingCountRef.current++;
        await supabase.from('pallet_items').update({ line_no: lineItemForm.lineNo, item_number: lineItemForm.itemNumber, boxes: lineItemForm.boxes, qty_per_box: lineItemForm.qtyPerBox }).eq('id', editingLineItemId);
        setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
      }
    } else {
      // INSERT new item
      const newId = `li_${Date.now()}`;
      const newItem: PalletLineItem = { ...lineItemForm, id: newId, addedBy: currentUser || 'Unknown' };
      setEditingOrder(prev => {
        if (!prev) return prev;
        return { ...prev, palletList: prev.palletList?.map(p => p.id !== editingPalletId ? p : {
          ...p,
          items: [...p.items, newItem],
          boxes: [...p.items, newItem].reduce((s, i) => s + (Number(i.boxes) || 0), 0),
        })};
      });
      if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
        isSavingRef.current = true; savingCountRef.current++;
        await supabase.from('pallet_items').insert({ id: newId, pallet_id: editingPalletId, order_id: editingOrder.id, line_no: lineItemForm.lineNo, item_number: lineItemForm.itemNumber, boxes: lineItemForm.boxes, qty_per_box: lineItemForm.qtyPerBox, added_by: currentUser || 'Unknown' });
        setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
      }
    }
    setLineItemForm({ id: "", lineNo: "", itemNumber: "", boxes: 0, qtyPerBox: 0 });
    setEditingLineItemId(null);
    setTimeout(() => itemsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleDeleteLineItem = async (palletId: string, itemId: string) => {
    if (!editingOrder) return;
    setEditingOrder(prev => {
      if (!prev) return prev;
      return { ...prev, palletList: prev.palletList?.map(p => p.id !== palletId ? p : {
        ...p,
        items: p.items.filter(i => i.id !== itemId),
        boxes: p.items.filter(i => i.id !== itemId).reduce((s, i) => s + (Number(i.boxes) || 0), 0),
      })};
    });
    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
      isSavingRef.current = true; savingCountRef.current++;
      await supabase.from('pallet_items').delete().eq('id', itemId);
      setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
    }
  };

  const handleMoveLineItem = async (itemId: string, sourcePalletId: string, destPalletNumber: number) => {
    if (!editingOrder) return;
    const destPallet = editingOrder.palletList?.find(p => p.number === destPalletNumber);
    if (!destPallet || destPallet.id === sourcePalletId) { setMovingLineItemId(null); return; }
    const item = editingOrder.palletList?.find(p => p.id === sourcePalletId)?.items.find(i => i.id === itemId);
    if (!item) return;

    setEditingOrder(prev => {
      if (!prev) return prev;
      return { ...prev, palletList: prev.palletList?.map(p => {
        if (p.id === sourcePalletId) {
          const newItems = p.items.filter(i => i.id !== itemId);
          return { ...p, items: newItems, boxes: newItems.reduce((s, i) => s + (Number(i.boxes) || 0), 0) };
        }
        if (p.id === destPallet.id) {
          const newItems = [...p.items, item];
          return { ...p, items: newItems, boxes: newItems.reduce((s, i) => s + (Number(i.boxes) || 0), 0) };
        }
        return p;
      })};
    });
    setMovingLineItemId(null);

    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
      isSavingRef.current = true; savingCountRef.current++;
      await supabase.from('pallet_items').update({ pallet_id: destPallet.id }).eq('id', itemId);
      setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
    }
  };

  const handleLineNoChange = (val: string) => {
    setLineItemForm(prev => {
      const masterItem = editingOrder?.masterItems?.find(m => m.lineNo === val);
      return { ...prev, lineNo: val, itemNumber: masterItem ? masterItem.itemNumber : prev.itemNumber };
    });
  };

  const handleBulkLineNoChange = (val: string) => {
    const masterItem = editingOrder?.masterItems?.find(m => m.lineNo === val);
    setBulkForm(prev => ({ ...prev, lineNo: val, itemNo: masterItem ? masterItem.itemNumber : prev.itemNo }));
  };

  const executeMovePallet = async () => {
    if (!editingOrder || !editingOrder.palletList || !movingPalletId) return;
    const currentList = [...editingOrder.palletList];
    const currentIndex = currentList.findIndex(p => p.id === movingPalletId);
    if(currentIndex === -1) return;

    let newPos = targetPosition - 1;
    if(newPos < 0) newPos = 0;
    if(newPos >= currentList.length) newPos = currentList.length - 1;

    const [removed] = currentList.splice(currentIndex, 1);
    currentList.splice(newPos, 0, removed);
    const reorganizedList = currentList.map((p, index) => ({ ...p, number: index + 1 }));
    setEditingOrder({ ...editingOrder, palletList: reorganizedList });
    setMovingPalletId(null);
    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
      isSavingRef.current = true; savingCountRef.current++;
      await Promise.all(reorganizedList.map(p => supabase!.from('pallets').update({ number: p.number }).eq('id', p.id)));
      setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
    }
  };

  const handleProcessBulkAdd = async () => {
    if (!editingOrder) return;
    const list = [...(editingOrder.palletList || [])];
    let nextNum = list.length > 0 ? Math.max(...list.map(p => p.number)) + 1 : 1;
    const count = parseInt(bulkForm.numPallets) || 0;
    if (count <= 0) return;

    const newPallets: PalletItem[] = [];
    const ts = Date.now();
    for (let i = 0; i < count; i++) {
      const b = bulkTab === 'looms' ? 0 : parseInt(bulkForm.boxes) || 0;
      const q = bulkTab === 'looms' ? parseInt(bulkForm.loomSize) : parseInt(bulkForm.qtyPerBox) || 0;
      const palletId = `p_${ts}_${i}`;
      const newItem: PalletLineItem = { id: `li_${ts}_${i}`, lineNo: bulkForm.lineNo, itemNumber: bulkTab === 'looms' ? bulkForm.loomSize : bulkForm.itemNo, boxes: b, qtyPerBox: q, addedBy: currentUser || 'System' };
      newPallets.push({ id: palletId, number: nextNum++, boxes: b, weight: bulkTab === 'looms' ? bulkForm.weight : "0.00", items: [newItem] });
    }

    setEditingOrder({ ...editingOrder, palletList: [...list, ...newPallets].sort((a, b) => a.number - b.number) });
    setIsBulkModalOpen(false);

    if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
      isSavingRef.current = true; savingCountRef.current++;
      await supabase.from('pallets').insert(newPallets.map(p => ({ id: p.id, order_id: editingOrder.id, number: p.number, weight: p.weight, boxes: p.boxes })));
      await supabase.from('pallet_items').insert(newPallets.flatMap(p => p.items.map(i => ({ id: i.id, pallet_id: p.id, order_id: editingOrder.id, line_no: i.lineNo, item_number: i.itemNumber, boxes: i.boxes, qty_per_box: i.qtyPerBox, added_by: i.addedBy }))));
      setTimeout(() => { savingCountRef.current = Math.max(0, savingCountRef.current - 1); if (savingCountRef.current === 0) isSavingRef.current = false; }, 3000);
    }
  };

  // --- Print Functions ---
  const triggerPrint = (mode: typeof printMode) => {
    setPrintMode(mode);
    setTimeout(() => { window.print(); }, 500);
  };

  const printPalletSheet = (pallet: PalletItem) => {
    setPrintTargetPallet(pallet);
    triggerPrint('pallet_sheet_single');
  };

  const printLabel = (pallet: PalletItem) => {
    setPrintTargetPallet(pallet);
    triggerPrint('label_single');
  };

  // --- Reusable Renderer for Order Cards ---
  const renderOrderCard = (order: Order, isReadOnly: boolean = false) => {
    const isDelayed = order.status === 'Delayed';
    const isCompleted = order.status === 'Completed';
    const totalP = order.isManualOverride ? order.pallets : (order.normalPallets || 0) + (order.loomPallets || 0);
    const normalP = order.isManualOverride ? (order.normalPallets || 0) : (order.palletList?.filter(p => !isLoomPallet(p)).length || 0);
    const loomP   = order.isManualOverride ? (order.loomPallets  || 0) : (order.palletList?.filter(p =>  isLoomPallet(p)).length || 0);
    const hasWork = totalP > 0 || (Number(order.looseBoxes) || 0) > 0;

    // Auto-derive display status: "No empezada" if nothing has been added yet
    const isNotStarted = !hasWork && !isCompleted && !isDelayed;
    const displayStatus = isNotStarted ? 'Not Started' : order.status;
    const accentColor = isCompleted ? 'bg-emerald-400' : isDelayed ? 'bg-rose-400' : isNotStarted ? 'bg-gray-300' : 'bg-orange-400';
    const cardBg = isCompleted
      ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 hover:shadow-md'
      : isDelayed
      ? 'bg-rose-50 border-rose-200 hover:border-rose-300 hover:shadow-md'
      : isNotStarted
      ? 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-md'
      : 'bg-orange-50 border-orange-200 hover:border-orange-300 hover:shadow-md';
    const statPanelBg = isCompleted ? 'bg-emerald-100/60 border-l-emerald-200 divide-emerald-200'
      : isDelayed ? 'bg-rose-100/60 border-l-rose-200 divide-rose-200'
      : isNotStarted ? 'bg-gray-100/60 border-l-gray-200 divide-gray-200'
      : 'bg-orange-100/60 border-l-orange-200 divide-orange-200';
    const statLabel = isCompleted ? 'text-emerald-500' : isDelayed ? 'text-rose-400' : isNotStarted ? 'text-gray-400' : 'text-orange-400';
    const statusColor = isCompleted ? 'text-emerald-600' : isDelayed ? 'text-rose-600' : isNotStarted ? 'text-gray-400' : 'text-orange-600';
    const StatusIcon = isCompleted ? CheckCircle2 : isDelayed ? AlertCircle : isNotStarted ? Archive : Clock;
    const divider = isCompleted ? 'border-emerald-100' : isDelayed ? 'border-rose-100' : isNotStarted ? 'border-gray-100' : 'border-orange-100';

    return (
      <div
        key={order.id}
        onClick={() => openFullDetails(order)}
        className={`rounded-2xl border-2 transition-all w-full sm:w-[300px] flex-shrink-0 cursor-pointer overflow-hidden group flex ${cardBg}`}
      >
        {/* Left accent stripe */}
        <div className={`w-[5px] shrink-0 ${accentColor}`} />

        {/* Main content */}
        <div className="flex-1 p-3 min-w-0">
          {/* Status + copy */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${statusColor}`}>
                <StatusIcon className="w-3 h-3 shrink-0" />
                {displayStatus}
              </span>
              {order.isManualOverride && (
                <span className="flex items-center gap-0.5 text-[10px] font-black uppercase text-white bg-amber-500 px-2 py-0.5 rounded shadow-sm leading-none">
                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> MANUAL
                </span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(order.id); }}
              title="Copiar"
              className="p-0.5 text-gray-400 hover:text-orange-400 transition-colors opacity-40 group-hover:opacity-100 shrink-0"
            ><Copy className="w-3 h-3"/></button>
          </div>

          {/* Order ID — full width, never truncates */}
          <h3 className="text-gray-900 font-black text-[17px] leading-tight group-hover:text-orange-600 transition-colors mb-2 break-all">{order.id}</h3>

          {/* PO + Truck */}
          <div className={`pt-2 border-t text-[12px] text-gray-500 space-y-0.5 ${divider}`}>
            <div><span className="font-medium">PO:</span> <span className="text-gray-800 font-bold">{order.po || "N/A"}</span></div>
            <div><span className="font-medium">Truck:</span> <span className="text-gray-800 font-bold">{order.truckId || "Unassigned"}</span></div>
          </div>

          {/* Lines Pending badge + BO detail tags */}
          {!isReadOnly && order.masterItems && order.masterItems.length > 0 && (() => {
            const pendingCount = order.masterItems.filter(m => {
              const mQty = Number(m.orderedQty) || 0;
              return mQty > 0 && getPackedQtyForLine(m.lineNo, order) < mQty;
            }).length;
            const backorders = getBackorders(order);
            return (
              <div className="mt-1.5 flex flex-col gap-1">
                {pendingCount > 0 ? (
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded w-max flex items-center gap-1">
                    ⏳ {pendingCount} Line{pendingCount !== 1 ? 's' : ''} Pending
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded w-max flex items-center gap-1">
                    ✅ All Lines Complete
                  </span>
                )}
                {backorders.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {backorders.map((bo, idx) => (
                      <span key={idx} className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                        BO L{bo.lineNo}: -{bo.missingQty > 0 ? bo.missingQty.toLocaleString() + 'pcs' : bo.missingBoxes.toLocaleString() + 'bxs'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Notes */}
          {order.notes && (
            <p className="mt-1.5 text-[11px] text-gray-500 italic line-clamp-2 leading-snug">{order.notes}</p>
          )}

          {/* Edit/Delete */}
          {!isReadOnly && (
            <div className="flex gap-1 justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => openQuickEdit(order)} className="p-1 text-gray-500 hover:text-orange-500 hover:bg-white/60 rounded-lg transition-all" title="Quick Edit"><Pencil className="w-5 h-5" /></button>
              <button onClick={() => setConfirmDialog({isOpen:true, title:"Delete Order", message:"Are you sure you want to delete this order?", onConfirm:() => executeDeleteOrder({ orderId: order.id })})} className="p-1 text-gray-500 hover:text-red-600 hover:bg-white/60 rounded-lg transition-all" title="Delete"><Trash2 className="w-5 h-5" /></button>
            </div>
          )}
        </div>

        {/* Right: vertical stats panel */}
        <div className={`flex flex-col divide-y border-l w-[68px] shrink-0 ${statPanelBg}`}>
          {/* Normal Pallets */}
          <div className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-center">
            <p className={`text-[8px] font-black uppercase tracking-wide mb-0.5 ${statLabel}`}>Plts</p>
            <p className="text-[15px] font-black text-gray-900 leading-none">{normalP}</p>
          </div>
          {/* Loom Pallets — only shown when > 0, completely separate */}
          {loomP > 0 && (
            <div className={`flex flex-col items-center justify-center py-1.5 px-1 text-center ${statPanelBg}`}>
              <p className={`text-[8px] font-black uppercase tracking-wide mb-0.5 ${statLabel}`}>Looms</p>
              <p className="text-[15px] font-black text-gray-900 leading-none">{loomP}</p>
            </div>
          )}
          {/* Boxes */}
          <div className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-center">
            <p className={`text-[8px] font-black uppercase tracking-wide mb-0.5 ${statLabel}`}>Boxes</p>
            <p className="text-[15px] font-black text-gray-900 leading-none">{Number(order.boxes||0).toLocaleString()}</p>
          </div>
          {/* Weight */}
          <div className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-center">
            <p className={`text-[8px] font-black uppercase tracking-wide mb-0.5 ${statLabel}`}>Lbs</p>
            <p className="text-[13px] font-black text-gray-900 leading-none">{Number(order.weight||0).toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // RENDER: LOGIN
  // -------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f9f7f4] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin"/>
          <span className="text-sm font-medium text-gray-500">Verifying session…</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f9f7f4] flex items-center justify-center font-sans p-4">
        <div className="w-full max-w-sm">
          {/* Brand mark */}
          <div className="flex justify-center mb-8">
            <RabbitLogo className="h-20 w-auto" />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h1 className="text-xl font-black text-gray-900 mb-1">Welcome back</h1>
            <p className="text-gray-400 text-sm mb-7">Sign in to continue</p>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email</label>
                <input name="email" type="email" autoFocus required className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none transition-all placeholder:text-gray-400" placeholder="you@mail.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                <input name="password" type="password" required className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none transition-all placeholder:text-gray-400" placeholder="••••••••" />
              </div>
              {loginError && (
                <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-xl px-3 py-2">{loginError}</p>
              )}
              <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold shadow-sm transition-colors mt-1">Sign In</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: PRINT PREVIEW MODE
  // -------------------------------------------------------------------------
  if (printMode !== 'none') {
    return (
      <div className="bg-white min-h-screen text-black">
        <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
           <button onClick={() => window.print()} className="bg-orange-500 text-white px-4 py-2 rounded shadow-lg font-bold">Print</button>
           <button onClick={() => setPrintMode('none')} className="bg-gray-800 text-white px-4 py-2 rounded shadow-lg font-bold">Close Preview</button>
        </div>

        {/* Zero margins for label print modes */}
        {(printMode === 'labels_all' || printMode === 'label_single') && (
          <style>{`@page { margin: 0; } @media print { body { margin: 0; padding: 0; } }`}</style>
        )}

        {/* LABELS */}
        {(printMode === 'labels_all' && editingOrder?.palletList) && editingOrder.palletList.map(p => (
          <div key={p.id} className="label-page flex flex-col justify-center items-center text-center border-b border-gray-300 print:border-none" style={{ width: '4in', height: '2in', padding: '0.2in', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '26px', fontWeight: '900' }}>Order: {editingOrder.id}</h1>
            <p style={{ margin: '0 0 8px 0', fontSize: '16px' }}>PO: {editingOrder.po || 'N/A'}</p>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '26px', fontWeight: '900' }}>Pallet {p.number} {isLoomPallet(p) ? '(Loom)' : ''}</h2>
            <p style={{ margin: '0', fontSize: '14px' }}>Ship Date: {editingOrder.shipmentDate}</p>
          </div>
        ))}
        {(printMode === 'label_single' && printTargetPallet) && (
          <div className="label-page flex flex-col justify-center items-center text-center border-b border-gray-300 print:border-none" style={{ width: '4in', height: '2in', padding: '0.2in', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '26px', fontWeight: '900' }}>Order: {editingOrder?.id}</h1>
            <p style={{ margin: '0 0 8px 0', fontSize: '16px' }}>PO: {editingOrder?.po || 'N/A'}</p>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '26px', fontWeight: '900' }}>Pallet {printTargetPallet.number} {isLoomPallet(printTargetPallet) ? '(Loom)' : ''}</h2>
            <p style={{ margin: '0', fontSize: '14px' }}>Ship Date: {editingOrder?.shipmentDate}</p>
          </div>
        )}

        {/* PALLET SHEETS */}
        {(printMode === 'pallet_sheets_all' && editingOrder?.palletList) && editingOrder.palletList.map(pallet => (
          <div key={pallet.id} className="sheet-page p-8 font-sans mx-auto max-w-[8.5in] border-b border-gray-300 print:border-none">
            <h1 className="text-center text-base font-bold mb-4">Pallet {pallet.number} {isLoomPallet(pallet) ? '(Loom)' : ''}</h1>
            <div className="border border-gray-300 px-4 py-3 rounded mb-5 bg-gray-50 text-center text-xs grid grid-cols-2 gap-x-6 gap-y-1 max-w-sm mx-auto">
              <p><b>Order #:</b> {editingOrder.id}</p>
              <p><b>PO:</b> {editingOrder.po}</p>
              <p><b>Ship Date:</b> {editingOrder.shipmentDate}</p>
              <p><b>Weight:</b> {pallet.weight} lbs</p>
            </div>
            <h3 className="text-xs font-bold mb-2 uppercase tracking-wide text-gray-600">Items on Pallet</h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead><tr className="bg-gray-100"><th className="px-2 py-1.5 border-b-2 border-gray-300">LINE</th><th className="px-2 py-1.5 border-b-2 border-gray-300">ITEM #</th><th className="px-2 py-1.5 border-b-2 border-gray-300 text-center">BOXES / PLT</th><th className="px-2 py-1.5 border-b-2 border-gray-300 text-center">QTY/BOX</th><th className="px-2 py-1.5 border-b-2 border-gray-300 text-right">TOTAL PCS</th></tr></thead>
              <tbody>{[...(pallet.items || [])].sort((a,b) => parseInt(a.lineNo||'0') - parseInt(b.lineNo||'0')).map(i => {
                const isLoom = i.boxes === 0 && LOOM_SIZES.includes(String(i.qtyPerBox));
                const bxs = isLoom ? 1 : i.boxes;
                return (<tr key={i.id}><td className="px-2 py-1.5 border-b border-gray-200">{i.lineNo}</td><td className="px-2 py-1.5 border-b border-gray-200">{i.itemNumber}</td><td className="px-2 py-1.5 border-b border-gray-200 text-center">{Number(bxs||0).toLocaleString()}</td><td className="px-2 py-1.5 border-b border-gray-200 text-center">{(Number(i.qtyPerBox)||0).toLocaleString()}</td><td className="px-2 py-1.5 border-b border-gray-200 text-right">{(bxs * (Number(i.qtyPerBox)||0)).toLocaleString()}</td></tr>)
              })}</tbody>
            </table>
            {!isLoomPallet(pallet) && <p className="text-right mt-4 text-xs font-bold">Total Boxes on Pallet: {pallet.boxes}</p>}
          </div>
        ))}
        {(printMode === 'pallet_sheet_single' && printTargetPallet) && (
          <div className="sheet-page p-8 font-sans mx-auto max-w-[8.5in] border-b border-gray-300 print:border-none">
            <h1 className="text-center text-base font-bold mb-4">Pallet {printTargetPallet.number} {isLoomPallet(printTargetPallet) ? '(Loom)' : ''}</h1>
            <div className="border border-gray-300 px-4 py-3 rounded mb-5 bg-gray-50 text-center text-xs grid grid-cols-2 gap-x-6 gap-y-1 max-w-sm mx-auto"><p><b>Order #:</b> {editingOrder?.id}</p><p><b>PO:</b> {editingOrder?.po}</p><p><b>Ship Date:</b> {editingOrder?.shipmentDate}</p><p><b>Weight:</b> {printTargetPallet.weight} lbs</p></div>
            <h3 className="text-xs font-bold mb-2 uppercase tracking-wide text-gray-600">Items on Pallet</h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead><tr className="bg-gray-100"><th className="px-2 py-1.5 border-b-2 border-gray-300">LINE</th><th className="px-2 py-1.5 border-b-2 border-gray-300">ITEM #</th><th className="px-2 py-1.5 border-b-2 border-gray-300 text-center">BOXES / PLT</th><th className="px-2 py-1.5 border-b-2 border-gray-300 text-center">QTY/BOX</th><th className="px-2 py-1.5 border-b-2 border-gray-300 text-right">TOTAL PCS</th></tr></thead>
              <tbody>{[...(printTargetPallet.items || [])].sort((a,b) => parseInt(a.lineNo||'0') - parseInt(b.lineNo||'0')).map(i => {
                const isLoom = i.boxes === 0 && LOOM_SIZES.includes(String(i.qtyPerBox));
                const bxs = isLoom ? 1 : i.boxes;
                return (<tr key={i.id}><td className="px-2 py-1.5 border-b border-gray-200">{i.lineNo}</td><td className="px-2 py-1.5 border-b border-gray-200">{i.itemNumber}</td><td className="px-2 py-1.5 border-b border-gray-200 text-center">{Number(bxs||0).toLocaleString()}</td><td className="px-2 py-1.5 border-b border-gray-200 text-center">{(Number(i.qtyPerBox)||0).toLocaleString()}</td><td className="px-2 py-1.5 border-b border-gray-200 text-right">{(bxs * (Number(i.qtyPerBox)||0)).toLocaleString()}</td></tr>)
              })}</tbody>
            </table>
            {!isLoomPallet(printTargetPallet) && <p className="text-right mt-4 text-xs font-bold">Total Boxes on Pallet: {printTargetPallet.boxes}</p>}
          </div>
        )}

        {/* PACKING LIST GROUPED BY LINE */}
        {printMode === 'packing_list' && (
          <div className="p-6 font-sans mx-auto max-w-[8.5in]">
            <style>{'@media print { @page { margin: 0.4in; size: letter portrait; } body { margin: 0; } }'}</style>
            <h1 className="text-center text-sm font-bold mb-2 text-[#2c3e50]">Distribution List</h1>
            <div className="mb-3 text-xs">
              <p><b>Order #:</b> {editingOrder?.id} | <b>PO:</b> {editingOrder?.po} | <b>Ship Date:</b> {editingOrder?.shipmentDate}</p>
              <p><b>Total Boxes for Order:</b> {totals.boxes.toLocaleString()}</p>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 uppercase text-[10px] text-gray-600">
                  <th className="px-2 py-1 border-b border-gray-300">Line</th>
                  <th className="px-2 py-1 border-b border-gray-300">Pallet ID</th>
                  <th className="px-2 py-1 border-b border-gray-300">Item #</th>
                  <th className="px-2 py-1 border-b border-gray-300 text-center">Boxes / Plts</th>
                  <th className="px-2 py-1 border-b border-gray-300 text-center">Qty/Box</th>
                  <th className="px-2 py-1 border-b border-gray-300 text-right">Total Pcs</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const allFlat = editingOrder?.palletList?.flatMap(p => (p.items || []).map(i => ({...i, palletId: p.number}))) || [];
                  const grouped = allFlat.reduce((acc, item) => {
                    if(!acc[item.lineNo]) acc[item.lineNo] = [];
                    acc[item.lineNo].push(item);
                    return acc;
                  }, {} as Record<string, typeof allFlat>);
                  const sortedLines = Object.keys(grouped).sort((a,b) => parseInt(a)-parseInt(b));
                  
                  return sortedLines.map(line => {
                    const items = grouped[line];
                    let subBoxes = 0;
                    let subPcs = 0;
                    
                    return (
                      <React.Fragment key={line}>
                        {items.map((it, idx) => {
                          const isLoom = it.boxes === 0 && LOOM_SIZES.includes(String(it.qtyPerBox));
                          const bxs = isLoom ? 1 : (Number(it.boxes)||0);
                          const pcs = isLoom ? Number(it.qtyPerBox) : bxs * (Number(it.qtyPerBox)||0);
                          subBoxes += bxs;
                          subPcs += pcs;

                          return (
                          <tr key={`${line}-${it.id}-${idx}`} className="border-b border-gray-100">
                            <td className="px-2 py-1">{it.lineNo}</td>
                            <td className="px-2 py-1">Pallet {it.palletId}</td>
                            <td className="px-2 py-1">{it.itemNumber}</td>
                            <td className="px-2 py-1 text-center">{bxs.toLocaleString()}</td>
                            <td className="px-2 py-1 text-center">{(Number(it.qtyPerBox)||0).toLocaleString()}</td>
                            <td className="px-2 py-1 text-right">{pcs.toLocaleString()}</td>
                          </tr>
                          )
                        })}
                        <tr className="bg-gray-50 border-b-2 border-gray-300 font-bold text-gray-800">
                          <td colSpan={3} className="px-2 py-1 text-right">Subtotal Line {line}:</td>
                          <td className="px-2 py-1 text-center">{subBoxes.toLocaleString()}</td>
                          <td className="px-2 py-1 text-center">-</td>
                          <td className="px-2 py-1 text-right">{subPcs.toLocaleString()}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* WEIGHT SHEET */}
        {printMode === 'weight_sheet' && (
          <div className="p-6 font-sans mx-auto max-w-[8.5in]">
            <style>{'@media print { @page { margin: 0.4in; size: letter portrait; } body { margin: 0; } }'}</style>
            <h1 className="text-center text-base font-bold mb-2">Weight Sheet</h1>
            <div className="mb-3 text-xs">
              <p><b>Order #:</b> {editingOrder?.id} | <b>PO:</b> {editingOrder?.po}</p>
              <p><b>Ship Date:</b> {editingOrder?.shipmentDate} &nbsp;|&nbsp; <b>Total Boxes:</b> {totals.boxes.toLocaleString()}</p>
              {(() => {
                const myPallets = editingOrder?.palletList?.length || 0;
                const partnerCount = partnerPalletList.length;
                const myWeight = Number(totals.weight || 0);
                const partnerW = partnerPalletList.reduce((s, p) => s + (parseFloat((p.weight||'').replace(/,/g,'')) || 0), 0);
                const combinedWeight = myWeight + partnerW;
                return (
                  <p>
                    <b>Total Pallets:</b> {myPallets + partnerCount}
                    &nbsp;|&nbsp;
                    <b>Total Weight:</b> {combinedWeight > 0 ? combinedWeight.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' lbs' : '—'}
                  </p>
                );
              })()}
            </div>

            {/* BO Section — shown right below order info */}
            {editingOrder && (() => {
              const pendingItems = (editingOrder.masterItems || [])
                .filter(m => {
                  const ordQty = Number(m.orderedQty) || 0;
                  if (ordQty === 0) return false;
                  const packed = getPackedQtyForLine(m.lineNo, editingOrder);
                  return packed < ordQty;
                })
                .map(m => ({
                  lineNo: m.lineNo,
                  itemNumber: m.itemNumber,
                  orderedQty: Number(m.orderedQty) || 0,
                  packedQty: getPackedQtyForLine(m.lineNo, editingOrder),
                  missingQty: Math.max(0, (Number(m.orderedQty) || 0) - getPackedQtyForLine(m.lineNo, editingOrder)),
                }));
              if (pendingItems.length === 0) return null;
              return (
                <div className="mb-3 border border-gray-800 rounded p-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-800 mb-1.5">⚠ Pending / Back Orders</p>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100 uppercase text-[10px] text-gray-600">
                        <th className="px-2 py-1 border border-gray-400">Line #</th>
                        <th className="px-2 py-1 border border-gray-400">Item #</th>
                        <th className="px-2 py-1 border border-gray-400 text-right">Ordered</th>
                        <th className="px-2 py-1 border border-gray-400 text-right">Shipped</th>
                        <th className="px-2 py-1 border border-gray-400 text-right">Missing (pcs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingItems.map((item, i) => (
                        <tr key={i} className={item.packedQty === 0 ? 'bg-red-50' : ''}>
                          <td className="px-2 py-1 border border-gray-300 font-bold">{item.lineNo}</td>
                          <td className="px-2 py-1 border border-gray-300">{item.itemNumber || '—'}</td>
                          <td className="px-2 py-1 border border-gray-300 text-right">{item.orderedQty.toLocaleString()}</td>
                          <td className="px-2 py-1 border border-gray-300 text-right">{item.packedQty.toLocaleString()}</td>
                          <td className="px-2 py-1 border border-gray-300 text-right font-bold text-red-700">{item.missingQty.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {(() => {
              const partnerBoxes = partnerPalletList.reduce((s, p) => s + (Number(p.boxes)||0), 0);
              const partnerW = partnerPalletList.reduce((s, p) => s + (parseFloat((p.weight||'').replace(/,/g,'')) || 0), 0);
              const grandBoxes = Number(totals.boxes || 0) + partnerBoxes;
              const grandWeight = Number(totals.weight || 0) + partnerW;
              return (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 uppercase text-[10px] text-gray-600">
                      <th className="px-3 py-1.5 border-b border-gray-300">Pallet ID</th>
                      <th className="px-3 py-1.5 border-b border-gray-300 text-center">Total Boxes on Pallet</th>
                      <th className="px-3 py-1.5 border-b border-gray-300 text-right">Weight (lbs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...(editingOrder?.palletList || []).map(p => ({ kind: 'mine' as const, sortNum: p.number, data: p })),
                      ...partnerPalletList.map(pp => ({ kind: 'partner' as const, sortNum: Number(pp.number) || 0, data: pp })),
                    ].sort((a, b) => a.sortNum - b.sortNum).map(entry => {
                      if (entry.kind === 'mine') {
                        const p = entry.data;
                        const displayWeight = p.weight && p.weight !== "0.00" && p.weight !== "0" ? p.weight : "";
                        return (
                          <tr key={p.id} className="border-b border-gray-200">
                            <td className="px-3 py-1.5 text-gray-800 font-medium">Pallet {p.number} {isLoomPallet(p) ? '(Loom)' : ''}</td>
                            <td className="px-3 py-1.5 text-center text-gray-800">{Number(p.boxes||0).toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right"><div className="inline-block min-w-[90px] h-5 border-b border-gray-400">{displayWeight}</div></td>
                          </tr>
                        );
                      } else {
                        const pp = entry.data;
                        const w = parseFloat((pp.weight||'').replace(/,/g,'')) || 0;
                        return (
                          <tr key={pp.id} className="border-b border-gray-200">
                            <td className="px-3 py-1.5 text-gray-800 font-medium">Pallet {pp.number}</td>
                            <td className="px-3 py-1.5 text-center text-gray-800">{Number(pp.boxes||0).toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right"><div className="inline-block min-w-[90px] h-5 border-b border-gray-400">{w > 0 ? pp.weight : ''}</div></td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                      <td className="px-3 py-2 text-gray-800">GRAND TOTAL</td>
                      <td className="px-3 py-2 text-center text-gray-800">{grandBoxes.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-gray-900">
                        {grandWeight > 0 ? grandWeight.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' lbs' : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              );
            })()}

          </div>
        )}

        {/* TRUCK REPORT */}
        {printMode === 'truck_report' && (
          <div className="p-8 font-sans mx-auto max-w-[8.5in] sheet-page">
            <h1 className="text-center text-lg font-bold mb-1 text-[#2c3e50]">Shipping Report</h1>
            <h2 className="text-center text-sm font-semibold mb-6 text-gray-600">Date: {formatDateLong(reportDate)}</h2>

            {truckReportSummary.trucks.map(t => (
              <div key={t.id} className="mb-6">
                <h3 className="text-xs font-bold mb-1.5 uppercase tracking-wide text-gray-700">Truck: {t.id}</h3>
                <table className="w-full text-xs text-left border-collapse mb-1">
                  <thead className="bg-gray-100 uppercase text-[9px] text-gray-600">
                    <tr>
                      <th className="px-2 py-1.5 border-b border-gray-300">ORDER #</th><th className="px-2 py-1.5 border-b border-gray-300">PO #</th><th className="px-2 py-1.5 border-b border-gray-300">FREIGHT</th>
                      <th className="px-2 py-1.5 border-b border-gray-300 text-center">LOOM PLTS</th><th className="px-2 py-1.5 border-b border-gray-300 text-center">NORMAL PLTS</th>
                      <th className="px-2 py-1.5 border-b border-gray-300 text-center">TOTAL BOXES</th><th className="px-2 py-1.5 border-b border-gray-300 text-right">WEIGHT (LBS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.ordersData.map(o => (
                      <tr key={o.id} className="border-b border-gray-100">
                        <td className="px-2 py-1.5">{o.id}</td><td className="px-2 py-1.5">{o.po}</td><td className="px-2 py-1.5">{o.freight}</td>
                        <td className="px-2 py-1.5 text-center font-bold">{o.loomPlts}</td><td className="px-2 py-1.5 text-center">{o.normalPlts}</td>
                        <td className="px-2 py-1.5 text-center">{Number(o.finalBoxes||0).toLocaleString()}</td><td className="px-2 py-1.5 text-right">{Number(o.finalWeight||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold text-gray-800">
                       <td colSpan={3} className="px-2 py-1.5 text-right text-[10px]">Totals for {t.id}:</td>
                       <td className="px-2 py-1.5 text-center font-bold">{t.tLoom}</td><td className="px-2 py-1.5 text-center">{t.tNormal}</td>
                       <td className="px-2 py-1.5 text-center">{Number(t.tBoxes||0).toLocaleString()}</td><td className="px-2 py-1.5 text-right">{Number(t.tWeight||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}

            <div className="mt-8 pt-4 border-t-2 border-gray-800">
              <h3 className="text-xs font-bold mb-3 uppercase tracking-wider text-gray-700">Grand Totals — {formatDateLong(reportDate)}</h3>
              <div className="flex gap-3">
                <div className="flex-1 bg-gray-100 rounded p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold mb-0.5 whitespace-nowrap">Trucks / Methods</p>
                  <p className="text-xl font-black text-gray-900">{truckReportSummary.grandTrucks}</p>
                </div>
                <div className="flex-1 bg-gray-100 rounded p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold mb-0.5">Loom Pallets</p>
                  <p className="text-xl font-black text-gray-900">{truckReportSummary.grandLoomPlts}</p>
                </div>
                <div className="flex-1 bg-gray-100 rounded p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold mb-0.5">Normal Pallets</p>
                  <p className="text-xl font-black text-gray-900">{truckReportSummary.grandNormalPlts}</p>
                </div>
                <div className="flex-1 bg-gray-100 rounded p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold mb-0.5">Total Boxes</p>
                  <p className="text-xl font-black text-gray-900">{truckReportSummary.grandBoxes.toLocaleString()}</p>
                </div>
                <div className="flex-[1.5] bg-gray-100 rounded p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold mb-0.5 whitespace-nowrap">Total Weight</p>
                  <p className="text-xl font-black text-gray-900">{truckReportSummary.grandWeight.toLocaleString()} <span className="text-sm font-bold text-gray-500">lbs</span></p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* CONSOLIDATION FORM */}
        {printMode === 'consolidation_form' && (
          <div style={{ fontFamily: 'Arial, sans-serif', padding: '0.45in', maxWidth: '8.5in', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ borderBottom: '2.5px solid #1e293b', paddingBottom: '10px', marginBottom: '18px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '2px' }}>
                Warehouse Consolidation Form
              </h1>
              <div style={{ display: 'flex', gap: '40px', marginTop: '8px', fontSize: '11px', color: '#475569' }}>
                <span>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span>Operator Name: ________________________________________</span>
              </div>
            </div>
            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', border: '2px solid #334155', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '9%' }} />   {/* DATE */}
                <col style={{ width: '27%' }} />  {/* LOT # */}
                <col style={{ width: '9%' }} />   {/* QTY/BOX */}
                <col style={{ width: '8%' }} />   {/* BOXES */}
                <col style={{ width: '9%' }} />   {/* TOTAL PCS */}
                <col style={{ width: '19%' }} />  {/* ORIGINAL BIN */}
                <col style={{ width: '19%' }} />  {/* MOVED TO */}
              </colgroup>
              <thead>
                <tr>
                  {['DATE', 'LOT #', 'QTY / BOX', 'BOXES', 'TOTAL PCS', 'ORIGINAL BIN', 'MOVED TO'].map(h => (
                    <th key={h} style={{ border: '1px solid #64748b', padding: '9px 8px', textAlign: 'left', fontWeight: '800', fontSize: '10px', letterSpacing: '0.5px', backgroundColor: '#f1f5f9', color: '#1e293b', overflow: 'hidden' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} style={{ height: '3.2rem', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} style={{ border: '1px solid #94a3b8', padding: '4px 8px', overflow: 'hidden' }}>&nbsp;</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '18px', fontSize: '9px', color: '#94a3b8', textAlign: 'right' }}>
              Operations & Logistics Dashboard
            </div>
          </div>
        )}

        {/* QUICK LABEL 4x2 */}
        {printMode === 'label_4x2' && (
          <div style={{ width: '4in', height: '2in', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.15in', boxSizing: 'border-box', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
            <p style={{ margin: 0, fontWeight: '900', lineHeight: 1, textAlign: 'center', wordBreak: 'break-word', fontSize: '15vw' }}>
              {labelContent || '—'}
            </p>
          </div>
        )}

        {/* QUICK LABEL 4x4 */}
        {printMode === 'label_4x4' && (
          <div style={{ width: '4in', height: '4in', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.2in', boxSizing: 'border-box', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
            <p style={{ margin: 0, fontWeight: '900', lineHeight: 1, textAlign: 'center', wordBreak: 'break-word', fontSize: '20vw' }}>
              {labelContent || '—'}
            </p>
          </div>
        )}

        <style>{`@media print { .print\\:hidden { display: none !important; } @page { margin: 0.5in; } .label-page { page-break-after: always; width: 4in; height: 2in; margin: 0; padding: 0.2in; } .sheet-page { page-break-after: always; margin: 0; padding: 0.5in; width: 100%; } }`}</style>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: MAIN APPLICATION
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#f9f7f4] font-sans text-gray-900 selection:bg-orange-100">
      <header className="bg-white sticky top-0 z-30 px-4 sm:px-8 flex items-center h-14 sm:h-16 shadow-sm border-b border-gray-100 relative">
        {/* Logo */}
        <h1 className="text-lg sm:text-xl font-black tracking-tight select-none flex items-center gap-2">
          <RabbitLogo className="h-9 w-auto shrink-0" />
        </h1>
        {/* Nav */}
        <nav className="hidden sm:flex absolute left-1/2 -translate-x-1/2 h-full items-center gap-1">
          {[
            { id: "Order Summary", icon: <List className="w-4 h-4"/>, label: "Order Summary" },
            { id: "Create Order", icon: <Plus className="w-4 h-4"/>, label: "Create Order" },
            { id: "Truck Report", icon: <TruckIcon className="w-4 h-4"/>, label: "Truck Report" },
            { id: "Formats", icon: <FileText className="w-4 h-4"/>, label: "Formats" }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 h-full text-sm font-semibold flex items-center gap-2 transition-all border-b-2 ${activeTab === tab.id || (activeTab === "Order Details" && tab.id === "Order Summary") ? "border-orange-500 text-orange-600 bg-orange-50/50" : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
        {/* Usuario + hamburger */}
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <span className="hidden sm:inline text-sm text-gray-500">Logged in as <span className="font-bold text-gray-800">{currentUser}</span></span>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all" title="Log out"><LogOut className="w-5 h-5" /></button>
          <button onClick={() => setMobileMenuOpen(v => !v)} className="sm:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><Menu className="w-5 h-5"/></button>
        </div>
      </header>
      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-40 bg-gray-900/30" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-gray-100 shadow-lg" onClick={e => e.stopPropagation()}>
            {[
              { id: "Order Summary", icon: <List className="w-5 h-5"/>, label: "Order Summary" },
              { id: "Create Order", icon: <Plus className="w-5 h-5"/>, label: "Create Order" },
              { id: "Truck Report", icon: <TruckIcon className="w-5 h-5"/>, label: "Truck Report" },
              { id: "Formats", icon: <FileText className="w-5 h-5"/>, label: "Formats" }
            ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-semibold border-b border-gray-100 ${activeTab === tab.id || (activeTab === "Order Details" && tab.id === "Order Summary") ? "text-orange-600 bg-orange-50" : "text-gray-700 hover:bg-gray-50"}`}>
                {tab.icon} {tab.label}
              </button>
            ))}
            <div className="px-6 py-4 text-sm text-gray-500">Logged in as <span className="font-bold text-gray-800">{currentUser}</span></div>
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-4 py-6 sm:p-8">
        {activeTab === "Order Summary" && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-10">
              <div className="w-full max-w-xl">
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Dashboard</h2>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-400 transition-colors w-4 h-4" />
                  <input type="text" placeholder="Search Order ID, PO or Items..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border-2 border-white rounded-2xl shadow-md focus:border-orange-400 focus:ring-4 focus:ring-orange-400/10 outline-none transition-all" />
                </div>
              </div>
            </div>

            {/* ── NOTAS DE ITEMS ─────────────────────────────── */}
            <section className="mb-8">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Header — always visible */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <button
                    onClick={() => setIsTasksExpanded(v => !v)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <Package className="w-4 h-4 text-amber-500 flex-shrink-0"/>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Item Notes</h2>
                    {itemNotes.length > 0 && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                        {itemNotes.length}
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 ml-1 transition-transform flex-shrink-0 ${isTasksExpanded ? 'rotate-180' : ''}`}/>
                  </button>
                </div>
                {/* Notes list — collapsible */}
                {isTasksExpanded && (
                  <div className="divide-y divide-gray-100">
                    {itemNotes.length === 0 && (
                      <p className="text-center text-gray-400 text-sm py-6 font-medium">No item notes</p>
                    )}
                    {itemNotes.map(note => (
                      <div key={note.id} className="flex items-start gap-3 px-5 py-3 hover:bg-amber-50/20 transition-colors">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0 text-base">⚠</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-sm text-slate-800">{note.itemNumber}</span>
                            {note.lot && <span className="text-[11px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">{note.lot}</span>}
                          </div>
                          <p className="text-[12px] text-gray-600 mt-0.5">{note.note}</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
                              await supabase.from('item_notes').update({ active: false }).eq('id', note.id);
                              setItemNotes(prev => prev.filter(n => n.id !== note.id));
                            }
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                          title="Eliminar nota"
                        >
                          <X className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {delayedOrdersList.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center"><AlertTriangle className="w-5 h-5"/></div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Attention Required</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                  {delayedOrdersList.map(o => renderOrderCard(o))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight uppercase text-[13px] letter-spacing-widest">Shipping Schedule</h2>
              <div className="space-y-8">
                {activeDates.map(dg => {
                  // Conteo de órdenes completadas vs pendientes por fecha
                  const allOrdersInDate = dg.trucks.flatMap(t => t.orders);
                  const completedCount = allOrdersInDate.filter(o => o.status === 'Completed').length;
                  const pendingCount = allOrdersInDate.length - completedCount;
                  return (
                  <div key={dg.date} className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                    <button onClick={() => toggleDate(dg.date, dg.trucks)} className="w-full flex items-center justify-between p-5 bg-white hover:bg-orange-50/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="bg-orange-100 p-2 rounded-xl"><Calendar className="w-5 h-5 text-orange-600"/></div>
                        <span className="text-base font-black text-slate-800">Scheduled for {dg.date}</span>
                        <div className="flex items-center gap-2">
                          {completedCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{completedCount} Done</span>}
                          {pendingCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{pendingCount} Pending</span>}
                        </div>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedDates[dg.date] ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {expandedDates[dg.date] && (
                      <div className="p-6 space-y-6">
                        {dg.trucks.map(t => (
                          <div key={t.id} className="space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <button onClick={() => toggleTruck(dg.date, t.id)} className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider hover:text-orange-500 transition-colors">
                                <TruckIcon className="w-4 h-4"/> {t.id}
                                <ChevronDown className={`w-4 h-4 transition-transform ${expandedTrucks[`${dg.date}-${t.id}`] ? 'rotate-180' : ''}`} />
                              </button>
                              <div className="flex gap-5 items-baseline">
                                {t.summary.loomPallets > 0 && <span className="text-[12px] text-gray-500 font-medium"><span className="text-purple-700 font-black text-[14px]">{t.summary.loomPallets}</span> Lms</span>}
                                <span className="text-[12px] text-gray-500 font-medium"><span className="text-gray-800 font-black text-[14px]">{t.summary.normalPallets}</span> Plts</span>
                                <span className="text-[12px] text-gray-500 font-medium"><span className="text-gray-800 font-black text-[14px]">{Number(t.summary.boxes).toLocaleString()}</span> Bxs</span>
                                <span className="text-orange-600 font-black text-[15px]">{Number(parseFloat(t.summary.weight)).toLocaleString()} <span className="text-[11px] font-bold">LBS</span></span>
                              </div>
                            </div>
                            {expandedTrucks[`${dg.date}-${t.id}`] && (
                              <div className="flex flex-wrap gap-4">
                                {t.orders.map(o => renderOrderCard(o))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </section>

            {pastCompletedDates.length > 0 && (
              <section className="mt-12">
                <div className="flex items-center gap-3 mb-6 opacity-60">
                  <Archive className="w-6 h-6 text-slate-500"/>
                  <h2 className="text-xl font-black text-slate-700 tracking-tight">Past Orders (Completed)</h2>
                </div>
                <div className="space-y-8 opacity-75 hover:opacity-100 transition-opacity">
                  {pastCompletedDates.map(dg => (
                    <div key={dg.date} className="bg-slate-50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden grayscale hover:grayscale-0 transition-all">
                      <div className="flex items-center justify-between pr-4 hover:bg-slate-100/50 transition-colors">
                        <button onClick={() => toggleDate(dg.date, dg.trucks)} className="flex-1 flex items-center gap-4 p-5 text-left">
                          <div className="bg-emerald-100 p-2 rounded-xl"><CheckCircle2 className="w-5 h-5 text-emerald-600"/></div>
                          <span className="text-base font-bold text-slate-700">Completed on {dg.date}</span>
                          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedDates[dg.date] ? 'rotate-180' : ''}`} />
                        </button>
                        <button onClick={() => { const allOrders = dg.trucks.flatMap(t => t.orders); setConfirmDialog({isOpen:true, title:"Delete All Orders", message:`Delete all ${allOrders.length} order(s) from ${dg.date}? This cannot be undone.`, onConfirm: async () => { for(const o of allOrders) await executeDeleteOrder({orderId: o.id}); }}); }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg" title="Delete all orders for this date">
                          <Trash2 className="w-3.5 h-3.5"/> Delete Date
                        </button>
                      </div>
                      
                      {expandedDates[dg.date] && (
                        <div className="p-6 space-y-6">
                          {dg.trucks.map(t => (
                            <div key={t.id} className="space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <button onClick={() => toggleTruck(dg.date, t.id)} className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider hover:text-orange-500 transition-colors">
                                  <TruckIcon className="w-4 h-4"/> {t.id}
                                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedTrucks[`${dg.date}-${t.id}`] ? 'rotate-180' : ''}`} />
                                </button>
                                <div className="flex gap-5 items-baseline">
                                  {t.summary.loomPallets > 0 && <span className="text-[12px] text-gray-500 font-medium"><span className="text-purple-700 font-black text-[14px]">{t.summary.loomPallets}</span> Lms</span>}
                                  <span className="text-[12px] text-gray-500 font-medium"><span className="text-gray-800 font-black text-[14px]">{t.summary.normalPallets}</span> Plts</span>
                                  <span className="text-[12px] text-gray-500 font-medium"><span className="text-gray-800 font-black text-[14px]">{Number(t.summary.boxes).toLocaleString()}</span> Bxs</span>
                                  <span className="text-emerald-600 font-black text-[15px]">{Number(parseFloat(t.summary.weight)).toLocaleString()} <span className="text-[11px] font-bold">LBS</span></span>
                                </div>
                              </div>
                              {expandedTrucks[`${dg.date}-${t.id}`] && (
                                <div className="flex flex-wrap gap-4">
                                  {t.orders.map(o => renderOrderCard(o))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}

        {/* CREATE ORDER */}
        {activeTab === "Create Order" && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm animate-in fade-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-lg">
              <h2 className="text-2xl font-bold text-gray-800">Create New Order</h2>
              <button onClick={() => setActiveTab("Order Summary")} className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"><ArrowLeft className="w-4 h-4"/> Back to Dashboard</button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order ID <span className="text-red-500">*</span></label>
                  <input required value={newOrderForm.id} onChange={e => setNewOrderForm({...newOrderForm, id: e.target.value})} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2.5 text-sm focus:ring-orange-400 outline-none" placeholder="e.g., ORD12345" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PO Reference</label>
                  <input value={newOrderForm.po} onChange={e => setNewOrderForm({...newOrderForm, po: e.target.value})} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2.5 text-sm focus:ring-orange-400 outline-none" placeholder="e.g., PO67890"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ship Date <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type="date" required value={formatForInput(newOrderForm.shipmentDate)} onChange={e => setNewOrderForm({...newOrderForm, shipmentDate: formatFromInput(e.target.value)})} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2.5 text-sm focus:ring-orange-400 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Freight Terms</label>
                  <select value={newOrderForm.freight} onChange={e => setNewOrderForm({...newOrderForm, freight: e.target.value})} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2.5 text-sm outline-none appearance-none">
                    <option value="Select Freight Terms">Select Freight Terms</option>
                    <option value="Collect">Collect</option>
                    <option value="PPD and Charge">PPD and Charge</option>
                    <option value="CPT">CPT</option>
                    <option value="Prepaid">Prepaid</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Truck Assignment</label>
                  <select value={newOrderForm.truckId} onChange={e => setNewOrderForm({...newOrderForm, truckId: e.target.value})} className="w-full max-w-md bg-slate-100 border border-gray-200 rounded-md p-2.5 text-sm outline-none appearance-none">
                    <option value="N/A">N/A</option>
                    <option value="Truck 1">Truck 1</option>
                    <option value="Truck 2">Truck 2</option>
                    <option value="Truck 3">Truck 3</option>
                    <option value="Truck 4">Truck 4</option>
                    <option value="Truck 5">Truck 5</option>
                    <option value="Truck 6">Truck 6</option>
                    <option value="House Account">House Account</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea rows={3} value={newOrderForm.notes} onChange={e => setNewOrderForm({...newOrderForm, notes: e.target.value})} className="w-full bg-slate-100 border border-gray-200 rounded-md p-3 text-sm outline-none resize-none" placeholder="Optional notes for the order" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setActiveTab("Order Summary")} className="px-5 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-orange-500 text-white rounded-md text-sm font-bold hover:bg-orange-600 flex items-center gap-2"><Plus className="w-4 h-4"/> Create Order</button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW: TRUCK REPORT */}
        {activeTab === "Truck Report" && (
           <div className="bg-white rounded-lg border border-gray-200 shadow-sm animate-in fade-in p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Truck Report</h2>
              
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-md border border-gray-200 mb-8">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Report Date</label>
                    <input type="date" value={formatForInput(reportDate)} onChange={e => setReportDate(formatFromInput(e.target.value))} className="border border-gray-300 rounded p-2 text-sm outline-none" />
                 </div>
                 <button onClick={() => triggerPrint('truck_report')} className="mt-4 px-4 py-2 bg-orange-500 text-white font-bold text-sm rounded shadow-sm flex items-center gap-2 hover:bg-orange-600"><Printer className="w-4 h-4"/> Print Report</button>
              </div>

              {reportDateData ? (
                 <div className="space-y-6">
                    {truckReportSummary.trucks.map(t => (
                       <div key={t.id} className="border border-gray-200 rounded-md overflow-hidden">
                          <h3 className="bg-gray-100 text-gray-800 font-bold p-3 border-b flex items-center gap-2"><TruckIcon className="w-5 h-5"/> Truck: {t.id}</h3>
                          <table className="w-full text-sm text-left">
                             <thead className="bg-gray-50 text-gray-500 text-xs border-b">
                                <tr><th className="p-3">Order #</th><th className="p-3">PO #</th><th className="p-3">Freight</th><th className="p-3 text-center">Loom Plts</th><th className="p-3 text-center">Normal Plts</th><th className="p-3 text-center">Total Boxes</th><th className="p-3 text-right">Weight (lbs)</th></tr>
                             </thead>
                             <tbody>
                                {t.ordersData.map(o => (
                                   <tr key={o.id} className="border-b border-gray-100">
                                      <td className="p-3">{o.id}</td><td className="p-3">{o.po}</td><td className="p-3">{o.freight}</td>
                                      <td className="p-3 text-center font-bold text-gray-800">{o.loomPlts}</td><td className="p-3 text-center">{o.normalPlts}</td>
                                      <td className="p-3 text-center">{Number(o.finalBoxes||0).toLocaleString()}</td><td className="p-3 text-right">{Number(o.finalWeight||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                                   </tr>
                                ))}
                                <tr className="bg-gray-50 font-bold text-gray-800">
                                   <td colSpan={3} className="p-3 text-right">Totals for {t.id}:</td>
                                   <td className="p-3 text-center font-bold">{t.tLoom}</td><td className="p-3 text-center">{t.tNormal}</td>
                                   <td className="p-3 text-center">{Number(t.tBoxes||0).toLocaleString()}</td><td className="p-3 text-right">{Number(t.tWeight||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                                </tr>
                             </tbody>
                          </table>
                       </div>
                    ))}

                    <div className="border border-gray-300 rounded-md mt-10 overflow-hidden">
                       <div className="bg-gray-100 px-4 py-3 border-b border-gray-300">
                          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2"><Calendar className="w-4 h-4"/> Grand Totals — {formatDateLong(reportDate)}</h3>
                       </div>
                       <table className="w-full text-sm">
                          <thead>
                             <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Trucks</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Loom Pallets</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Normal Pallets</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Total Boxes</th>
                                <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Total Weight</th>
                             </tr>
                          </thead>
                          <tbody>
                             <tr>
                                <td className="px-4 py-4 text-2xl font-black text-gray-900">{truckReportSummary.grandTrucks}</td>
                                <td className="px-4 py-4 text-2xl font-black text-gray-900">{truckReportSummary.grandLoomPlts}</td>
                                <td className="px-4 py-4 text-2xl font-black text-gray-900">{truckReportSummary.grandNormalPlts}</td>
                                <td className="px-4 py-4 text-2xl font-black text-gray-900">{truckReportSummary.grandBoxes.toLocaleString()}</td>
                                <td className="px-4 py-4 text-2xl font-black text-gray-900 text-right">{truckReportSummary.grandWeight.toLocaleString()} lbs</td>
                             </tr>
                          </tbody>
                       </table>
                    </div>
                 </div>
              ) : (
                 <div className="text-center py-20 text-gray-500">No scheduling data for the selected date.</div>
              )}
           </div>
        )}

        {/* VIEW: FORMATS */}
        {activeTab === "Formats" && (
          <div className="animate-in fade-in duration-500">
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Formats</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* Warehouse Consolidation */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4">
                    <Package className="w-6 h-6"/>
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900">Warehouse Consolidation</h3>
                    <button
                      onClick={() => setPrintMode('consolidation_form')}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
                    >
                      <Printer className="w-4 h-4"/> Print Sheet
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Label Maker */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4">
                    <Tag className="w-6 h-6"/>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-4">Quick Label Maker</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Label Text</label>
                      <textarea
                        value={labelContent}
                        onChange={e => setLabelContent(e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-none"
                        placeholder="e.g. SKU-999 or 1"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Label Size</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setLabelSize('4x2')}
                          className={`flex-1 py-2 text-sm font-bold rounded-md border transition-colors ${labelSize === '4x2' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                        >
                          4 × 2 in
                        </button>
                        <button
                          onClick={() => setLabelSize('4x4')}
                          className={`flex-1 py-2 text-sm font-bold rounded-md border transition-colors ${labelSize === '4x4' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                        >
                          4 × 4 in
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-4 mt-4">
                    <button
                      onClick={() => setPrintMode(labelSize === '4x2' ? 'label_4x2' : 'label_4x4')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
                    >
                      <Printer className="w-4 h-4"/> Print Label
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW: ORDER DETAILS */}
        {activeTab === "Order Details" && editingOrder && (
          <div className="animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditingOrder(null); setPendingRemoteUpdate(null); setActiveTab("Order Summary"); }} className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm w-fit"><ArrowLeft className="w-4 h-4"/> Back</button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:justify-end">
                <button onClick={() => setDetailsTab('general')} className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold border flex items-center gap-1.5 whitespace-nowrap ${detailsTab==='general' ? 'bg-slate-100 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}><Info className="w-4 h-4 shrink-0"/> <span className="hidden xs:inline">Order </span>Details</button>
                <button onClick={() => setDetailsTab('packing_list')} className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold border flex items-center gap-1.5 whitespace-nowrap ${detailsTab==='packing_list' ? 'bg-slate-100 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}><FileText className="w-4 h-4 shrink-0"/> Distribution</button>
                <button onClick={() => setDetailsTab('weight_sheet')} className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold border flex items-center gap-1.5 whitespace-nowrap ${detailsTab==='weight_sheet' ? 'bg-slate-100 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}><Package className="w-4 h-4 shrink-0"/> Weight</button>
                <button onClick={() => setDetailsTab('items')} className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold border flex items-center gap-1.5 whitespace-nowrap ${detailsTab==='items' ? 'bg-slate-100 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}><List className="w-4 h-4 shrink-0"/> Items</button>
                <button onClick={() => setDetailsTab('order_check')} className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold border flex items-center gap-1.5 whitespace-nowrap ${detailsTab==='order_check' ? 'bg-slate-100 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}><CheckSquare className="w-4 h-4 shrink-0"/> Check</button>
              </div>
            </div>

            {/* Botón de fusión manual — solo aparece cuando otro usuario editó esta misma orden */}


            {detailsTab === 'general' && (
              <>
                <div className="bg-white border border-gray-200 shadow-sm mb-6 rounded-md">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-orange-500">Order Details</h2>
                    <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded border border-green-100 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Auto-Save Active (Supabase)</span>
                  </div>
                  <div className="p-6">
                    {editingOrder.isManualOverride && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-700 rounded-lg px-3 py-2 mb-4 text-sm font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        Manual Override — Estimated Values
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-5">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Order Number</label>
                        {/* ID es la llave primaria — solo lectura para evitar crear duplicados en Supabase */}
                        <input value={editingOrder.id} readOnly className="w-full bg-slate-100 border border-gray-200 rounded-md p-2.5 text-sm font-bold text-slate-600 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">PO (Purchase Order)</label>
                        <input value={editingOrder.po} onChange={e => handleInputChange('po', e.target.value)} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2.5 text-sm outline-none focus:border-orange-400 font-bold" />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 mb-5 border-b border-gray-100 pb-5">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <span className="text-gray-800">Total Pallets:</span>
                        <span className="bg-gray-200 px-3 py-1 rounded-md text-gray-800 text-base">{totals.pallets} <span className="text-xs text-gray-500 font-medium">({totals.normalPallets} Plts, {totals.loomPallets} Looms)</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <span className="text-gray-800">Total Boxes:</span>
                        <span className="bg-gray-200 px-3 py-1 rounded-md text-gray-800 text-base">{Number(totals.boxes||0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <span className="text-gray-800">Total Weight:</span>
                        <span className="bg-gray-200 px-3 py-1 rounded-md text-gray-800 text-base">{Number(totals.weight||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} lbs</span>
                      </div>
                    </div>

                    <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Shipment Date</label>
                        <div className="relative">
                          <input type="date" value={formatForInput(editingOrder.shipmentDate || "")} onChange={e => handleInputChange('shipmentDate', formatFromInput(e.target.value))} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2 text-sm outline-none focus:border-orange-400" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Freight Terms</label>
                        <select value={editingOrder.freight} onChange={e => handleInputChange('freight', e.target.value)} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2 text-sm outline-none appearance-none">
                          <option value="Collect">Collect</option>
                          <option value="PPD and Charge">PPD and Charge</option>
                          <option value="CPT">CPT</option>
                          <option value="Prepaid">Prepaid</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Truck Assignment / Shipping Method</label>
                        <select value={editingOrder.truckId} onChange={e => handleInputChange('truckId', e.target.value)} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2 text-sm outline-none appearance-none font-bold text-orange-500">
                          <option value="Unassigned">Unassigned</option>
                          <option value="Truck 1">Truck 1</option>
                          <option value="Truck 2">Truck 2</option>
                          <option value="Truck 3">Truck 3</option>
                          <option value="Truck 4">Truck 4</option>
                          <option value="Truck 5">Truck 5</option>
                          <option value="Truck 6">Truck 6</option>
                          <option value="House Account">House Account</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1 italic">Change this to move the order to a different section on the Dashboard.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Order Status</label>
                        <select value={editingOrder.status} onChange={e => handleInputChange('status', e.target.value)} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2 text-sm outline-none appearance-none">
                          <option value="Completed">Completed</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Delayed">Delayed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Loose Boxes Shipped</label>
                        <input type="number" value={editingOrder.looseBoxes || 0} onChange={e => handleInputChange('looseBoxes', Number(e.target.value))} className="w-full bg-slate-100 border border-gray-200 rounded-md p-2 text-sm outline-none focus:border-orange-400" />
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                      <textarea rows={3} value={editingOrder.notes || ""} onChange={e => handleInputChange('notes', e.target.value)} className="w-full bg-slate-100 border border-gray-200 rounded-md p-3 text-sm outline-none focus:border-orange-400 resize-none" />
                    </div>

                    {/* Backorder summary */}
                    {checkOrderIncomplete(editingOrder) && (
                      <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Backorders</label>
                        <div className="flex flex-wrap gap-2">
                          {getBackorders(editingOrder).map((bo, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 text-sm bg-red-50 border border-red-200 text-red-700 font-bold px-3 py-1.5 rounded-lg">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0"/>
                              Line {bo.lineNo}: missing {bo.missingQty > 0 ? bo.missingQty.toLocaleString() + ' pcs' : bo.missingBoxes.toLocaleString() + ' boxes/plts'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {!checkOrderIncomplete(editingOrder) && editingOrder.masterItems && editingOrder.masterItems.length > 0 && (
                      <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Backorders</label>
                        <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> All lines complete — no backorders.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-end mb-4 px-1">
                    <h3 className="text-2xl font-bold text-gray-800">Pallets</h3>
                    <div className="flex gap-2">
                      <button onClick={() => triggerPrint('pallet_sheets_all')} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"><Printer className="w-4 h-4"/> Print All Sheets</button>
                      <button onClick={() => triggerPrint('labels_all')} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"><Printer className="w-4 h-4"/> Print All Labels</button>
                      <button onClick={() => setIsBulkModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 shadow-sm"><Database className="w-4 h-4"/> Add Bulk</button>
                      {/* Renumber pallets */}
                      {showRenumberForm ? (
                        <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded px-2 py-1 shadow-sm">
                          <span className="text-xs text-gray-600 font-medium">Start from #</span>
                          <input
                            type="number"
                            min="1"
                            value={renumberStartFrom}
                            onChange={e => setRenumberStartFrom(parseInt(e.target.value) || 1)}
                            className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-sm outline-none focus:border-orange-400"
                            autoFocus
                          />
                          <button onClick={handleRenumberPallets} className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-bold hover:bg-orange-600">OK</button>
                          <button onClick={() => setShowRenumberForm(false)} className="px-2 py-0.5 border border-gray-300 rounded text-xs text-gray-500 hover:bg-gray-50">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setShowRenumberForm(true); setRenumberStartFrom(1); }} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm">
                          <ArrowRightLeft className="w-4 h-4"/> Renumber
                        </button>
                      )}
                      <button onClick={handleAddPallet} className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 text-white rounded text-sm font-bold hover:bg-orange-600 shadow-sm"><Plus className="w-4 h-4"/> Add Pallet</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {editingOrder.palletList?.map(pallet => {
                      const isLoom = isLoomPallet(pallet);
                      return (
                      <div key={pallet.id} className={`bg-white border ${isLoom ? 'border-purple-300' : 'border-gray-300'} rounded-md shadow-sm`}>
                        <div className={`p-4 flex justify-between items-center transition-colors ${isLoom ? 'bg-purple-50 hover:bg-purple-100' : 'bg-white hover:bg-gray-50'}`}>
                          <div className="flex items-center gap-6">
                            <span className={`font-bold text-[15px] ${isLoom ? 'text-purple-700' : 'text-orange-500'}`}>Pallet {pallet.number} {isLoom && <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded ml-2">LOOM</span>}</span>
                            <div className="flex gap-4 text-sm text-gray-600">
                              <span>Boxes: <span className="font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">{pallet.boxes}</span></span>
                              <span>Weight: <span className="font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">{pallet.weight} lbs</span></span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-gray-500">
                            <button onClick={() => setExpandedPallets(p => ({...p, [pallet.id]: !p[pallet.id]}))}><ChevronDown className={`w-4 h-4 transition-transform ${expandedPallets[pallet.id] ? 'rotate-180 text-orange-500' : ''}`}/></button>
                            
                            <button onClick={() => printPalletSheet(pallet)} title="Print Pallet Sheet"><FileText className="w-4 h-4 hover:text-gray-800"/></button>
                            <button onClick={() => printLabel(pallet)} title="Print Label"><Tag className="w-4 h-4 hover:text-gray-800"/></button>

                            <div className="relative">
                              <button onClick={() => setMovingPalletId(movingPalletId === pallet.id ? null : pallet.id)} title="Change Order"><ArrowRightLeft className="w-4 h-4 hover:text-gray-800"/></button>
                              {movingPalletId === pallet.id && (
                                <div className="absolute right-0 mt-2 bg-white border shadow-xl rounded p-2 z-10 w-48 flex gap-2">
                                  <input type="number" min="1" max={editingOrder.palletList?.length} value={targetPosition} onChange={e => setTargetPosition(parseInt(e.target.value))} className="w-full border rounded p-1 text-sm"/>
                                  <button onClick={executeMovePallet} className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold">Move</button>
                                </div>
                              )}
                            </div>

                            <div className="relative">
                              <button
                                onClick={() => { setMergingPalletId(mergingPalletId === pallet.id ? null : pallet.id); setMergeTargetId(''); }}
                                title="Merge items into another pallet"
                              >
                                <Copy className="w-4 h-4 hover:text-gray-800"/>
                              </button>
                              {mergingPalletId === pallet.id && (
                                <div className="absolute right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded p-2.5 z-20 w-64 flex flex-col gap-2">
                                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Merge all items into:</p>
                                  <select
                                    value={mergeTargetId}
                                    onChange={e => setMergeTargetId(e.target.value)}
                                    className="w-full border border-gray-300 rounded p-1.5 text-sm outline-none focus:border-orange-400"
                                  >
                                    <option value="">Select pallet...</option>
                                    {editingOrder.palletList?.filter(p => p.id !== pallet.id).map(p => (
                                      <option key={p.id} value={p.id}>Pallet {p.number} ({p.boxes} boxes)</option>
                                    ))}
                                  </select>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={handleMergePallets}
                                      disabled={!mergeTargetId}
                                      className="flex-1 bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold hover:bg-orange-600 disabled:opacity-40"
                                    >Merge</button>
                                    <button onClick={() => setMergingPalletId(null)} className="px-2 py-1 border border-gray-300 rounded text-xs text-gray-500 hover:bg-gray-50">Cancel</button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <button onClick={() => setEditingPalletId(pallet.id)}><Pencil className="w-4 h-4 hover:text-gray-800"/></button>
                            <button onClick={() => setConfirmDialog({isOpen:true, title:"Delete Pallet", message:"Are you sure you want to delete this pallet?", onConfirm: () => executeDeletePallet(pallet.id)})} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </div>

                        {/* Expanded Table */}
                        {expandedPallets[pallet.id] && (
                          <div className="p-4 border-t border-gray-300 bg-white">
                            <table className="w-full text-[13px] text-left border border-gray-200">
                              <thead className="bg-white border-b border-gray-200 text-gray-500 font-medium">
                                <tr>
                                  <th className="px-4 py-3 font-medium">Line</th>
                                  <th className="px-4 py-3 font-medium">Item #</th>
                                  <th className="px-4 py-3 font-medium text-center">Boxes</th>
                                  <th className="px-4 py-3 font-medium text-center">Qty/Box</th>
                                  <th className="px-4 py-3 font-medium text-right">Total Pcs</th>
                                  <th className="px-4 py-3 font-medium text-right">Added By</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {pallet.items.map((item, _idx) => (
                                  <tr key={item.id} className="bg-white">
                                    <td className="px-4 py-3 text-gray-700 font-bold">{item.lineNo}</td>
                                    <td className="px-4 py-3 text-gray-700">{item.itemNumber}</td>
                                    <td className="px-4 py-3 text-center text-gray-700">{item.boxes}</td>
                                    <td className="px-4 py-3 text-center text-gray-700">{(Number(item.qtyPerBox)||0).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-gray-700 font-bold">{((Number(item.boxes)||0) * (Number(item.qtyPerBox)||0)).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-gray-500 text-[11px] uppercase tracking-wider">{item.addedBy || 'N/A'}</td>
                                  </tr>
                                ))}
                                {pallet.items.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">No items on this pallet</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                </div>
              </>
            )}

            {/* TAB: PACKING LIST */}
            {detailsTab === 'packing_list' && (
               <div className="bg-white border border-gray-200 rounded-md p-10 shadow-sm animate-in fade-in">
                  <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                     <div>
                       <h2 className="text-2xl font-bold text-orange-500 mb-2">Distribution List</h2>
                       <p className="text-sm text-gray-600">Order: {editingOrder.id} | PO: {editingOrder.po} | Total Boxes: {totals.boxes}</p>
                     </div>
                     <button onClick={() => triggerPrint('packing_list')} className="px-4 py-2 bg-orange-500 text-white rounded-md font-bold flex gap-2"><Printer className="w-4 h-4"/> Print Distribution List</button>
                  </div>
                  <table className="w-full text-sm text-left border border-gray-200">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr><th className="p-3 border-b border-gray-300">Line</th><th className="p-3 border-b border-gray-300">Pallet ID</th><th className="p-3 border-b border-gray-300">Item #</th><th className="p-3 border-b border-gray-300 text-center">Boxes/Plts</th><th className="p-3 border-b border-gray-300 text-center">Qty/Box</th><th className="p-3 border-b border-gray-300 text-right">Total Pcs</th></tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const allFlat = editingOrder?.palletList?.flatMap(p => (p.items || []).map(i => ({...i, palletId: p.number}))) || [];
                        const grouped = allFlat.reduce((acc, item) => {
                          if(!acc[item.lineNo]) acc[item.lineNo] = [];
                          acc[item.lineNo].push(item);
                          return acc;
                        }, {} as Record<string, typeof allFlat>);
                        const sortedLines = Object.keys(grouped).sort((a,b) => parseInt(a)-parseInt(b));
                        
                        return sortedLines.map(line => {
                          const items = grouped[line];
                          let subBoxes = 0;
                          let subPcs = 0;
                          
                          return (
                            <React.Fragment key={line}>
                              {items.map((it, idx) => {
                                const isLoom = it.boxes === 0 && LOOM_SIZES.includes(String(it.qtyPerBox));
                                const bxs = isLoom ? 1 : (Number(it.boxes)||0);
                                const pcs = isLoom ? Number(it.qtyPerBox) : bxs * (Number(it.qtyPerBox)||0);
                                subBoxes += bxs;
                                subPcs += pcs;

                                return (
                                <tr key={`${line}-${it.id}-${idx}`} className="border-b border-gray-100">
                                  <td className="p-3">{it.lineNo}</td>
                                  <td className="p-3">Pallet {it.palletId}</td>
                                  <td className="p-3">{it.itemNumber}</td>
                                  <td className="p-3 text-center">{Number(bxs||0).toLocaleString()}</td>
                                  <td className="p-3 text-center">{(Number(it.qtyPerBox)||0).toLocaleString()}</td>
                                  <td className="p-3 text-right">{pcs.toLocaleString()}</td>
                                </tr>
                                )
                              })}
                              <tr className="bg-gray-50 border-b-2 border-gray-300 font-bold text-gray-800">
                                <td colSpan={3} className="p-3 text-right">Subtotal Line {line}:</td>
                                <td className="p-3 text-center">{subBoxes.toLocaleString()}</td>
                                <td className="p-3 text-center">-</td>
                                <td className="p-3 text-right">{subPcs.toLocaleString()}</td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                      })()}
                    </tbody>
                  </table>
               </div>
            )}

            {/* TAB: WEIGHT SHEET */}
            {detailsTab === 'weight_sheet' && (
               <div className="bg-white border border-gray-200 rounded-md p-10 shadow-sm animate-in fade-in">
                  <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                     <div>
                       <h2 className="text-2xl font-bold text-orange-500 mb-2">Weight Sheet</h2>
                       <div className="text-sm text-gray-600 font-medium space-y-0.5">
                         <p>Order #: {editingOrder.id}</p>
                         <p>PO: {editingOrder.po}</p>
                         <p>Ship Date: {editingOrder.shipmentDate}</p>
                         <p>Total Boxes: <b>{Number(totals.boxes||0).toLocaleString()}</b></p>
                         <p>Total Pallets: <b>{(editingOrder?.palletList?.length || 0) + partnerPalletList.length}</b>
                           {partnerPalletList.length > 0 && <span className="text-gray-400 text-xs ml-1">(my {editingOrder?.palletList?.length || 0} + partner {partnerPalletList.length})</span>}
                         </p>
                         {Number(totals.weight||0) > 0 && (
                           <p>Total Weight: <b>{Number(totals.weight||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} lbs</b></p>
                         )}
                       </div>
                     </div>
                     <button onClick={() => triggerPrint('weight_sheet')} className="px-4 py-2 border border-gray-300 bg-gray-50 text-gray-800 rounded font-bold flex gap-2 hover:bg-gray-100"><Printer className="w-4 h-4"/> Print Sheet</button>
                  </div>
                  <table className="w-full text-sm text-left border border-gray-200">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr><th className="p-4 border-b border-gray-300">Pallet ID</th><th className="p-4 border-b border-gray-300 text-center">Total Boxes in Pallet</th><th className="p-4 border-b border-gray-300 text-right">Weight (lbs)</th></tr>
                    </thead>
                    <tbody>
                      {editingOrder.palletList?.map((p, idx) => {
                        const displayWeight = p.weight && p.weight !== "0.00" && p.weight !== "0" ? p.weight : "";
                        return (
                          <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="p-3 py-4 text-gray-800 font-medium">Pallet {p.number} {isLoomPallet(p) ? '(Loom)' : ''}</td>
                            <td className="p-3 py-4 text-center text-gray-800">{Number(p.boxes||0).toLocaleString()}</td>
                            <td className="p-3 py-4 text-right">
                               <input
                                 data-weight-idx={idx}
                                 value={displayWeight}
                                 onChange={e => setEditingOrder({...editingOrder, palletList: editingOrder.palletList?.map(px => px.id === p.id ? {...px, weight: e.target.value} : px)})}
                                 onKeyDown={e => {
                                   if (e.key === 'Enter') {
                                     e.preventDefault();
                                     const next = document.querySelector<HTMLInputElement>(`[data-weight-idx="${idx + 1}"]`);
                                     if (next) next.focus();
                                   }
                                 }}
                                 onBlur={async e => {
                                   if (!IS_PLACEHOLDER_CREDENTIALS && supabase) {
                                     await supabase.from('pallets').update({ weight: e.target.value || '0.00' }).eq('id', p.id);
                                   }
                                 }}
                                 className="w-24 border border-gray-300 rounded p-1.5 text-right bg-gray-50 outline-none focus:bg-white focus:border-orange-400 shadow-sm"
                                 placeholder="Enter Weight"
                               />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                        <td className="p-3 py-4 text-gray-800">TOTAL</td>
                        <td className="p-3 py-4 text-center text-gray-800">{Number(totals.boxes||0).toLocaleString()}</td>
                        <td className="p-3 py-4 text-right text-orange-600 text-base pr-5">
                          {Number(totals.weight||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} lbs
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Partner section */}
                  <div className="mt-6 border-t border-gray-200 pt-5">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Partner Pallets (Optional — For Combined Totals)</p>
                    {/* Add pallet form */}
                    <div className="flex flex-wrap gap-2 items-end mb-3">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Pallet #</label>
                        <input
                          type="text"
                          value={partnerPalletForm.number}
                          onChange={e => setPartnerPalletForm(f => ({...f, number: e.target.value}))}
                          placeholder="e.g. 1"
                          className="w-20 border border-gray-300 rounded p-1.5 text-sm outline-none focus:border-orange-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Boxes</label>
                        <input
                          type="number"
                          min="0"
                          value={partnerPalletForm.boxes}
                          onChange={e => setPartnerPalletForm(f => ({...f, boxes: e.target.value}))}
                          placeholder="0"
                          className="w-20 border border-gray-300 rounded p-1.5 text-sm outline-none focus:border-orange-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Weight (lbs)</label>
                        <input
                          type="text"
                          value={partnerPalletForm.weight}
                          onChange={e => setPartnerPalletForm(f => ({...f, weight: e.target.value}))}
                          placeholder="0.00"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (!partnerPalletForm.number.trim()) return;
                              setPartnerPalletList(prev => [...prev, { id: Date.now().toString(), ...partnerPalletForm }]);
                              setPartnerPalletForm({ number: '', boxes: '', weight: '' });
                            }
                          }}
                          className="w-28 border border-gray-300 rounded p-1.5 text-sm outline-none focus:border-orange-400"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (!partnerPalletForm.number.trim()) return;
                          setPartnerPalletList(prev => [...prev, { id: Date.now().toString(), ...partnerPalletForm }]);
                          setPartnerPalletForm({ number: '', boxes: '', weight: '' });
                        }}
                        className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded font-bold hover:bg-orange-600"
                      >Add Pallet</button>
                      {partnerPalletList.length > 0 && (
                        <button onClick={() => setPartnerPalletList([])} className="text-xs text-gray-400 hover:text-red-500 ml-1">Clear All</button>
                      )}
                    </div>

                    {/* Partner pallet table */}
                    {partnerPalletList.length > 0 && (() => {
                      const partnerBoxes = partnerPalletList.reduce((s, p) => s + (Number(p.boxes)||0), 0);
                      const partnerW = partnerPalletList.reduce((s, p) => s + (parseFloat((p.weight||'').replace(/,/g,'')) || 0), 0);
                      return (
                        <>
                          <table className="w-full text-sm text-left border border-gray-200 mb-3">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                              <tr>
                                <th className="p-2 border-b border-gray-200">Pallet #</th>
                                <th className="p-2 border-b border-gray-200 text-center">Boxes</th>
                                <th className="p-2 border-b border-gray-200 text-right">Weight (lbs)</th>
                                <th className="p-2 border-b border-gray-200 w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {partnerPalletList.map(pp => (
                                <tr key={pp.id} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="p-2 font-medium">Pallet {pp.number}</td>
                                  <td className="p-2 text-center">{Number(pp.boxes||0).toLocaleString()}</td>
                                  <td className="p-2 text-right">{pp.weight || '—'}</td>
                                  <td className="p-2 text-center">
                                    <button onClick={() => setPartnerPalletList(prev => prev.filter(x => x.id !== pp.id))} className="text-gray-300 hover:text-red-400">
                                      <X className="w-3 h-3"/>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-sm">
                                <td className="p-2">Partner Total</td>
                                <td className="p-2 text-center">{partnerBoxes.toLocaleString()}</td>
                                <td className="p-2 text-right">{partnerW > 0 ? partnerW.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' lbs' : '—'}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                          <div className="text-sm font-bold text-gray-800 bg-orange-50 border border-orange-200 rounded p-3 flex gap-6">
                            <span>Combined Pallets: <b className="text-orange-600">{(editingOrder?.palletList?.length || 0) + partnerPalletList.length}</b></span>
                            <span>Combined Boxes: <b className="text-orange-600">{(Number(totals.boxes||0) + partnerBoxes).toLocaleString()}</b></span>
                            <span>Combined Weight: <b className="text-orange-600">{(Number(totals.weight||0) + partnerW) > 0 ? (Number(totals.weight||0) + partnerW).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' lbs' : '—'}</b></span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
               </div>
            )}

            {/* TAB: ITEMS */}
            {detailsTab === 'items' && (
               <div className="bg-white border border-gray-200 rounded-md p-8 shadow-sm animate-in fade-in max-w-3xl">
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Item Verification (Order {editingOrder.id})</h2>
                    {(() => {
                      const count = (editingOrder.masterItems || []).filter(m => itemNotes.find(n => n.itemNumber === m.itemNumber)).length;
                      return count > 0 ? (
                        <span className="text-[11px] font-black bg-amber-100 text-amber-700 border border-amber-300 px-2.5 py-1 rounded-full">
                          ⚠ {count} item{count > 1 ? 's' : ''} need{count === 1 ? 's' : ''} attention
                        </span>
                      ) : null;
                    })()}
                  </div>
                  {(() => {
                    const currentLines = editingOrder.masterItems || [];
                    const nextLineNo = currentLines.length > 0 ? Math.max(...currentLines.map(m => parseInt(m.lineNo) || 0)) + 1 : 1;
                    return (
                      <div className="mb-8">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-gray-500 font-medium">{editingMasterItemId ? 'Editing:' : 'Adding:'}</span>
                          <span className="bg-orange-500 text-white text-sm font-bold px-3 py-0.5 rounded-full">
                            Line {newItemLineNoForm.trim() ? newItemLineNoForm.trim() : (editingMasterItemId ? (editingOrder.masterItems?.find(m=>m.id===editingMasterItemId)?.lineNo ?? nextLineNo) : nextLineNo)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-3 bg-gray-50 p-4 rounded border border-gray-200">
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Item Number</label>
                              <input
                                id="item-number-input"
                                value={newItemNumberForm}
                                onChange={e => setNewItemNumberForm(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); (document.getElementById('item-target-qty') as HTMLInputElement)?.focus(); } }}
                                placeholder="e.g. SKU-12345"
                                className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400"
                                autoFocus
                              />
                            </div>
                            <div className="w-20">
                              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Line #</label>
                              <input
                                id="item-line-no-input"
                                type="number"
                                min="1"
                                value={newItemLineNoForm}
                                onChange={e => setNewItemLineNoForm(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); (document.getElementById('item-target-qty') as HTMLInputElement)?.focus(); } }}
                                placeholder={String(nextLineNo)}
                                className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400"
                              />
                            </div>
                            <div className="w-36">
                              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Target Qty (pcs)</label>
                              <input
                                id="item-target-qty"
                                type="number"
                                min="0"
                                value={newItemTargetQtyForm || ""}
                                onChange={e => setNewItemTargetQtyForm(Number(e.target.value))}
                                onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddMasterItem(); } }}
                                placeholder="0"
                                className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400"
                              />
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="w-36">
                              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Lot (optional)</label>
                              <input
                                value={newItemLotForm}
                                onChange={e => setNewItemLotForm(e.target.value)}
                                placeholder="LOT-001"
                                className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Item Note (optional)</label>
                              <input
                                value={newItemNoteForm}
                                onChange={e => setNewItemNoteForm(e.target.value)}
                                placeholder="e.g. Different design lot, do not pick"
                                className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleAddMasterItem} className="flex-1 bg-white border border-gray-300 px-4 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50"><Plus className="w-4 h-4"/> {editingMasterItemId ? 'Update Item' : 'Add to List'}</button>
                            {editingMasterItemId && <button onClick={() => { setEditingMasterItemId(null); setNewItemNumberForm(""); setNewItemTargetQtyForm(0); setNewItemLineNoForm(""); setNewItemNoteForm(""); setNewItemLotForm(""); }} className="px-3 py-2 rounded text-sm border border-gray-300 text-gray-500 hover:bg-gray-50">Cancel</button>}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <h3 className="text-sm font-bold text-gray-500 mb-2">Defined Lines:</h3>
                  <table className="w-full text-sm text-left border border-gray-200">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="p-3 border-b border-gray-300 w-20">LINE</th>
                        <th className="p-3 border-b border-gray-300">ITEM NUMBER</th>
                        <th className="p-3 border-b border-gray-300 w-32 text-center">TARGET QTY (pcs)</th>
                        <th className="p-3 border-b border-gray-300 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingOrder.masterItems?.map(m => (
                        <tr key={m.id} className="border-b border-gray-200 bg-white">
                          <td className="p-3 font-bold text-gray-700">{m.lineNo}</td>
                          <td className="p-3 border-b border-gray-200">
                            <div className="flex flex-col gap-0.5">
                              <span>{m.itemNumber}</span>
                              {(() => {
                                const note = itemNotes.find(n => n.itemNumber === m.itemNumber);
                                return note ? (
                                  <span className="text-[11px] text-amber-600 font-bold">⚠ {note.lot ? `[${note.lot}] ` : ''}{note.note}</span>
                                ) : null;
                              })()}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <input type="number" min="0" value={m.orderedQty || ""} onChange={e => handleUpdateMasterItem(m.id, 'orderedQty', Number(e.target.value))} className="w-24 border border-gray-300 rounded p-1.5 text-sm outline-none text-center focus:border-orange-400" placeholder="0"/>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => { setEditingMasterItemId(m.id); setNewItemNumberForm(m.itemNumber); setNewItemTargetQtyForm(m.orderedQty || 0); setNewItemLineNoForm(m.lineNo || ""); setNewItemNoteForm(""); setNewItemLotForm(""); setTimeout(()=>(document.getElementById('item-number-input') as HTMLInputElement)?.focus(),50); }} className="text-orange-400 hover:text-orange-600"><Pencil className="w-4 h-4"/></button>
                              <button onClick={() => handleDeleteMasterItem(m.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!editingOrder.masterItems || editingOrder.masterItems.length === 0) && <tr><td colSpan={3} className="p-4 text-center text-gray-400">No items defined yet.</td></tr>}
                    </tbody>
                  </table>
               </div>
            )}

            {/* TAB: ORDER CHECK */}
            {detailsTab === 'order_check' && (
               <div className="bg-white border border-gray-200 rounded-md p-8 shadow-sm animate-in fade-in">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-orange-500">Order Review & Validation</h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-6 flex items-center gap-2 bg-orange-50 p-3 rounded text-violet-800 border border-orange-100"><Info className="w-4 h-4"/>Target quantities come from the <b>Items</b> tab. This view compares what was packed vs. what was required in real time.</p>
                  
                  <table className="w-full text-sm text-left border border-gray-200">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="p-3 border-b border-gray-300 w-8"></th>
                        <th className="p-3 border-b border-gray-300" rowSpan={2}>Line</th>
                        <th className="p-3 border-b border-gray-300" rowSpan={2}>Item Number</th>
                        <th className="p-3 border-b border-gray-300 text-center" colSpan={2}>Required (Paper)</th>
                        <th className="p-3 border-b border-gray-300 text-center" colSpan={2}>Packed (System)</th>
                        <th className="p-3 border-b border-gray-300" rowSpan={2}>Status</th>
                      </tr>
                      <tr>
                        <th className="border-b border-gray-300"></th>
                        <th className="p-2 border-b border-gray-300 text-center bg-gray-50">Boxes / Plts</th>
                        <th className="p-2 border-b border-gray-300 text-center bg-gray-50">Total Pcs</th>
                        <th className="p-2 border-b border-gray-300 text-center bg-gray-50">Boxes / Plts</th>
                        <th className="p-2 border-b border-gray-300 text-center bg-gray-50">Total Pcs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingOrder.masterItems?.map((m, mIndex) => {
                        const packedQty = getPackedQtyForLine(m.lineNo, editingOrder);
                        const packedBoxes = getPackedBoxesForLine(m.lineNo, editingOrder);
                        const mQty = Number(m.orderedQty) || 0;
                        const mBoxes = Number(m.orderedBoxes) || 0;
                        const diffQty = packedQty - mQty;
                        const diffBoxes = packedBoxes - mBoxes;
                        const boxesOk = mBoxes === 0 || diffBoxes === 0;
                        const isMatch   = mQty > 0 && diffQty === 0 && boxesOk;
                        const isMissing = mQty > 0 && (diffQty < 0 || (mBoxes > 0 && diffBoxes < 0));
                        const palletsWithLine = (editingOrder.palletList || []).filter(p => p.items.some(i => i.lineNo === m.lineNo));
                        const isExpanded = expandedCheckLines[m.id];
                        return (
                          <React.Fragment key={m.id}>
                            <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              <td className="p-3 text-center">
                                <button onClick={() => setExpandedCheckLines(prev => ({...prev, [m.id]: !prev[m.id]}))}
                                  className="text-gray-400 hover:text-gray-700 transition-colors" title="Ver pallets">
                                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}/>
                                </button>
                              </td>
                              <td className="p-3 font-bold">{m.lineNo}</td>
                              <td className="p-3 font-mono">{m.itemNumber}</td>
                              <td className="p-3 text-center">
                                <input type="number" min="0" id={`check-box-${mIndex}`} value={m.orderedBoxes || ""} onChange={e => handleUpdateMasterItem(m.id, 'orderedBoxes', Number(e.target.value))} onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();(document.getElementById(`check-box-${mIndex+1}`) as HTMLInputElement)?.focus();}}} className="w-20 border border-gray-300 rounded p-1.5 text-sm outline-none text-center focus:border-orange-400" placeholder="0"/>
                              </td>
                              <td className="p-3 text-center">
                                <span className="inline-block w-24 border border-gray-200 bg-gray-50 rounded p-1.5 text-sm text-center text-gray-700 font-medium">{m.orderedQty || '—'}</span>
                              </td>
                              <td className="p-3 text-center font-bold text-gray-800">{packedBoxes.toLocaleString()}</td>
                              <td className="p-3 text-center font-bold text-gray-800">{packedQty.toLocaleString()}</td>
                              <td className="p-3">
                                {mQty === 0 ? <span className="text-gray-400">—</span> :
                                 isMatch ? <span className="text-green-600 font-bold bg-green-50 border border-green-200 px-2 py-1 rounded flex items-center w-max gap-1"><CheckCircle2 className="w-4 h-4"/> Matched</span> :
                                 isMissing ? <span className="text-yellow-600 font-bold bg-yellow-50 border border-yellow-200 px-2 py-1 rounded w-max block">Incomplete</span> :
                                 <span className="text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-1 rounded w-max block">Overpacked</span>}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50 border-b border-gray-200">
                                <td colSpan={8} className="px-6 py-3">
                                  {palletsWithLine.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">This line has not been added to any pallet yet.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Pallets with Line {m.lineNo}:</p>
                                      {palletsWithLine.map(pallet => {
                                        const lineItems = pallet.items.filter(i => i.lineNo === m.lineNo);
                                        return (
                                          <div key={pallet.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2 shadow-sm">
                                            <div className="flex items-center gap-4 text-sm">
                                              <span className={`font-bold ${isLoomPallet(pallet) ? 'text-purple-700' : 'text-orange-500'}`}>Pallet {pallet.number}{isLoomPallet(pallet) ? ' (Loom)' : ''}</span>
                                              {lineItems.map(li => (
                                                <span key={li.id} className="text-gray-600">{li.boxes} boxes × {(Number(li.qtyPerBox)||0).toLocaleString()} qty/box = <b>{(li.boxes * (Number(li.qtyPerBox)||0)).toLocaleString()} pcs</b></span>
                                              ))}
                                            </div>
                                            <button onClick={() => setEditingPalletId(pallet.id)}
                                              className="flex items-center gap-1 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded shadow-sm">
                                              <Pencil className="w-3 h-3"/> Edit Pallet
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {(!editingOrder.masterItems || editingOrder.masterItems.length === 0) && (
                        <tr><td colSpan={8} className="p-6 text-center text-gray-500">Go to the "Items" tab to define the order lines first.</td></tr>
                      )}
                    </tbody>
                  </table>
               </div>
            )}
          </div>
        )}
      </main>

      {/* --- PALLET EDIT MODAL --- */}
      {editingPalletId && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setEditingPalletId(null)} />
          <div className="relative bg-slate-100 rounded-md shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
            <div className="p-4 flex justify-between items-center border-b border-gray-200 bg-white rounded-t-md">
              <h3 className="text-lg font-bold text-gray-800">
                Edit Pallet {editingOrder.palletList?.find(p => p.id === editingPalletId)?.number}
              </h3>
              <button onClick={() => setEditingPalletId(null)} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">Items on Pallet</label>
                <div className="bg-white border border-gray-300 rounded p-2 max-h-48 overflow-y-auto space-y-2">
                  {editingOrder.palletList?.find(p => p.id === editingPalletId)?.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center border border-gray-200 p-2.5 rounded shadow-sm">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[13px] text-gray-700 font-bold">L{item.lineNo}: {item.itemNumber}</span>
                          {itemNotes.find(n => n.itemNumber === item.itemNumber) && (
                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">⚠ {itemNotes.find(n => n.itemNumber === item.itemNumber)?.note}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500">({item.boxes}b x {item.qtyPerBox}u = {item.boxes * item.qtyPerBox}p) - Added by <span className="font-bold text-orange-500">{item.addedBy || 'N/A'}</span></span>
                        {(() => {
                          const master = editingOrder.masterItems?.find(m => m.lineNo === item.lineNo);
                          if (!master) return null;
                          const target = Number(master.orderedQty) || 0;
                          if (target === 0) return null;
                          const packed = getPackedQtyForLine(item.lineNo, editingOrder);
                          return (
                            <span className={`text-[10px] font-bold mt-0.5 ${packed > target ? 'text-red-600' : packed === target ? 'text-green-600' : 'text-gray-600'}`}>
                              Packed: {packed.toLocaleString()} / {target.toLocaleString()} pcs{packed > target ? ' (OVERPACKED!)' : ''}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex gap-2 items-center">
                        <button onClick={() => {setLineItemForm({...item}); setEditingLineItemId(item.id);}} className="text-orange-400 hover:text-orange-600"><Pencil className="w-4 h-4"/></button>
                        {/* Move to another pallet */}
                        <div className="relative">
                          <button onClick={() => { setMovingLineItemId(movingLineItemId === item.id ? null : item.id); setTargetPalletNumber(1); }} className="text-blue-400 hover:text-blue-600" title="Move to pallet"><ArrowRightLeft className="w-4 h-4"/></button>
                          {movingLineItemId === item.id && (
                            <div className="absolute right-0 bottom-7 bg-white border shadow-xl rounded p-2 z-20 flex gap-1 w-36">
                              <input type="number" min="1" max={editingOrder.palletList?.length} value={targetPalletNumber} onChange={e => setTargetPalletNumber(parseInt(e.target.value) || 1)} className="w-full border rounded p-1 text-xs" placeholder="Pallet #" />
                              <button onClick={() => handleMoveLineItem(item.id, editingPalletId!, targetPalletNumber)} className="bg-blue-500 text-white px-2 rounded text-xs font-bold">OK</button>
                            </div>
                          )}
                        </div>
                        <button onClick={() => handleDeleteLineItem(editingPalletId, item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))}
                  {editingOrder.palletList?.find(p => p.id === editingPalletId)?.items.length === 0 && <p className="text-[13px] text-gray-400 p-2">No items</p>}
                  <div ref={itemsEndRef}/>
                </div>
              </div>

              <div className="bg-[#eaedf1] border border-gray-300 rounded-md p-4">
                <h4 className="text-[13px] font-bold text-gray-800 mb-3">{editingLineItemId ? "Edit Item" : "Add New Item"}</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">Line No.</label>
                    <input id="pallet-field-line" value={lineItemForm.lineNo} onChange={e => handleLineNoChange(e.target.value)} onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();document.getElementById('pallet-field-item')?.focus();}}} className="w-full bg-white border border-gray-300 rounded p-1.5 text-[13px] outline-none focus:border-orange-400" />
                    {lineItemForm.lineNo && editingOrder?.masterItems?.find(m => m.lineNo === lineItemForm.lineNo) && (() => {
                      const master = editingOrder.masterItems!.find(m => m.lineNo === lineItemForm.lineNo)!;
                      const target = Number(master.orderedQty) || 0;
                      const packed = getPackedQtyForLine(lineItemForm.lineNo, editingOrder);
                      return target > 0 ? (
                        <p className="text-[11px] mt-1 text-gray-500">🎯 Target: <b className="text-orange-600">{target.toLocaleString()} pcs</b> &nbsp;|&nbsp; 📦 Packed: <b className={packed >= target ? 'text-green-600' : 'text-gray-700'}>{packed.toLocaleString()} pcs</b></p>
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">Item Number</label>
                    <input id="pallet-field-item" value={lineItemForm.itemNumber} onChange={e => setLineItemForm({...lineItemForm, itemNumber: e.target.value})} onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();document.getElementById('pallet-field-boxes')?.focus();}}} className="w-full bg-white border border-gray-300 rounded p-1.5 text-[13px] outline-none focus:border-orange-400" placeholder="SKU123" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">No. of Boxes</label>
                    <input id="pallet-field-boxes" type="number" value={lineItemForm.boxes || ""} onChange={e => setLineItemForm({...lineItemForm, boxes: Number(e.target.value)})} onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();document.getElementById('pallet-field-qty')?.focus();}}} className="w-full bg-white border border-gray-300 rounded p-1.5 text-[13px] outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">Qty/Box</label>
                    <input id="pallet-field-qty" type="number" placeholder="Manual/Auto" value={lineItemForm.qtyPerBox || ""} onChange={e => setLineItemForm({...lineItemForm, qtyPerBox: Number(e.target.value)})} onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();handleSaveLineItem();setTimeout(()=>document.getElementById('pallet-field-line')?.focus(),50);}}} className="w-full bg-white border border-gray-300 rounded p-1.5 text-[13px] outline-none focus:border-orange-400" />
                  </div>
                </div>
                <button onClick={() => handleSaveLineItem()} className="w-full py-2 bg-slate-100 border border-gray-300 rounded text-[13px] font-bold text-orange-500 hover:bg-white flex justify-center items-center gap-1.5 shadow-sm transition-colors"><Plus className="w-4 h-4"/> {editingLineItemId ? "Update Item" : "Add Item to Pallet"}</button>
              </div>
            </div>
            {/* ── Item Notes for this pallet ─────────────────── */}
            {(() => {
              const currentPalletItems = editingOrder?.palletList?.find(p => p.id === editingPalletId)?.items || [];
              const relevantNotes = itemNotes.filter(n => currentPalletItems.some(i => i.itemNumber === n.itemNumber));
              if (relevantNotes.length === 0) return null;
              return (
                <div className="border-t border-amber-200 mx-4 pt-3 mb-2">
                  <p className="text-[11px] font-black uppercase text-amber-600 tracking-wide mb-2">⚠ Item Notes</p>
                  <div className="space-y-1.5">
                    {relevantNotes.map(n => (
                      <div key={n.id} className="bg-amber-50 border border-amber-200 rounded px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-black text-slate-700">{n.itemNumber}</span>
                          {n.lot && <span className="text-[10px] bg-amber-200 text-amber-800 font-bold px-1.5 py-0.5 rounded">{n.lot}</span>}
                        </div>
                        <p className="text-[12px] text-amber-800 mt-0.5">{n.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="p-4 flex justify-end">
              <button onClick={() => setEditingPalletId(null)} className="px-5 py-2 bg-orange-500 text-white font-bold rounded shadow-sm hover:bg-orange-600 text-sm">Done & Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD BULK MODAL --- */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setIsBulkModalOpen(false)} />
          <div className="relative bg-slate-100 rounded-md shadow-2xl w-full max-w-sm flex flex-col">
            <div className="p-5 flex justify-between items-center border-b border-gray-200 bg-white rounded-t-md">
              <h3 className="text-lg font-bold text-gray-800">Add Bulk</h3>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-gray-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex border-b border-gray-200 bg-white">
               <button onClick={() => setBulkTab('looms')} className={`flex-1 py-3 text-sm font-bold ${bulkTab === 'looms' ? 'border-b-2 border-orange-500 text-orange-500' : 'text-gray-500'}`}>Looms</button>
               <button onClick={() => setBulkTab('standard')} className={`flex-1 py-3 text-sm font-bold ${bulkTab === 'standard' ? 'border-b-2 border-orange-500 text-orange-500' : 'text-gray-500'}`}>Standard Items</button>
            </div>
            <div className="p-6 space-y-4">
              {bulkTab === 'looms' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Line No. <span className="text-red-500">*</span></label>
                      <input type="text" value={bulkForm.lineNo} onChange={e => handleBulkLineNoChange(e.target.value)} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Item Number <span className="text-red-500">*</span></label>
                      <input type="text" value={bulkForm.itemNo} onChange={e => setBulkForm({...bulkForm, itemNo: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Loom Size <span className="text-red-500">*</span></label>
                    <select value={bulkForm.loomSize} onChange={e => setBulkForm({...bulkForm, loomSize: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400">
                      <option value="15000">15000</option>
                      <option value="4200">4200</option>
                      <option value="25000">25000</option>
                      <option value="8500">8500</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Number of Pallets <span className="text-red-500">*</span></label>
                    <input type="number" placeholder="e.g., 10" value={bulkForm.numPallets} onChange={e => setBulkForm({...bulkForm, numPallets: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Weight per Pallet (lbs) <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="e.g., 1200" value={bulkForm.weight} onChange={e => setBulkForm({...bulkForm, weight: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400" />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Line No. *</label>
                      <input type="text" value={bulkForm.lineNo} onChange={e => handleBulkLineNoChange(e.target.value)} className="w-full bg-white border border-gray-300 rounded p-2 text-xs focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Item Number *</label>
                      <input type="text" value={bulkForm.itemNo} onChange={e => setBulkForm({...bulkForm, itemNo: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-2 text-xs focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Boxes per Pallet *</label>
                      <input type="number" value={bulkForm.boxes} onChange={e => setBulkForm({...bulkForm, boxes: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-2 text-xs focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Qty/Box *</label>
                      <input type="number" value={bulkForm.qtyPerBox} onChange={e => setBulkForm({...bulkForm, qtyPerBox: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-2 text-xs focus:border-orange-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Total Pallets to Create *</label>
                    <input type="number" value={bulkForm.numPallets} onChange={e => setBulkForm({...bulkForm, numPallets: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-2 text-xs focus:border-orange-400" />
                  </div>
                </>
              )}
            </div>
            <div className="p-5 border-t border-gray-200 bg-white rounded-b-md flex justify-end gap-3">
              <button onClick={() => setIsBulkModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded text-sm font-medium bg-slate-100 hover:bg-gray-200">Cancel</button>
              <button onClick={handleProcessBulkAdd} className="px-4 py-2 bg-orange-500 text-white rounded text-sm font-bold hover:bg-orange-600">Add Pallets</button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK EDIT MODAL */}
      {isQuickEditOpen && editingOrder && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60" onClick={closeAndNavigateSummary} />
            <div className="relative bg-slate-100 rounded-md w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-gray-200 bg-white rounded-t-md flex justify-between items-center">
                 <h3 className="text-lg font-bold text-gray-800">Quick Edit: {editingOrder.id}</h3>
                 <button onClick={closeAndNavigateSummary} className="text-gray-500 hover:text-gray-800"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order #</label>
                  <input value={editingOrder.id} onChange={e => handleInputChange('id', e.target.value)} className={`w-full bg-white border rounded p-2 text-sm outline-none focus:border-orange-400 font-bold ${editingOrder.id !== _activeOrderContext?.orderId ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`} />
                  {editingOrder.id !== _activeOrderContext?.orderId && <p className="text-[11px] text-amber-600 mt-1">Order # changed — click Save to apply.</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipment Date <span className="text-red-500">*</span></label>
                  <input type="date" value={formatForInput(editingOrder.shipmentDate || "")} onChange={e => handleInputChange('shipmentDate', formatFromInput(e.target.value))} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea rows={3} value={editingOrder.notes || ""} onChange={e => handleInputChange('notes', e.target.value)} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:border-orange-400 resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Freight Terms</label>
                  <select value={editingOrder.freight} onChange={e => handleInputChange('freight', e.target.value)} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none appearance-none">
                    <option value="Select Freight Terms" disabled>Select Freight Terms</option>
                    <option value="Collect">Collect</option>
                    <option value="Prepaid">Prepaid</option>
                    <option value="PPD and Charge">PPD and Charge</option>
                    <option value="CPT">CPT</option>
                    <option value="FOB">FOB</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Truck</label>
                  <select value={editingOrder.truckId} onChange={e => handleInputChange('truckId', e.target.value)} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none appearance-none font-bold text-orange-500">
                    <option value="Unassigned">Unassigned</option>
                    <option value="Truck 1">Truck 1</option>
                    <option value="Truck 2">Truck 2</option>
                    <option value="Truck 3">Truck 3</option>
                    <option value="Truck 4">Truck 4</option>
                    <option value="Truck 5">Truck 5</option>
                    <option value="Truck 6">Truck 6</option>
                    <option value="House Account">House Account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
                  <select value={editingOrder.status} onChange={e => handleInputChange('status', e.target.value)} className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none appearance-none">
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>
                <div className="border-t border-gray-200 pt-4 mt-2">
                   <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700 mb-3">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={editingOrder.isManualOverride || false} onChange={e => handleInputChange('isManualOverride', e.target.checked)} />
                      <div className={`block w-10 h-5 rounded-full ${editingOrder.isManualOverride ? 'bg-orange-400' : 'bg-gray-300'}`}></div>
                      <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition ${editingOrder.isManualOverride ? 'transform translate-x-5' : ''}`}></div>
                    </div>
                    Manually Override Values (Estimates)
                  </label>
                  {editingOrder.isManualOverride && (
                    <div className="grid grid-cols-2 gap-3 bg-white p-4 border border-gray-200 rounded">
                       <div><label className="block text-xs font-bold text-gray-600 mb-1">Normal Pallets</label><input type="number" value={editingOrder.normalPallets ?? editingOrder.pallets ?? 0} onChange={e => handleInputChange('normalPallets', Number(e.target.value))} className="w-full border rounded p-1.5 text-sm outline-none focus:border-orange-400"/></div>
                       <div><label className="block text-xs font-bold text-gray-600 mb-1">Loom Pallets</label><input type="number" value={editingOrder.loomPallets || 0} onChange={e => handleInputChange('loomPallets', Number(e.target.value))} className="w-full border rounded p-1.5 text-sm outline-none focus:border-orange-400"/></div>
                       <div><label className="block text-xs font-bold text-gray-600 mb-1">Total Boxes</label><input type="number" value={editingOrder.boxes} onChange={e => handleInputChange('boxes', Number(e.target.value))} className="w-full border rounded p-1.5 text-sm outline-none focus:border-orange-400"/></div>
                       <div className="col-span-2"><label className="block text-xs font-bold text-gray-600 mb-1">Weight (lbs)</label><input value={editingOrder.weight} onChange={e => handleInputChange('weight', e.target.value)} className="w-full border rounded p-1.5 text-sm outline-none focus:border-orange-400"/></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 bg-white rounded-b-md flex justify-end gap-3">
                <button onClick={closeAndNavigateSummary} className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50">Close</button>
                <button onClick={handleQuickEditSave} className="px-4 py-2 bg-orange-500 text-white rounded text-sm font-bold hover:bg-orange-600">Save</button>
              </div>
            </div>
         </div>
      )}

      {/* GLOBAL CONFIRM MODAL */}
      {confirmDialog && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setConfirmDialog(null)} />
            <div className="relative bg-white rounded-md shadow-xl w-full max-w-sm flex flex-col p-6 text-center">
               <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                 <AlertTriangle className="h-6 w-6 text-red-600" />
               </div>
               <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmDialog.title}</h3>
               <p className="text-sm text-gray-500 mb-6">{confirmDialog.message}</p>
               <div className="flex gap-3 justify-center">
                 <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                 <button onClick={confirmDialog.onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-bold hover:bg-red-700">Confirm</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}