import { AlertTriangle, Boxes, Printer, Settings, Wrench } from 'lucide-react'
import type { Machine, MaintenanceRecord, Material, Order, Supply } from '../types'
import { formatMoney } from '../lib/calc'

interface FleetTabProps {
  machines: Machine[]
  materials: Material[]
  supplies: Supply[]
  maintenance: MaintenanceRecord[]
  orders: Order[]
}

function stockQty(supply: Supply): number {
  return supply.adjustments.reduce((sum, a) => sum + a.delta, 0)
}

function hoursRegistered(machineId: string, orders: Order[]): number {
  return orders
    .filter((o) => o.machineId === machineId && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.printHours, 0)
}

const machineIcons = {
  print: Printer,
  cube: Boxes,
  cubes: Boxes,
  gear: Settings,
} as const

export function FleetTab({ machines, materials, supplies, maintenance, orders }: FleetTabProps) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div className="card">
        <h3>
          <Settings size={16} aria-hidden="true" /> Fleet &amp; hourly rates
        </h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Machine</th>
                <th className="num">Investment</th>
                <th className="num">Life (h)</th>
                <th className="num">Amort./h</th>
                <th className="num">Maint./h</th>
                <th className="num">Wear rate</th>
                <th className="num">Hours used</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => {
                const Icon = machineIcons[m.icon]
                const amort = (m.purchasePrice - m.residualValue) / m.usefulLifeHours
                const maint = m.annualMaintenanceCost / m.annualUsageHours
                return (
                  <tr key={m.id}>
                    <td>
                      <Icon size={14} className="icon-inline" aria-hidden="true" /> {m.name}
                    </td>
                    <td className="num">{formatMoney(m.purchasePrice)}</td>
                    <td className="num">{m.usefulLifeHours}</td>
                    <td className="num">{formatMoney(amort)}/h</td>
                    <td className="num">{formatMoney(maint)}/h</td>
                    <td className="num">
                      <strong>{formatMoney(amort + maint)}/h</strong>
                    </td>
                    <td className="num">{hoursRegistered(m.id, orders).toFixed(1)}</td>
                    <td>
                      <span className={`badge ${m.isActive ? 'badge-ok' : 'badge-partial'}`}>
                        {m.isActive ? 'Active' : 'Retired'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 'var(--space-2)' }}>
          Residual value is subtracted from the investment before amortizing
          (all current machines: {formatMoney(0)}).
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>
            <Wrench size={16} aria-hidden="true" /> Maintenance
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Performed</th>
                  <th>Description</th>
                  <th className="num">Cost</th>
                  <th>Next due</th>
                </tr>
              </thead>
              <tbody>
                {maintenance.map((r) => {
                  const machine = machines.find((m) => m.id === r.machineId)
                  const overdue = r.nextDueAt !== null && r.nextDueAt < today
                  return (
                    <tr key={r.id}>
                      <td>{machine?.name ?? '—'}</td>
                      <td>{r.performedAt}</td>
                      <td>{r.description}</td>
                      <td className="num">{formatMoney(r.cost)}</td>
                      <td>
                        {r.nextDueAt === null ? (
                          <span className="muted">—</span>
                        ) : overdue ? (
                          <span className="badge badge-overdue">
                            <AlertTriangle size={11} aria-hidden="true" /> Overdue since {r.nextDueAt}
                          </span>
                        ) : (
                          <span className="badge badge-ok">Due {r.nextDueAt}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>
            <Boxes size={16} aria-hidden="true" /> Supplies &amp; stock
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Supply</th>
                  <th className="num">In stock</th>
                  <th className="num">Min.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {supplies.map((s) => {
                  const qty = stockQty(s)
                  const low = qty <= s.minThreshold
                  const material = materials.find((mt) => mt.supplyId === s.id)
                  return (
                    <tr key={s.id}>
                      <td>
                        {s.name}
                        {material && (
                          <span className="muted small"> · {formatMoney(material.costPer1000g)}/kg</span>
                        )}
                      </td>
                      <td className="num">
                        {qty} {s.unit}
                      </td>
                      <td className="num">
                        {s.minThreshold} {s.unit}
                      </td>
                      <td>
                        {low ? (
                          <span className="badge badge-low">
                            <AlertTriangle size={11} aria-hidden="true" /> Low stock
                          </span>
                        ) : (
                          <span className="badge badge-ok">OK</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 'var(--space-2)' }}>
            Stock = sum of adjustments. Saving an order deducts its grams from the
            linked material's supply automatically.
          </p>
        </div>
      </div>
    </>
  )
}
