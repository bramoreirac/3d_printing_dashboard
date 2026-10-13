import { Fragment, useEffect, useMemo, useState } from 'react'
import { Plus, Calculator, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
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
  onUpdateOrderPayment: (order: Order, amountPaid: number) => Promise<Order>
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
  onUpdateOrderPayment,
}: OrdersTabProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(machines, materials))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedFlash, setSavedFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Markup/margin helper: the owner types a percentage, gets a suggested price.
  const [pricingMode, setPricingMode] = useState<PricingMode>('markup')
  const [pricingPct, setPricingPct] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [paymentValue, setPaymentValue] = useState('')
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentSavedId, setPaymentSavedId] = useState<string | null>(null)

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

  function startPaymentEdit(order: Order) {
    setExpandedOrderId(order.id)
    setEditingPaymentId(order.id)
    setPaymentValue(String(order.amountPaid))
    setPaymentError(null)
    setPaymentSavedId(null)
  }

  async function handlePaymentSubmit(event: React.FormEvent, order: Order) {
    event.preventDefault()
    if (savingPayment) return
    const parsed = Number(paymentValue)
    if (!/^\d+(?:\.\d{1,2})?$/.test(paymentValue.trim()) || !Number.isFinite(parsed) || parsed > order.priceTotal) {
      setPaymentError(`Introduce el total recibido (0 a ${formatMoney(order.priceTotal)}) con hasta dos decimales.`)
      return
    }
    setSavingPayment(true)
    setPaymentError(null)
    try {
      await onUpdateOrderPayment(order, money(parsed))
      setEditingPaymentId(null)
      setPaymentSavedId(order.id)
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'No se pudo actualizar el pago.')
    } finally {
      setSavingPayment(false)
    }
  }

  const openOrders = orders.filter((o) => o.status !== 'cancelled')
  const totals = openOrders.reduce(
    (acc, o) => ({ revenue: acc.revenue + o.priceTotal, profit: acc.profit + o.profit }),
    { revenue: 0, profit: 0 },
  )
  const paid = openOrders.reduce((acc, o) => acc + o.amountPaid, 0)
  const outstanding = totals.revenue - paid

  return (
    <>
      <section className="metric-strip" aria-label="Resumen de todos los pedidos registrados">
        <div className="metric"><span>Pedidos</span><strong>{openOrders.length}</strong></div>
        <div className="metric"><span>Total cotizado</span><strong>{formatMoney(totals.revenue)}</strong></div>
        <div className="metric"><span>Cobrado</span><strong>{formatMoney(paid)}</strong></div>
        <div className="metric"><span>Saldo pendiente</span><strong>{formatMoney(outstanding)}</strong></div>
        <div className="metric"><span>Ganancia estimada</span><strong className={totals.profit >= 0 ? 'profit-positive' : 'profit-negative'}>{formatMoney(totals.profit)}</strong></div>
      </section>
      <p className="small muted metric-note">Totales históricos de pedidos registrados; no corresponden a un período de cobros.</p>

      <div className="quote-workspace">
        <form id="quote-form" className="card quote-form" onSubmit={handleSubmit} noValidate>
          <h3>
            <Calculator size={16} aria-hidden="true" /> Nueva cotización
          </h3>
          <h4>Cliente y pieza</h4>
          <div className="form-grid quote-fields">
            <TextField label="Cliente" value={form.clientName} onChange={(v) => set('clientName', v)} error={errors.clientName} placeholder="Ej. Roberto Gómez" />
            <TextField label="Diseño / pieza" value={form.designName} onChange={(v) => set('designName', v)} error={errors.designName} placeholder="Ej. Lámpara de litofanía" />
          </div>
          <h4>Producción</h4>
          <div className="form-grid quote-fields">
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
            <TextField label="Gramos" type="number" step="0.01" min="0" value={form.grams} onChange={(v) => set('grams', v)} error={errors.grams} placeholder="120" />
            <TextField label="Horas de impresión" type="number" step="0.01" min="0" value={form.printHours} onChange={(v) => set('printHours', v)} error={errors.printHours} placeholder="5" />
          </div>
          <h4>Precio y pago</h4>
          <div className="form-grid quote-fields">
            <TextField label="Mano de obra (USD, opcional)" type="number" step="0.01" min="0" value={form.laborCost} onChange={(v) => set('laborCost', v)} error={errors.laborCost} placeholder="Vacío = sin costo" />
            <TextField label="Precio de venta (USD)" type="number" step="0.01" min="0" value={form.priceTotal} onChange={(v) => set('priceTotal', v)} error={errors.priceTotal} placeholder="25.00" />
            <TextField label="Abono recibido (USD)" type="number" step="0.01" min="0" value={form.amountPaid} onChange={(v) => set('amountPaid', v)} error={errors.amountPaid} placeholder="0.00" />
          </div>

          {(activeMachines.length === 0 || activeMaterials.length === 0) && (
            <p className="small muted" role="status">
              Para guardar un pedido necesitas al menos una impresora y un material activos
              en la pestaña «Máquinas y Materiales».
            </p>
          )}

        </form>

        <aside className="card quote-summary" aria-label="Resumen de la cotización actual">
          <h3>Resumen de esta cotización</h3>
          {draft ? (
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
                <span>Precio de venta</span>
                <span>{form.priceTotal.trim() ? formatMoney(Number(form.priceTotal) || 0) : '—'}</span>
              </div>
              <div className="breakdown-row">
                <span>Ganancia</span>
                <span className={form.priceTotal.trim() ? (draft.profit >= 0 ? 'profit-positive' : 'profit-negative') : ''}>
                  {form.priceTotal.trim() ? formatMoney(draft.profit) : '—'}
                </span>
              </div>
              {form.priceTotal.trim() && draft.marginPct !== null && <p className="small muted">Margen estimado: {draft.marginPct.toFixed(1)}%</p>}
              {form.priceTotal.trim() && <div className="breakdown-row breakdown-total"><span>Saldo pendiente</span><span>{formatMoney(Math.max(0, Number(form.priceTotal) - (Number(form.amountPaid) || 0)))}</span></div>}
            </div>
          ) : (
            <p className="muted">Selecciona la impresora y el material; introduce gramos y horas para ver los costos.</p>
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

          <p className="small muted save-note">{cloudMode ? 'Al guardar el pedido se descuentan del inventario los gramos del material seleccionado.' : 'En este prototipo el pedido se guarda solo en memoria y no descuenta el inventario.'}</p>
          <div className="form-actions">
            <button type="submit" form="quote-form" className="btn" disabled={!draft || saving}>
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
        </aside>
      </div>

      <div className="card">
        <h3>Historial de pedidos</h3>
        <div className="table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente / pieza</th>
                <th className="num">Precio</th>
                <th className="num">Saldo pendiente</th>
                <th>Pago</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={6} className="muted">Aún no hay pedidos registrados.</td></tr>}
              {orders.map((o) => {
                const mach = machines.find((m) => m.id === o.machineId)
                const orderMaterial = materials.find((m) => m.id === o.materialId)
                const expanded = expandedOrderId === o.id
                return (
                  <Fragment key={o.id}>
                  <tr>
                    <td>{o.orderDate}</td>
                    <td className="order-identity"><strong>{o.clientName}</strong><span className="muted">{o.designName}</span></td>
                    <td className="num">{formatMoney(o.priceTotal)}</td>
                    <td className="num">{formatMoney(Math.max(0, o.priceTotal - o.amountPaid))}</td>
                    <td>
                      <PaymentBadge status={paymentStatus(o.priceTotal, o.amountPaid)} />
                    </td>
                    <td className="order-actions">
                      <button className="icon-btn" onClick={() => setExpandedOrderId(expanded ? null : o.id)} aria-expanded={expanded} aria-label={`${expanded ? 'Ocultar' : 'Ver'} detalles del pedido de ${o.clientName}`}>
                        {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                      </button>
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
                  {expanded && <tr className="order-detail-row"><td colSpan={6}>
                    <div className="order-details">
                      <div><span>Impresora</span><strong>{mach?.name ?? '—'}</strong></div>
                      <div><span>Material</span><strong>{orderMaterial?.name ?? '—'}</strong></div>
                      <div><span>Material usado</span><strong>{o.grams} g</strong></div>
                      <div><span>Tiempo</span><strong>{o.printHours} h</strong></div>
                      <div><span>Costo</span><strong>{formatMoney(o.totalCost)}</strong></div>
                      <div><span>Costo de material</span><strong>{formatMoney(o.materialCost)}</strong></div>
                      <div><span>Energía</span><strong>{formatMoney(o.energyCost)}</strong></div>
                      <div><span>Desgaste</span><strong>{formatMoney(o.wearCost)}</strong></div>
                      <div><span>Mano de obra</span><strong>{formatMoney(o.laborCost ?? 0)}</strong></div>
                      <div><span>Cobrado</span><strong>{formatMoney(o.amountPaid)}</strong></div>
                      <div><span>Ganancia estimada</span><strong className={o.profit >= 0 ? 'profit-positive' : 'profit-negative'}>{formatMoney(o.profit)}</strong></div>
                    </div>
                    {o.status !== 'cancelled' && (editingPaymentId === o.id ? (
                      <form className="payment-editor" onSubmit={(event) => void handlePaymentSubmit(event, o)} noValidate>
                        <div className="field">
                          <label htmlFor={`payment-${o.id}`}>Total recibido hasta hoy (USD)</label>
                          <input id={`payment-${o.id}`} type="number" min="0" max={o.priceTotal} step="0.01" value={paymentValue} onChange={(event) => setPaymentValue(event.target.value)} aria-invalid={Boolean(paymentError)} aria-describedby={paymentError ? `payment-error-${o.id}` : undefined} autoFocus />
                        </div>
                        <button type="button" className="btn btn-secondary" onClick={() => { setPaymentValue(String(o.priceTotal)); setPaymentError(null) }}>Usar total del pedido</button>
                        <button type="submit" className="btn" disabled={savingPayment}>{savingPayment ? 'Guardando…' : 'Guardar pago'}</button>
                        <button type="button" className="btn btn-secondary" onClick={() => { setEditingPaymentId(null); setPaymentError(null) }}>Cancelar</button>
                        {paymentError && <span id={`payment-error-${o.id}`} className="error" role="alert">{paymentError}</span>}
                      </form>
                    ) : (
                      <div className="payment-editor-actions"><button type="button" className="btn btn-secondary" onClick={() => startPaymentEdit(o)}>Editar pago</button>{paymentSavedId === o.id && <span className="small profit-positive" role="status">Pago actualizado</span>}</div>
                    ))}
                  </td></tr>}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
