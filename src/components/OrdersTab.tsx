import { useEffect, useMemo, useState } from 'react'
import { Plus, Calculator, Trash2 } from 'lucide-react'
import type { GlobalSettings, Machine, Material, Order } from '../types'
import {
  calculateQuote,
  formatMoney,
  money,
  paymentStatus,
  suggestedPrice,
  type PricingMode,
} from '../lib/calc'
import type { SaveOrderInput } from '../lib/db'
import { SelectField, TextField } from './fields'
import { PaymentBadge } from './PaymentBadge'

interface OrdersTabProps {
  orders: Order[]
  machines: Machine[]
  materials: Material[]
  settings: GlobalSettings
  cloudMode: boolean
  onSaveOrder: (input: SaveOrderInput) => Promise<Order>
  onDeleteOrder: (orderId: string) => Promise<void>
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

export function OrdersTab({
  orders,
  machines,
  materials,
  settings,
  cloudMode,
  onSaveOrder,
  onDeleteOrder,
}: OrdersTabProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(machines, materials))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedFlash, setSavedFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Markup/margin helper: the owner types a percentage, gets a suggested price.
  const [pricingMode, setPricingMode] = useState<PricingMode>('markup')
  const [pricingPct, setPricingPct] = useState('')

  const activeMachines = machines.filter((m) => m.isActive)
  const activeMaterials = materials.filter((m) => m.isActive)
  const machine = machines.find((m) => m.id === form.machineId)
  const material = materials.find((m) => m.id === form.materialId)

  // The form preselects the first machine/material on mount, when the lists
  // may still hold prototype sample data. In cloud mode the real records
  // replace them moments later, orphaning the preselected id — the select
  // still displays an option (React falls back to the first one), but the
  // lookup fails, the quote draft never forms, and the save button stays
  // disabled with no visible reason. Re-point the selection when it goes stale.
  useEffect(() => {
    setForm((f) => {
      const machineOk = machines.some((m) => m.id === f.machineId)
      const materialOk = materials.some((m) => m.id === f.materialId)
      if (machineOk && materialOk) return f
      return {
        ...f,
        machineId: machineOk ? f.machineId : (activeMachines[0]?.id ?? ''),
        materialId: materialOk ? f.materialId : (activeMaterials[0]?.id ?? ''),
      }
    })
    // activeMachines/activeMaterials are derived from machines/materials;
    // depending on the sources keeps the effect minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machines, materials])

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

  // Suggested price from the current cost breakdown and the chosen markup/margin.
  const pricingPctNum = parseFloat(pricingPct)
  const suggestion = useMemo(() => {
    if (!draft || !isFinite(pricingPctNum) || pricingPctNum < 0) return null
    return suggestedPrice(draft.totalCost, pricingMode, pricingPctNum)
  }, [draft, pricingMode, pricingPctNum])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !machine || !material || saving) return
    const laborRaw = form.laborCost.trim()
    const input: SaveOrderInput = {
      machineId: machine.id,
      materialId: material.id,
      clientName: form.clientName.trim(),
      designName: form.designName.trim(),
      grams: money(parseFloat(form.grams)),
      printHours: money(parseFloat(form.printHours)),
      laborCost: laborRaw === '' ? null : money(parseFloat(laborRaw)),
      priceTotal: money(parseFloat(form.priceTotal)),
      amountPaid: money(parseFloat(form.amountPaid)),
    }
    setSaving(true)
    setSaveError(null)
    try {
      await onSaveOrder(input)
      setForm(emptyForm(machines, materials))
      setErrors({})
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(order: Order) {
    if (!window.confirm(`¿Eliminar el pedido de ${order.clientName}? Se devolverá el stock consumido.`))
      return
    setSaveError(null)
    try {
      await onDeleteOrder(order.id)
    } catch (err) {
      setSaveError((err as Error).message)
    }
  }

  function applySuggestion() {
    if (suggestion === null) return
    set('priceTotal', String(money(suggestion)))
  }

  const openOrders = orders.filter((o) => o.status !== 'cancelled')
  const totals = openOrders.reduce(
    (acc, o) => ({ revenue: acc.revenue + o.priceTotal, profit: acc.profit + o.profit }),
    { revenue: 0, profit: 0 },
  )
  const paid = openOrders.reduce((acc, o) => acc + o.amountPaid, 0)

  return (
    <>
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

          {(activeMachines.length === 0 || activeMaterials.length === 0) && (
            <p className="small muted" role="status">
              Para guardar un pedido necesitas al menos una impresora y un material activos
              en la pestaña «Máquinas y Materiales».
            </p>
          )}

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

          {draft && (
            <div className="pricing-helper" role="group" aria-label="Sugerir precio con markup o margen">
              <SelectField<PricingMode>
                label="Cálculo de precio"
                value={pricingMode}
                onChange={setPricingMode}
                options={[
                  { value: 'markup', label: 'Markup (sobre el costo)' },
                  { value: 'margin', label: 'Margen (sobre el precio)' },
                ]}
              />
              <TextField
                label="Porcentaje (%)"
                type="number"
                step="0.1"
                min="0"
                value={pricingPct}
                onChange={setPricingPct}
                placeholder="Ej. 60"
              />
              <div className="field pricing-result">
                <span className="small muted">Precio sugerido</span>
                <strong>
                  {suggestion !== null && pricingPct.trim() !== ''
                    ? formatMoney(money(suggestion))
                    : '—'}
                </strong>
                {pricingMode === 'margin' && isFinite(pricingPctNum) && pricingPctNum >= 100 && (
                  <span className="small error" role="alert">
                    El margen debe ser menor a 100%
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={applySuggestion}
                disabled={suggestion === null}
              >
                Usar precio sugerido
              </button>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn" disabled={!draft || saving}>
              <Plus size={16} aria-hidden="true" /> {saving ? 'Guardando…' : 'Guardar pedido'}
            </button>
            {savedFlash && (
              <span className="small profit-positive" role="status">
                {cloudMode
                  ? 'Pedido guardado — stock descontado'
                  : 'Pedido guardado (prototipo — solo en memoria)'}
              </span>
            )}
            {saveError && (
              <span className="small error" role="alert">
                {saveError}
              </span>
            )}
          </div>
        </form>

        <div className="kpi-stack" role="group" aria-label="Resumen de pedidos">
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
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
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
                    <td>
                      <button
                        className="icon-btn"
                        onClick={() => handleDelete(o)}
                        title="Eliminar pedido"
                        aria-label={`Eliminar pedido de ${o.clientName}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
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
