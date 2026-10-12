import { supabase } from './supabase'
import type { Machine, Material } from '../types'

/** Database row shapes (snake_case) mapped to app types (camelCase). */

interface MachineRow {
  id: string
  name: string
  icon: Machine['icon']
  purchase_price: number
  useful_life_hours: number
  residual_value: number
  annual_usage_hours: number
  annual_maintenance_cost: number
  is_active: boolean
}

interface MaterialRow {
  id: string
  name: string
  cost_per_1000g: number
  supply_id: string
  is_active: boolean
}

function toMachine(r: MachineRow): Machine {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    purchasePrice: Number(r.purchase_price),
    usefulLifeHours: Number(r.useful_life_hours),
    residualValue: Number(r.residual_value),
    annualUsageHours: Number(r.annual_usage_hours),
    annualMaintenanceCost: Number(r.annual_maintenance_cost),
    isActive: r.is_active,
  }
}

function toMaterial(r: MaterialRow): Material {
  return {
    id: r.id,
    name: r.name,
    costPer1000g: Number(r.cost_per_1000g),
    supplyId: r.supply_id,
    isActive: r.is_active,
  }
}

export async function fetchMachines(): Promise<Machine[]> {
  const { data, error } = await supabase!
    .from('machines')
    .select('id, name, icon, purchase_price, useful_life_hours, residual_value, annual_usage_hours, annual_maintenance_cost, is_active')
    .order('created_at')
  if (error) throw new Error(`No se pudieron cargar las impresoras: ${error.message}`)
  return (data as MachineRow[]).map(toMachine)
}

export type MachineInput = Omit<Machine, 'id'>

export async function insertMachine(input: MachineInput): Promise<Machine> {
  const { data, error } = await supabase!
    .from('machines')
    .insert({
      name: input.name,
      icon: input.icon,
      purchase_price: input.purchasePrice,
      useful_life_hours: input.usefulLifeHours,
      residual_value: input.residualValue,
      annual_usage_hours: input.annualUsageHours,
      annual_maintenance_cost: input.annualMaintenanceCost,
      is_active: input.isActive,
    })
    .select('id, name, icon, purchase_price, useful_life_hours, residual_value, annual_usage_hours, annual_maintenance_cost, is_active')
    .single()
  if (error) throw new Error(`No se pudo guardar la impresora: ${error.message}`)
  return toMachine(data as MachineRow)
}

export async function updateMachine(id: string, input: MachineInput): Promise<Machine> {
  const { data, error } = await supabase!
    .from('machines')
    .update({
      name: input.name,
      icon: input.icon,
      purchase_price: input.purchasePrice,
      useful_life_hours: input.usefulLifeHours,
      residual_value: input.residualValue,
      annual_usage_hours: input.annualUsageHours,
      annual_maintenance_cost: input.annualMaintenanceCost,
      is_active: input.isActive,
    })
    .eq('id', id)
    .select('id, name, icon, purchase_price, useful_life_hours, residual_value, annual_usage_hours, annual_maintenance_cost, is_active')
    .single()
  if (error) throw new Error(`No se pudo actualizar la impresora: ${error.message}`)
  return toMachine(data as MachineRow)
}

export async function fetchMaterials(): Promise<Material[]> {
  const { data, error } = await supabase!
    .from('materials')
    .select('id, name, cost_per_1000g, supply_id, is_active')
    .order('created_at')
  if (error) throw new Error(`No se pudieron cargar los materiales: ${error.message}`)
  return (data as MaterialRow[]).map(toMaterial)
}

/**
 * Creates a material together with its linked supply row (unit 'g') in one
 * transaction, via the SECURITY DEFINER RPC from migration 0002.
 */
export async function insertMaterial(
  name: string,
  costPer1000g: number,
  minThreshold: number,
): Promise<Material> {
  const { data, error } = await supabase!.rpc('create_material_with_supply', {
    p_name: name,
    p_cost_per_1000g: costPer1000g,
    p_min_threshold: minThreshold,
  })
  if (error) throw new Error(`No se pudo guardar el material: ${error.message}`)
  const created = await fetchMaterials()
  const material = created.find((m) => m.id === data)
  if (!material) throw new Error('Material guardado pero no encontrado')
  return material
}

export async function updateMaterial(id: string, name: string, costPer1000g: number): Promise<Material> {
  const { data, error } = await supabase!
    .from('materials')
    .update({ name, cost_per_1000g: costPer1000g })
    .eq('id', id)
    .select('id, name, cost_per_1000g, supply_id, is_active')
    .single()
  if (error) throw new Error(`No se pudo actualizar el material: ${error.message}`)
  const material = toMaterial(data as MaterialRow)
  // Keep the linked supply's name in sync with its material.
  const { error: supplyError } = await supabase!
    .from('supplies')
    .update({ name })
    .eq('id', material.supplyId)
  if (supplyError) throw new Error(`No se pudo actualizar el insumo: ${supplyError.message}`)
  return material
}

export interface SupplyStock {
  id: string
  name: string
  unit: 'g' | 'm' | 'pcs'
  minThreshold: number
  stockQty: number
}

export async function fetchSuppliesWithStock(): Promise<SupplyStock[]> {
  // Two simple queries merged client-side: the supply_stock view cannot be
  // embedded via PostgREST (no FK relationship to supplies), so we avoid it.
  const [suppliesRes, stockRes] = await Promise.all([
    supabase!.from('supplies').select('id, name, unit, min_threshold').order('created_at'),
    supabase!.from('supply_stock').select('supply_id, stock_qty'),
  ])
  if (suppliesRes.error) {
    throw new Error(`No se pudieron cargar los insumos: ${suppliesRes.error.message}`)
  }
  if (stockRes.error) {
    throw new Error(`No se pudo cargar el stock: ${stockRes.error.message}`)
  }
  const stockBySupply = new Map<string, number>(
    ((stockRes.data ?? []) as { supply_id: string; stock_qty: number }[]).map((r) => [
      r.supply_id,
      Number(r.stock_qty),
    ]),
  )
  return ((suppliesRes.data ?? []) as {
    id: string
    name: string
    unit: 'g' | 'm' | 'pcs'
    min_threshold: number
  }[]).map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    minThreshold: Number(r.min_threshold),
    stockQty: stockBySupply.get(r.id) ?? 0,
  }))
}
