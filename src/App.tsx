import { useEffect, useState } from 'react'
import { Boxes, Calculator, LogOut } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import type { Machine, Material, Order, Supply } from './types'
import {
  sampleMaintenance,
  sampleMaterials,
  sampleMachines,
  sampleOrders,
  sampleSettings,
  sampleSupplies,
} from './data/sample'
import { isCloudMode, supabase } from './lib/supabase'
import { fetchMaterials, fetchMachines, fetchSuppliesWithStock } from './lib/db'
import { OrdersTab } from './components/OrdersTab'
import { FleetTab } from './components/FleetTab'
import { SignIn } from './components/SignIn'

type Tab = 'orders' | 'fleet'

export default function App() {
  const [tab, setTab] = useState<Tab>('orders')
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isCloudMode)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Prototype state: in-memory only when no Supabase is configured.
  const [orders, setOrders] = useState<Order[]>(sampleOrders)
  const [machines, setMachines] = useState<Machine[]>(sampleMachines)
  const [materials, setMaterials] = useState<Material[]>(sampleMaterials)
  const [supplies, setSupplies] = useState<Supply[]>(sampleSupplies)

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
    Promise.all([fetchMachines(), fetchMaterials(), fetchSuppliesWithStock()])
      .then(([fetchedMachines, fetchedMaterials, fetchedSupplies]) => {
        if (cancelled) return
        setMachines(fetchedMachines)
        setMaterials(fetchedMaterials)
        setSupplies(
          fetchedSupplies.map((s) => ({
            id: s.id,
            name: s.name,
            unit: s.unit,
            minThreshold: s.minThreshold,
            // Stock comes from the supply_stock view (sum of adjustments);
            // the adjustments array is kept empty to avoid double counting.
            adjustments: [],
            stockQtyOverride: s.stockQty,
          })) as Supply[],
        )
        setOrders([]) // orders arrive in Sprint 3
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [session])

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
        <nav className="tab-nav" role="tablist" aria-label="Secciones principales">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>
        {isCloudMode && (
          <button className="signout-btn" onClick={handleSignOut} title="Cerrar sesión">
            <LogOut size={15} aria-hidden="true" /> Salir
          </button>
        )}
      </header>

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

        {tab === 'orders' ? (
          <OrdersTab
            orders={orders}
            machines={machines}
            materials={materials}
            settings={sampleSettings}
            onSaveOrder={(order) => setOrders((prev) => [order, ...prev])}
          />
        ) : (
          <FleetTab
            machines={machines}
            materials={materials}
            supplies={supplies}
            maintenance={sampleMaintenance}
            orders={orders}
            cloudMode={isCloudMode}
            onMachinesChange={setMachines}
            onMaterialsChange={setMaterials}
          />
        )}
      </main>
    </>
  )
}
