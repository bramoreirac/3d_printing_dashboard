import { useState } from 'react'
import { Boxes, Calculator } from 'lucide-react'
import type { Order } from './types'
import {
  sampleMaintenance,
  sampleMaterials,
  sampleMachines,
  sampleOrders,
  sampleSettings,
  sampleSupplies,
} from './data/sample'
import { OrdersTab } from './components/OrdersTab'
import { FleetTab } from './components/FleetTab'

type Tab = 'orders' | 'fleet'

export default function App() {
  const [tab, setTab] = useState<Tab>('orders')
  // Prototype state: in-memory only. Sprint 2 replaces this with Supabase.
  const [orders, setOrders] = useState<Order[]>(sampleOrders)

  const tabs: { id: Tab; label: string; icon: typeof Calculator }[] = [
    { id: 'orders', label: 'Cotizaciones y Rentabilidad', icon: Calculator },
    { id: 'fleet', label: 'Máquinas y Materiales', icon: Boxes },
  ]

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

        {tab === 'orders' ? (
          <OrdersTab
            orders={orders}
            machines={sampleMachines}
            materials={sampleMaterials}
            settings={sampleSettings}
            onSaveOrder={(order) => setOrders((prev) => [order, ...prev])}
          />
        ) : (
          <FleetTab
            machines={sampleMachines}
            materials={sampleMaterials}
            supplies={sampleSupplies}
            maintenance={sampleMaintenance}
            orders={orders}
          />
        )}
      </main>
    </>
  )
}
