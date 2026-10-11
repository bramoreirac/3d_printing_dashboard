import { useMemo, useState } from 'react'
import { Plus, Calculator } from 'lucide-react'
import type { GlobalSettings, Machine, Material, Order } from '../types'
import { calculateQuote, formatMoney, money, paymentStatus } from '../lib/calc'
import { SelectField, TextField } from './fields'
import { PaymentBadge } from './PaymentBadge'

interface OrdersTabProps {
  orders: Order[]
  machines: Machine[]
  materials: Material[]
  settings: GlobalSettings
  onSaveOrder: (order: Order) => void
}

interface FormState {
  machineId: string
  materialId: string
  clientName: string
  designName: string
  grams: string
  printHours: string
  laborCost: string
  priceTotal: string
  amountPaid: string
}

const emptyForm = (machines: Machine[], materials: Material[]): FormState => ({
  machineId: machines[0]?.id ?? '',
  materialId: materials[0]?.id ?? '',
  clientName: '',
  designName: '',
  grams: '',
  printHours: '',
  laborCost: '',
  priceTotal: '',
  amountPaid: '0',
})

const required = 'Obligatorio'
const mustBePositive = 'Debe ser mayor a 0'
const laborInvalid = 'Debe ser ≥ 0 (o dejar vacío)'
const paidInvalid = 'Debe ser ≥ 0'
const paidTooHigh = 'No puede superar el precio'

export function OrdersTab({ orders, machines, materials, settings, onSaveOrder }: OrdersTabProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(machines, materials))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedFlash, setSavedFlash] = useState(false)

  const activeMachines = machines.filter((m) => m.isActive)
  const activeMaterials = materials.filter((m) => m.isActive)
  const machine = machines.find((m) => m.id === form.machineId)
  const material = materials.find((m) => m.id === form.materialId)

  const draft = useMemo(() => {
    const grams = parseFloat(form.grams)
    const hours = parseFloat(form.printHours)
    if (!machine || !material || !isFinite(grams) || !isFinite(hours)) return null
    const laborRaw = form.laborCost.trim()
    const labor = laborRaw === '' ? null : parseFloat(laborRaw)
    if (labor !== null && !isFinite(labor)) return null
    const price = parseFloat(form.priceTotal)
    return calculateQuote(machine, material.costPer1000g, settings, {
      grams,
      printHours: hours,
      laborCost: labor,
      priceTotal: isFinite(price) ? price : 0,
    })
  }, [form, machine, material, settings])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.clientName.trim()) next.clientName = required
    if (!form.designName.trim()) next.designName = required
    const grams = parseFloat(form.grams)
    if (!isFinite(grams) || grams <= 0) next.grams = mustBePositive
    const hours = parseFloat(form.printHours)
    if (!isFinite(hours) || hours <= 0) next.printHours = mustBePositive
    const price = parseFloat(form.priceTotal)
    if (!isFinite(price) || price <= 0) next.priceTotal = mustBePositive
    const laborRaw = form.laborCost.trim()
    if (laborRaw !== '' && (!isFinite(parseFloat(laborRaw)) || parseFloat(laborRaw) < 0)) {
      next.laborCost = laborInvalid
    }
    const paid = parseFloat(form.amountPaid)
    if (!isFinite(paid) || paid < 0) next.amountPaid = paidInvalid
    else if (isFinite(price) && paid > price) next.amountPaid = paidTooHigh
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !draft || !machine || !material) return
    const laborRaw = form.laborCost.trim()
    const order: Order = {
      id: `o-${Date.now()}`,
      machineId: machine.id,
      materialId: material.id,
      clientName: form.clientName.trim(),
      designName: form.designName.trim(),
      orderDate: new Date().toISOString().slice(0, 10),
      grams: money(parseFloat(form.grams)),
      printHours: money(parseFloat(form.printHours)),
      laborCost: laborRaw === '' ? null : money(parseFloat(laborRaw)),
      priceTotal: money(parseFloat(form.priceTotal)),
      amountPaid: money(parseFloat(form.amountPaid)),
      materialPricePer1000g: material.costPer1000g,
      materialCost: money(draft.materialCost),
      energyCost: money(draft.energyCost),
      wearCost: money(draft.wearCost),
      totalCost: money(draft.totalCost),
      profit: money(draft.profit),
      status: parseFloat(form.amountPaid) >= parseFloat(form.priceTotal) ? 'completed' : 'open',
    }
    onSaveOrder(order)
    setForm(emptyForm(machines, materials))
    setErrors({})
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const openOrders = orders.filter((o) => o.status !== 'cancelled')
  const totals = openOrders.reduce(
    (acc, o) => ({ revenue: acc.revenue + o.priceTotal, profit: acc.profit + o.profit }),
    { revenue: 0, profit: 0 },
  )
  const paid = openOrders.reduce((acc, o) => acc + o.amountPaid, 0)

  return (
    <>
      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">Pedidos</div>
          <div className="kpi-value">{openOrders.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total cotizado</div>
          <div className="kpi-value">{formatMoney(totals.revenue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Cobrado</div>
          <div className="kpi-value">{formatMoney(paid)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ganancia estimada</div>
          <div className={`kpi-value ${totals.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
            {formatMoney(totals.profit)}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={handleSubmit} noValidate>
          <h3>
            <Calculator size={16} aria-hidden="true" /> Nueva cotización
          </h3>
          <div className="form-grid">
            <SelectField
              label="Impresora"
              value={form.machineId}
              onChange={(v) => set('machineId', v)}
              options={activeMachines.map((m) => ({ value: m.id, label: m.name }))}
            />
            <SelectField
              label="Material"
              value={form.materialId}
              onChange={(v) => set('materialId', v)}
              options={activeMaterials.map((m) => ({ value: m.id, label: m.name }))}
            />
            <TextField label="Cliente" value={form.clientName} onChange={(v) => set('clientName', v)} error={errors.clientName} placeholder="Ej. Roberto Gómez" />
            <TextField label="Diseño / pieza" value={form.designName} onChange={(v) => set('designName', v)} error={errors.designName} placeholder="Ej. Lámpara de litofanía" />
            <TextField label="Gramos" type="number" step="0.01" min="0" value={form.grams} onChange={(v) => set('grams', v)} error={errors.grams} placeholder="120" />
            <TextField label="Horas de impresión" type="number" step="0.01" min="0" value={form.printHours} onChange={(v) => set('printHours', v)} error={errors.printHours} placeholder="5" />
            <TextField label="Mano de obra (opcional)" type="number" step="0.01" min="0" value={form.laborCost} onChange={(v) => set('laborCost', v)} error={errors.laborCost} placeholder="vacío = sin costo" />
            <TextField label="Precio cobrado (USD)" type="number" step="0.01" min="0" value={form.priceTotal} onChange={(v) => set('priceTotal', v)} error={errors.priceTotal} placeholder="25.00" />
            <TextField label="Monto cobrado" type="number" step="0.01" min="0" value={form.amountPaid} onChange={(v) => set('amountPaid', v)} error={errors.amountPaid} placeholder="0.00" />
          </div>

          {draft && (
            <div className="breakdown" aria-live="polite">
              <div className="breakdown-row">
                <span>Material ({material?.name})</span>
                <span>{formatMoney(draft.materialCost)}</span>
              </div>
              <div className="breakdown-row">
                <span>Energía ({settings.printerWatts}W × {form.printHours || 0}h)</span>
                <span>{formatMoney(draft.energyCost)}</span>
              </div>
              <div className="breakdown-row">
                <span>Desgaste de máquina ({form.printHours || 0}h)</span>
                <span>{formatMoney(draft.wearCost)}</span>
              </div>
              {draft.laborCost > 0 && (
                <div className="breakdown-row">
                  <span>Mano de obra</span>
                  <span>{formatMoney(draft.laborCost)}</span>
                </div>
              )}
              <div className="breakdown-row breakdown-total">
                <span>Costo total</span>
                <span>{formatMoney(draft.totalCost)}</span>
              </div>
              <div className="breakdown-row">
                <span>Ganancia</span>
                <span className={draft.profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                  {formatMoney(draft.profit)}
                  {draft.marginPct !== null && (
                    <span className="muted"> · {draft.marginPct.toFixed(1)}% margen</span>
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn" disabled={!draft}>
              <Plus size={16} aria-hidden="true" /> Guardar pedido
            </button>
            {savedFlash && (
              <span className="small profit-positive" role="status">
                Pedido guardado (prototipo — solo en memoria)
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Historial de pedidos</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Diseño</th>
                <th>Impresora</th>
                <th className="num">g</th>
                <th className="num">Horas</th>
                <th className="num">Costo</th>
                <th className="num">Precio</th>
                <th className="num">Cobrado</th>
                <th className="num">Ganancia</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const mach = machines.find((m) => m.id === o.machineId)
                return (
                  <tr key={o.id}>
                    <td>{o.orderDate}</td>
                    <td>{o.clientName}</td>
                    <td>{o.designName}</td>
                    <td>{mach?.name ?? '—'}</td>
                    <td className="num">{o.grams}</td>
                    <td className="num">{o.printHours}</td>
                    <td className="num">{formatMoney(o.totalCost)}</td>
                    <td className="num">{formatMoney(o.priceTotal)}</td>
                    <td className="num">{formatMoney(o.amountPaid)}</td>
                    <td className={`num ${o.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                      {formatMoney(o.profit)}
                    </td>
                    <td>
                      <PaymentBadge status={paymentStatus(o.priceTotal, o.amountPaid)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
