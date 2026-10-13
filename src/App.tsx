import { useEffect, useState } from 'react'
import { Boxes, Calculator, LogOut, Menu } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import type { Machine, MaintenanceRecord, Material, Order, Supply } from './types'
import {
  sampleMaintenance,
  sampleMaterials,
  sampleMachines,
  sampleOrders,
  sampleSettings,
  sampleSupplies,
} from './data/sample'
import { isCloudMode, supabase } from './lib/supabase'
import {
  deleteOrder as dbDeleteOrder,
  fetchMaintenance,
  fetchMaterials,
  fetchMachines,
  fetchOrders,
  fetchSuppliesWithStock,
  insertMaintenance,
  insertStockAdjustment,
  saveOrder,
  type MaintenanceInput,
  type SaveOrderInput,
  type SupplyStock,
} from './lib/db'
import { calculateQuote, money } from './lib/calc'
import { OrdersTab } from './components/OrdersTab'
import { FleetTab } from './components/FleetTab'
import { SignIn } from './components/SignIn'

type Tab = 'orders' | 'fleet'

/**
 * Maps rows from the supply_stock view to the Supply shape. Stock comes
 * pre-computed (sum of adjustments); the adjustments array is kept empty
 * to avoid double counting in the UI.
 */
function toSupplies(rows: SupplyStock[]): Supply[] {
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    unit: s.unit,
    minThreshold: s.minThreshold,
    adjustments: [],
    stockQtyOverride: s.stockQty,
  }))
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function App() {
  const [tab, setTab] = useState<Tab>('orders')
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isCloudMode)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  // Phone-only hamburger menu; irrelevant (and hidden) on desktop.
  const [menuOpen, setMenuOpen] = useState(false)

  // Prototype state: in-memory only when no Supabase is configured.
  const [orders, setOrders] = useState<Order[]>(sampleOrders)
  const [machines, setMachines] = useState<Machine[]>(sampleMachines)
  const [materials, setMaterials] = useState<Material[]>(sampleMaterials)
  const [supplies, setSupplies] = useState<Supply[]>(sampleSupplies)
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>(sampleMaintenance)

  // Auth session: fires on sign-in, sign-out, and token refresh.
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load owner data on sign-in; prototype sample data otherwise.
  useEffect(() => {
    if (!supabase || !session) return
    let cancelled = false
    setLoadError(null)
    setDataLoading(true)
    Promise.all([
      fetchMachines(),
      fetchMaterials(),
      fetchSuppliesWithStock(),
      fetchOrders(),
      fetchMaintenance(),
    ])
      .then(([fetchedMachines, fetchedMaterials, fetchedSupplies, fetchedOrders, fetchedMaintenance]) => {
        if (cancelled) return
        setMachines(fetchedMachines)
        setMaterials(fetchedMaterials)
        setSupplies(toSupplies(fetchedSupplies))
        setOrders(fetchedOrders)
        setMaintenance(fetchedMaintenance)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  // Orders change stock (deduction on save, reversal on delete): refresh so
  // the Supplies tab stays accurate without a manual reload.
  async function refreshSupplies() {
    const fetched = await fetchSuppliesWithStock()
    setSupplies(toSupplies(fetched))
  }

  /**
   * Saves a quote. Cloud mode calls the SECURITY DEFINER RPC, which recomputes
   * costs server-side, snapshots them, and deducts stock in one transaction.
   * Prototype mode reproduces the same math locally and keeps it in memory.
   */
  async function handleSaveOrder(input: SaveOrderInput): Promise<Order> {
    if (isCloudMode) {
      const created = await saveOrder(input)
      setOrders((prev) => [created, ...prev])
      await refreshSupplies()
      return created
    }
    const machine = machines.find((m) => m.id === input.machineId)
    const material = materials.find((m) => m.id === input.materialId)
    if (!machine || !material) throw new Error('Impresora o material no encontrado')
    const draft = calculateQuote(machine, material.costPer1000g, sampleSettings, {
      grams: input.grams,
      printHours: input.printHours,
      laborCost: input.laborCost,
      priceTotal: input.priceTotal,
    })
    const order: Order = {
      id: `o-${Date.now()}`,
      ...input,
      orderDate: new Date().toISOString().slice(0, 10),
      materialPricePer1000g: material.costPer1000g,
      materialCost: money(draft.materialCost),
      energyCost: money(draft.energyCost),
      wearCost: money(draft.wearCost),
      totalCost: money(draft.totalCost),
      profit: money(draft.profit),
      status: input.amountPaid >= input.priceTotal ? 'completed' : 'open',
    }
    setOrders((prev) => [order, ...prev])
    return order
  }

  /** Deleting an order in cloud mode reverses its stock deduction (same transaction). */
  async function handleDeleteOrder(orderId: string): Promise<void> {
    if (isCloudMode) {
      await dbDeleteOrder(orderId)
      await refreshSupplies()
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
  }

  /** Saves a maintenance record; cloud mode persists, prototype keeps it in memory. */
  async function handleSaveMaintenance(input: MaintenanceInput): Promise<MaintenanceRecord> {
    if (isCloudMode) {
      const created = await insertMaintenance(input)
      setMaintenance((prev) => [created, ...prev])
      return created
    }
    const record: MaintenanceRecord = { id: `mnt-${Date.now()}`, ...input }
    setMaintenance((prev) => [record, ...prev])
    return record
  }

  /**
   * Records a manual stock movement (a filament purchase, a correction).
   * Cloud mode persists the adjustment and re-reads stock from the view;
   * prototype mode appends to the supply's local adjustments.
   */
  async function handleStockAdjustment(
    supplyId: string,
    delta: number,
    reason: string,
  ): Promise<void> {
    if (isCloudMode) {
      await insertStockAdjustment(supplyId, delta, reason)
      await refreshSupplies()
      return
    }
    setSupplies((prev) =>
      prev.map((s) =>
        s.id === supplyId
          ? {
              ...s,
              adjustments: [
                ...s.adjustments,
                { id: `adj-${Date.now()}`, delta, reason, createdAt: todayIso() },
              ],
              // Manual adjustments only exist in prototype mode's local arrays;
              // cloud mode stock always comes from the view.
              stockQtyOverride: undefined,
            }
          : s,
      ),
    )
  }

  async function handleSignOut() {
    await supabase?.auth.signOut()
  }

  const tabs: { id: Tab; label: string; icon: typeof Calculator }[] = [
    { id: 'orders', label: 'Cotizaciones y Rentabilidad', icon: Calculator },
    { id: 'fleet', label: 'Máquinas y Materiales', icon: Boxes },
  ]

  if (isCloudMode && !authReady) {
    return (
      <main className="auth-page">
        <p className="muted" role="status">
          Cargando…
        </p>
      </main>
    )
  }

  if (isCloudMode && !session) {
    return <SignIn />
  }

  return (
    <>
      <header className="app-header">
        <h1>Panel de Impresión 3D</h1>
        <nav
          id="main-tabs"
          className={`tab-nav ${menuOpen ? 'tab-nav-open' : ''}`}
          role="tablist"
          aria-label="Secciones principales"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id)
                setMenuOpen(false)
              }}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>
        {isCloudMode && session && (
          <div className="header-account">
            <span className="session-user" title={session.user.email}>
              Conectado como {session.user.email}
            </span>
            <button className="signout-btn" onClick={handleSignOut} title="Cerrar sesión">
              <LogOut size={15} aria-hidden="true" /> Salir
            </button>
          </div>
        )}
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="main-tabs"
          aria-label="Secciones"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
      </header>
      {menuOpen && (
        <div
          className="menu-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="page">
        <div className="page-intro">
          <h2>{tab === 'orders' ? 'Cotizaciones y Rentabilidad' : 'Máquinas y Materiales'}</h2>
          <p>
            {tab === 'orders'
              ? 'Calcula cotizaciones, registra pedidos y revisa la ganancia estimada de cada trabajo.'
              : 'Tarifas de desgaste de la flota, fechas de mantenimiento y existencias de insumos.'}
          </p>
        </div>

        {loadError && (
          <div className="card" role="alert">
            <strong>No se pudieron cargar los datos.</strong>{' '}
            <span className="muted">{loadError}</span>
          </div>
        )}

        {dataLoading && (
          <div className="card" role="status">
            Cargando datos…
          </div>
        )}

        {!dataLoading && !loadError && tab === 'orders' ? (
          <OrdersTab
            orders={orders}
            machines={machines}
            materials={materials}
            settings={sampleSettings}
            cloudMode={isCloudMode}
            onSaveOrder={handleSaveOrder}
            onDeleteOrder={handleDeleteOrder}
          />
        ) : (
          <FleetTab
            machines={machines}
            materials={materials}
            supplies={supplies}
            maintenance={maintenance}
            orders={orders}
            cloudMode={isCloudMode}
            onMachinesChange={setMachines}
            onMaterialsChange={setMaterials}
            onSaveMaintenance={handleSaveMaintenance}
            onStockAdjustment={handleStockAdjustment}
          />
        )}
      </main>
    </>
  )
}
