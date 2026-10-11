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
    { id: 'orders', label: 'Quotes & Profitability', icon: Calculator },
    { id: 'fleet', label: 'Machines & Supplies', icon: Boxes },
  ]

  return (
    <>
      <header className="app-header">
        <h1>3D Print Dashboard</h1>
        <nav className="tab-nav" role="tablist" aria-label="Main sections">
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
          <h2>{tab === 'orders' ? 'Quotes & Profitability' : 'Machines & Supplies'}</h2>
          <p>
            {tab === 'orders'
              ? 'Calculate quotes, track orders, and see estimated profit per job.'
              : 'Fleet wear rates, maintenance due dates, and consumable stock levels.'}
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
