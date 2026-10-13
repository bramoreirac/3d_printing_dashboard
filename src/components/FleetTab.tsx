import { useEffect, useState } from 'react'
import { AlertTriangle, Boxes, Pencil, Plus, Printer, Settings, Trash2, Wrench, X } from 'lucide-react'
import type { Machine, MaintenanceRecord, Material, Order, Supply } from '../types'
import { formatMoney } from '../lib/calc'
import { SelectField, TextField } from './fields'
import {
  insertMachine,
  insertMaterial,
  updateMachine,
  updateMaterial,
  type MaintenanceInput,
  type MachineInput,
} from '../lib/db'

interface FleetTabProps {
  machines: Machine[]
  materials: Material[]
  supplies: Supply[]
  maintenance: MaintenanceRecord[]
  orders: Order[]
  cloudMode: boolean
  onMachinesChange: (machines: Machine[]) => void
  onMaterialsChange: (materials: Material[]) => void
  onSaveMaintenance: (input: MaintenanceInput) => Promise<MaintenanceRecord>
  onStockAdjustment: (supplyId: string, delta: number, reason: string) => Promise<void>
  onDeleteMachine: (machineId: string) => Promise<void>
  onDeleteMaintenance: (recordId: string) => Promise<void>
  onDeleteSupply: (supplyId: string) => Promise<void>
}

function stockQty(supply: Supply): number {
  if (supply.stockQtyOverride !== undefined) return supply.stockQtyOverride
  return supply.adjustments.reduce((sum, a) => sum + a.delta, 0)
}

function hoursRegistered(machineId: string, orders: Order[]): number {
  // Cancelled orders still count: the machine time was physically used.
  return orders
    .filter((o) => o.machineId === machineId)
    .reduce((sum, o) => sum + o.printHours, 0)
}

const machineIcons = {
  print: Printer,
  cube: Boxes,
  cubes: Boxes,
  gear: Settings,
} as const

const iconOptions: { value: Machine['icon']; label: string }[] = [
  { value: 'print', label: '🖨️ Impresora' },
  { value: 'cube', label: '🧊 Cubo / Bambu' },
  { value: 'cubes', label: '🧱 Sistema AMS' },
  { value: 'gear', label: '⚙️ Industrial' },
]

interface MachineForm {
  id: string | null
  name: string
  icon: Machine['icon']
  purchasePrice: string
  usefulLifeHours: string
  residualValue: string
  annualUsageHours: string
  annualMaintenanceCost: string
}

const emptyMachineForm: MachineForm = {
  id: null,
  name: '',
  icon: 'print',
  purchasePrice: '',
  usefulLifeHours: '',
  residualValue: '',
  annualUsageHours: '',
  annualMaintenanceCost: '',
}

interface MaterialForm {
  id: string | null
  name: string
  costPer1000g: string
  minThreshold: string
}

const emptyMaterialForm: MaterialForm = { id: null, name: '', costPer1000g: '', minThreshold: '500' }

interface MaintenanceForm {
  machineId: string
  performedAt: string
  description: string
  cost: string
  nextDueAt: string
}

function emptyMaintenanceForm(machines: Machine[]): MaintenanceForm {
  return {
    machineId: machines[0]?.id ?? '',
    performedAt: new Date().toISOString().slice(0, 10),
    description: '',
    cost: '',
    nextDueAt: '',
  }
}

interface AdjustmentForm {
  supplyId: string
  delta: string
  reason: string
}

function emptyAdjustmentForm(supplies: Supply[]): AdjustmentForm {
  return { supplyId: supplies[0]?.id ?? '', delta: '', reason: '' }
}

export function FleetTab({
  machines,
  materials,
  supplies,
  maintenance,
  orders,
  cloudMode,
  onMachinesChange,
  onMaterialsChange,
  onSaveMaintenance,
  onStockAdjustment,
  onDeleteMachine,
  onDeleteMaintenance,
  onDeleteSupply,
}: FleetTabProps) {
  const today = new Date().toISOString().slice(0, 10)

  const [machineForm, setMachineForm] = useState<MachineForm>(emptyMachineForm)
  const [materialForm, setMaterialForm] = useState<MaterialForm>(emptyMaterialForm)
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>(() =>
    emptyMaintenanceForm(machines),
  )
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(() =>
    emptyAdjustmentForm(supplies),
  )
  const [machineErrors, setMachineErrors] = useState<Record<string, string>>({})
  const [materialErrors, setMaterialErrors] = useState<Record<string, string>>({})
  const [maintenanceErrors, setMaintenanceErrors] = useState<Record<string, string>>({})
  const [adjustmentErrors, setAdjustmentErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adjustFlash, setAdjustFlash] = useState(false)
  const [activeForm, setActiveForm] = useState<'machine' | 'material' | 'maintenance' | 'adjustment' | null>(null)
  // Delete failures (e.g. a record still referenced by orders) surface right
  // next to the table where the button lives, not inside the forms below.
  const [deleteError, setDeleteError] = useState<{
    section: 'machines' | 'maintenance' | 'supplies'
    message: string
  } | null>(null)

  // Repair preselections that go stale when data loads asynchronously
  // (sample data → fetched data), same pattern as OrdersTab.
  useEffect(() => {
    setMaintenanceForm((f) =>
      machines.some((m) => m.id === f.machineId)
        ? f
        : { ...f, machineId: machines[0]?.id ?? '' },
    )
    setAdjustmentForm((f) =>
      supplies.some((s) => s.id === f.supplyId) ? f : { ...f, supplyId: supplies[0]?.id ?? '' },
    )
  }, [machines, supplies])

  useEffect(() => {
    if (!activeForm) return
    const form = document.getElementById(`${activeForm}-form`)
    form?.querySelector<HTMLElement>('input, select')?.focus()
  }, [activeForm, machineForm.id, materialForm.id])

  function setMachine<K extends keyof MachineForm>(key: K, value: MachineForm[K]) {
    setMachineForm((f) => ({ ...f, [key]: value }))
  }

  function setMaterial<K extends keyof MaterialForm>(key: K, value: MaterialForm[K]) {
    setMaterialForm((f) => ({ ...f, [key]: value }))
  }

  function openForm(form: 'machine' | 'material' | 'maintenance' | 'adjustment') {
    setFormError(null)
    setActiveForm(form)
    if (form === 'machine') { setMachineForm(emptyMachineForm); setMachineErrors({}) }
    if (form === 'material') { setMaterialForm(emptyMaterialForm); setMaterialErrors({}) }
    if (form === 'maintenance') setMaintenanceErrors({})
    if (form === 'adjustment') setAdjustmentErrors({})
  }

  function validateMachine(): boolean {
    const f = machineForm
    const next: Record<string, string> = {}
    if (!f.name.trim()) next.name = 'Obligatorio'
    const price = parseFloat(f.purchasePrice)
    if (!isFinite(price) || price <= 0) next.purchasePrice = 'Debe ser mayor a 0'
    const life = parseFloat(f.usefulLifeHours)
    if (!isFinite(life) || life <= 0) next.usefulLifeHours = 'Debe ser mayor a 0'
    const residual = parseFloat(f.residualValue || '0')
    if (!isFinite(residual) || residual < 0) next.residualValue = 'Debe ser ≥ 0'
    if (isFinite(residual) && isFinite(price) && residual > price) {
      next.residualValue = 'No puede superar la inversión'
    }
    const annualHours = parseFloat(f.annualUsageHours)
    if (!isFinite(annualHours) || annualHours <= 0) next.annualUsageHours = 'Debe ser mayor a 0'
    const maint = parseFloat(f.annualMaintenanceCost || '0')
    if (!isFinite(maint) || maint < 0) next.annualMaintenanceCost = 'Debe ser ≥ 0'
    setMachineErrors(next)
    return Object.keys(next).length === 0
  }

  function validateMaterial(): boolean {
    const f = materialForm
    const next: Record<string, string> = {}
    if (!f.name.trim()) next.name = 'Obligatorio'
    const cost = parseFloat(f.costPer1000g)
    if (!isFinite(cost) || cost <= 0) next.costPer1000g = 'Debe ser mayor a 0'
    if (!f.id) {
      const threshold = parseFloat(f.minThreshold)
      if (!isFinite(threshold) || threshold < 0) next.minThreshold = 'Debe ser ≥ 0'
    }
    setMaterialErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleMachineSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validateMachine()) return
    const input: MachineInput = {
      name: machineForm.name.trim(),
      icon: machineForm.icon,
      purchasePrice: parseFloat(machineForm.purchasePrice),
      usefulLifeHours: parseFloat(machineForm.usefulLifeHours),
      residualValue: parseFloat(machineForm.residualValue || '0'),
      annualUsageHours: parseFloat(machineForm.annualUsageHours),
      annualMaintenanceCost: parseFloat(machineForm.annualMaintenanceCost || '0'),
      isActive: true,
    }
    setBusy(true)
    try {
      if (cloudMode && machineForm.id) {
        const current = machines.find((m) => m.id === machineForm.id)
        const updated = await updateMachine(machineForm.id, { ...input, isActive: current?.isActive ?? true })
        onMachinesChange(machines.map((m) => (m.id === updated.id ? updated : m)))
      } else if (cloudMode) {
        const created = await insertMachine(input)
        onMachinesChange([...machines, created])
      } else {
        // Prototype mode: local only
        const id = machineForm.id ?? `m-${Date.now()}`
        const current = machines.find((m) => m.id === id)
        const local = { ...input, id, isActive: current?.isActive ?? true }
        onMachinesChange(
          current ? machines.map((m) => (m.id === id ? local : m)) : [...machines, local],
        )
      }
      setMachineForm(emptyMachineForm)
      setActiveForm(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  async function handleMaterialSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validateMaterial()) return
    const name = materialForm.name.trim()
    const cost = parseFloat(materialForm.costPer1000g)
    setBusy(true)
    try {
      if (cloudMode && materialForm.id) {
        const updated = await updateMaterial(materialForm.id, name, cost)
        onMaterialsChange(materials.map((m) => (m.id === updated.id ? updated : m)))
      } else if (cloudMode) {
        const created = await insertMaterial(name, cost, parseFloat(materialForm.minThreshold))
        onMaterialsChange([...materials, created])
      } else {
        // Prototype mode: local only (supply is faked for the low-stock view)
        const id = materialForm.id ?? `mat-${Date.now()}`
        const current = materials.find((m) => m.id === id)
        const local: Material = {
          id,
          name,
          costPer1000g: cost,
          supplyId: current?.supplyId ?? `sup-${Date.now()}`,
          isActive: true,
        }
        onMaterialsChange(
          current ? materials.map((m) => (m.id === id ? local : m)) : [...materials, local],
        )
      }
      setMaterialForm(emptyMaterialForm)
      setActiveForm(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  async function handleMaintenanceSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const f = maintenanceForm
    const next: Record<string, string> = {}
    if (!f.machineId) next.machineId = 'Obligatorio'
    if (!f.performedAt) next.performedAt = 'Obligatorio'
    if (!f.description.trim()) next.description = 'Obligatorio'
    const cost = parseFloat(f.cost || '0')
    if (!isFinite(cost) || cost < 0) next.cost = 'Debe ser ≥ 0'
    setMaintenanceErrors(next)
    if (Object.keys(next).length > 0) return
    setBusy(true)
    try {
      await onSaveMaintenance({
        machineId: f.machineId,
        performedAt: f.performedAt,
        description: f.description.trim(),
        cost,
        nextDueAt: f.nextDueAt || null,
      })
      setMaintenanceForm(emptyMaintenanceForm(machines))
      setActiveForm(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  async function handleAdjustmentSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const f = adjustmentForm
    const next: Record<string, string> = {}
    if (!f.supplyId) next.supplyId = 'Obligatorio'
    const delta = parseFloat(f.delta)
    if (!isFinite(delta) || delta === 0) next.delta = 'Debe ser un número distinto de 0'
    if (!f.reason.trim()) next.reason = 'Obligatorio'
    setAdjustmentErrors(next)
    if (Object.keys(next).length > 0) return
    setBusy(true)
    try {
      await onStockAdjustment(f.supplyId, delta, f.reason.trim())
      setAdjustmentForm(emptyAdjustmentForm(supplies))
      setActiveForm(null)
      setAdjustFlash(true)
      setTimeout(() => setAdjustFlash(false), 2000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setBusy(false)
    }
  }

  function editMachine(m: Machine) {
    setActiveForm('machine')
    setFormError(null)
    setMachineErrors({})
    setMachineForm({
      id: m.id,
      name: m.name,
      icon: m.icon,
      purchasePrice: String(m.purchasePrice),
      usefulLifeHours: String(m.usefulLifeHours),
      residualValue: String(m.residualValue),
      annualUsageHours: String(m.annualUsageHours),
      annualMaintenanceCost: String(m.annualMaintenanceCost),
    })
  }

  function editMaterial(m: Material) {
    setActiveForm('material')
    setFormError(null)
    setMaterialErrors({})
    setMaterialForm({ id: m.id, name: m.name, costPer1000g: String(m.costPer1000g), minThreshold: '' })
  }

  async function runDelete(
    section: 'machines' | 'maintenance' | 'supplies',
    action: () => Promise<void>,
  ) {
    setDeleteError(null)
    try {
      await action()
    } catch (err) {
      setDeleteError({ section, message: err instanceof Error ? err.message : 'Error desconocido' })
    }
  }

  function confirmDeleteMachine(m: Machine) {
    if (
      !window.confirm(
        `¿Eliminar la impresora "${m.name}"? También se eliminarán sus registros de mantenimiento.`,
      )
    )
      return
    void runDelete('machines', () => onDeleteMachine(m.id))
  }

  function confirmDeleteMaintenance(r: MaintenanceRecord) {
    const machine = machines.find((m) => m.id === r.machineId)
    if (!window.confirm(`¿Eliminar el mantenimiento del ${machine?.name ?? 'equipo'} (${r.performedAt})?`))
      return
    void runDelete('maintenance', () => onDeleteMaintenance(r.id))
  }

  function confirmDeleteSupply(s: Supply) {
    if (
      !window.confirm(
        `¿Eliminar el insumo "${s.name}"? También se eliminarán su material vinculado y sus movimientos de stock.`,
      )
    )
      return
    void runDelete('supplies', () => onDeleteSupply(s.id))
  }

  return (
    <>
      <div className="card">
        <div className="section-heading"><h3><Settings size={16} aria-hidden="true" /> Flota y tarifas por hora</h3>
          <button type="button" className="btn btn-secondary" onClick={() => openForm('machine')} aria-expanded={activeForm === 'machine'}><Plus size={16} aria-hidden="true" /> Agregar impresora</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Impresora</th>
                <th className="num">Inversión</th>
                <th className="num">Vida útil (h)</th>
                <th className="num">Amort./h</th>
                <th className="num">Mant./h</th>
                <th className="num">Tarifa desgaste</th>
                <th className="num">Horas usadas</th>
                <th>Estado</th>
                <th></th>
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
                        {m.isActive ? 'Activa' : 'Retirada'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        onClick={() => editMachine(m)}
                        aria-label={`Editar ${m.name}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => confirmDeleteMachine(m)}
                        title="Eliminar impresora"
                        aria-label={`Eliminar ${m.name}`}
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
        {deleteError?.section === 'machines' && (
          <span className="error" role="alert" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
            {deleteError.message}
          </span>
        )}
        <p className="small muted" style={{ marginTop: 'var(--space-2)' }}>
          El valor residual se resta a la inversión antes de amortizar.
        </p>
      </div>

      {(activeForm === 'machine' || activeForm === 'material') && <div className="fleet-form-area">
        {activeForm === 'machine' && <form id="machine-form" className="card" onSubmit={handleMachineSubmit} noValidate>
          <h3>
            {machineForm.id ? (
              <>
                <Pencil size={16} aria-hidden="true" /> Editar impresora
              </>
            ) : (
              <>
                <Plus size={16} aria-hidden="true" /> Agregar impresora
              </>
            )}
          </h3>
          <div className="form-grid">
            <TextField label="Nombre / modelo" value={machineForm.name} onChange={(v) => setMachine('name', v)} error={machineErrors.name} placeholder="Ej. Bambu Lab H2S" />
            <SelectField label="Ícono" value={machineForm.icon} onChange={(v) => setMachine('icon', v)} options={iconOptions} />
            <TextField label="Inversión (USD)" type="number" step="0.01" min="0" value={machineForm.purchasePrice} onChange={(v) => setMachine('purchasePrice', v)} error={machineErrors.purchasePrice} placeholder="3000" />
            <TextField label="Vida útil (horas)" type="number" step="0.01" min="0" value={machineForm.usefulLifeHours} onChange={(v) => setMachine('usefulLifeHours', v)} error={machineErrors.usefulLifeHours} placeholder="4500" />
            <TextField label="Valor residual (USD)" type="number" step="0.01" min="0" value={machineForm.residualValue} onChange={(v) => setMachine('residualValue', v)} error={machineErrors.residualValue} placeholder="0" />
            <TextField label="Uso anual (horas)" type="number" step="0.01" min="0" value={machineForm.annualUsageHours} onChange={(v) => setMachine('annualUsageHours', v)} error={machineErrors.annualUsageHours} placeholder="1500" />
            <TextField label="Mantenimiento anual (USD)" type="number" step="0.01" min="0" value={machineForm.annualMaintenanceCost} onChange={(v) => setMachine('annualMaintenanceCost', v)} error={machineErrors.annualMaintenanceCost} placeholder="100" />
          </div>
          {formError && (
            <span className="error" role="alert" style={{ display: 'block', marginTop: 'var(--space-3)' }}>
              {formError}
            </span>
          )}
          <div className="form-actions">
            <button type="submit" className="btn" disabled={busy}>
              <Plus size={16} aria-hidden="true" /> {machineForm.id ? 'Guardar cambios' : 'Agregar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveForm(null)}><X size={16} aria-hidden="true" /> Cancelar</button>
          </div>
        </form>}

        {activeForm === 'material' && <form id="material-form" className="card" onSubmit={handleMaterialSubmit} noValidate>
          <h3>
            {materialForm.id ? (
              <>
                <Pencil size={16} aria-hidden="true" /> Editar material
              </>
            ) : (
              <>
                <Plus size={16} aria-hidden="true" /> Agregar material
              </>
            )}
          </h3>
          <div className="form-grid">
            <TextField label="Nombre" value={materialForm.name} onChange={(v) => setMaterial('name', v)} error={materialErrors.name} placeholder="Ej. PLA Negro" />
            <TextField label="Precio por 1000g (USD)" type="number" step="0.01" min="0" value={materialForm.costPer1000g} onChange={(v) => setMaterial('costPer1000g', v)} error={materialErrors.costPer1000g} placeholder="22.00" />
            {!materialForm.id && (
              <TextField label="Alerta de stock bajo (g)" type="number" step="0.01" min="0" value={materialForm.minThreshold} onChange={(v) => setMaterial('minThreshold', v)} error={materialErrors.minThreshold} placeholder="500" />
            )}
          </div>
          <p className="small muted">
            Al agregar un material se crea también su insumo para llevar las existencias.
          </p>
          {formError && (
            <span className="error" role="alert" style={{ display: 'block', marginTop: 'var(--space-3)' }}>
              {formError}
            </span>
          )}
          <div className="form-actions">
            <button type="submit" className="btn" disabled={busy}>
              <Plus size={16} aria-hidden="true" /> {materialForm.id ? 'Guardar cambios' : 'Agregar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveForm(null)}><X size={16} aria-hidden="true" /> Cancelar</button>
          </div>
        </form>}
      </div>}

      <div className="fleet-sections">
        <div className="card">
          <div className="section-heading"><h3><Wrench size={16} aria-hidden="true" /> Mantenimiento</h3>
            <button type="button" className="btn btn-secondary" onClick={() => openForm('maintenance')} aria-expanded={activeForm === 'maintenance'}><Plus size={16} aria-hidden="true" /> Registrar mantenimiento</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Impresora</th>
                  <th>Realizado</th>
                  <th>Descripción</th>
                  <th className="num">Costo</th>
                  <th>Próximo vencimiento</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {maintenance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Sin registros todavía.
                    </td>
                  </tr>
                )}
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
                            <AlertTriangle size={11} aria-hidden="true" /> Vencido desde {r.nextDueAt}
                          </span>
                        ) : (
                          <span className="badge badge-ok">Vence {r.nextDueAt}</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={() => confirmDeleteMaintenance(r)}
                          title="Eliminar registro"
                          aria-label={`Eliminar mantenimiento del ${machine?.name ?? 'equipo'} del ${r.performedAt}`}
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
          {deleteError?.section === 'maintenance' && (
            <span className="error" role="alert" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
              {deleteError.message}
            </span>
          )}
          {activeForm === 'maintenance' && <form id="maintenance-form" onSubmit={handleMaintenanceSubmit} noValidate className="inline-entry-form">
            <h3>
              <Plus size={16} aria-hidden="true" /> Registrar mantenimiento
            </h3>
            <div className="form-grid">
              <SelectField
                label="Impresora"
                value={maintenanceForm.machineId}
                onChange={(v) => setMaintenanceForm((f) => ({ ...f, machineId: v }))}
                options={machines.map((m) => ({ value: m.id, label: m.name }))}
                error={maintenanceErrors.machineId}
              />
              <TextField
                label="Fecha realizada"
                type="date"
                value={maintenanceForm.performedAt}
                onChange={(v) => setMaintenanceForm((f) => ({ ...f, performedAt: v }))}
                error={maintenanceErrors.performedAt}
              />
              <TextField
                label="Descripción"
                value={maintenanceForm.description}
                onChange={(v) => setMaintenanceForm((f) => ({ ...f, description: v }))}
                error={maintenanceErrors.description}
                placeholder="Ej. Cambio de boquilla"
              />
              <TextField
                label="Costo (USD)"
                type="number"
                step="0.01"
                min="0"
                value={maintenanceForm.cost}
                onChange={(v) => setMaintenanceForm((f) => ({ ...f, cost: v }))}
                error={maintenanceErrors.cost}
                placeholder="0"
              />
              <TextField
                label="Próximo vencimiento (opcional)"
                type="date"
                value={maintenanceForm.nextDueAt}
                onChange={(v) => setMaintenanceForm((f) => ({ ...f, nextDueAt: v }))}
              />
            </div>
            {formError && (
              <span className="error" role="alert" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                {formError}
              </span>
            )}
            <div className="form-actions">
              <button type="submit" className="btn" disabled={busy}>
                <Plus size={16} aria-hidden="true" /> Registrar
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveForm(null)}><X size={16} aria-hidden="true" /> Cancelar</button>
            </div>
          </form>}
        </div>

        <div className="card">
          <div className="section-heading"><h3><Boxes size={16} aria-hidden="true" /> Insumos y existencias</h3>
            <button type="button" className="btn btn-secondary" onClick={() => openForm('material')} aria-expanded={activeForm === 'material'}><Plus size={16} aria-hidden="true" /> Agregar material</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th className="num">En existencia</th>
                  <th className="num">Mínimo</th>
                  <th>Estado</th>
                  <th></th>
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
                          <>
                            <span className="muted small"> · {formatMoney(material.costPer1000g)}/kg</span>{' '}
                            <button
                              className="icon-btn"
                              onClick={() => editMaterial(material)}
                              aria-label={`Editar ${material.name}`}
                            >
                              <Pencil size={12} aria-hidden="true" />
                            </button>
                          </>
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
                            <AlertTriangle size={11} aria-hidden="true" /> Stock bajo
                          </span>
                        ) : (
                          <span className="badge badge-ok">OK</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={() => confirmDeleteSupply(s)}
                          title="Eliminar insumo"
                          aria-label={`Eliminar ${s.name}`}
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
          {deleteError?.section === 'supplies' && (
            <span className="error" role="alert" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
              {deleteError.message}
            </span>
          )}
          <p className="small muted" style={{ marginTop: 'var(--space-2)' }}>
            El stock es la suma de los ajustes. Al guardar un pedido se descuentan
            automáticamente los gramos del insumo vinculado al material.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => openForm('adjustment')} aria-expanded={activeForm === 'adjustment'}><Plus size={16} aria-hidden="true" /> Registrar movimiento</button>
          {adjustFlash && <span className="small profit-positive" role="status">Movimiento registrado</span>}
          {activeForm === 'adjustment' && <form id="adjustment-form" onSubmit={handleAdjustmentSubmit} noValidate className="inline-entry-form">
            <h3>
              <Plus size={16} aria-hidden="true" /> Registrar movimiento
            </h3>
            <div className="form-grid">
              <SelectField
                label="Insumo"
                value={adjustmentForm.supplyId}
                onChange={(v) => setAdjustmentForm((f) => ({ ...f, supplyId: v }))}
                options={supplies.map((s) => ({ value: s.id, label: s.name }))}
                error={adjustmentErrors.supplyId}
              />
              <TextField
                label="Cantidad (+ suma, − resta)"
                type="number"
                step="0.01"
                value={adjustmentForm.delta}
                onChange={(v) => setAdjustmentForm((f) => ({ ...f, delta: v }))}
                error={adjustmentErrors.delta}
                placeholder="Ej. 1000 o -50"
              />
              <TextField
                label="Motivo"
                value={adjustmentForm.reason}
                onChange={(v) => setAdjustmentForm((f) => ({ ...f, reason: v }))}
                error={adjustmentErrors.reason}
                placeholder="Ej. Compra de rollo"
              />
            </div>
            {formError && (
              <span className="error" role="alert" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                {formError}
              </span>
            )}
            <div className="form-actions">
              <button type="submit" className="btn" disabled={busy}>
                <Plus size={16} aria-hidden="true" /> Registrar movimiento
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveForm(null)}><X size={16} aria-hidden="true" /> Cancelar</button>
            </div>
          </form>}
        </div>
      </div>
    </>
  )
}
