import type {
  GlobalSettings,
  Machine,
  MaintenanceRecord,
  Material,
  Order,
  Supply,
} from '../types'
import { calculateQuote, money } from '../lib/calc'

export const sampleSettings: GlobalSettings = {
  printerWatts: 150,
  electricityRateKwh: 0.18,
  currency: 'USD',
}

export const sampleMachines: Machine[] = [
  {
    id: 'm-bambu',
    name: 'Bambu Lab H2S (AMS Pro)',
    icon: 'cubes',
    purchasePrice: 3000,
    usefulLifeHours: 4500,
    residualValue: 0,
    annualUsageHours: 1500,
    annualMaintenanceCost: 100,
    isActive: true,
  },
  {
    id: 'm-ender',
    name: 'Ender 3 V2 (Modded)',
    icon: 'print',
    purchasePrice: 280,
    usefulLifeHours: 1400,
    residualValue: 0,
    annualUsageHours: 1400,
    annualMaintenanceCost: 70,
    isActive: true,
  },
]

export const sampleMaterials: Material[] = [
  { id: 'mat-pla-black', name: 'PLA Black', costPer1000g: 22, supplyId: 'sup-pla-black', isActive: true },
  { id: 'mat-pla-white', name: 'PLA White', costPer1000g: 22, supplyId: 'sup-pla-white', isActive: true },
  { id: 'mat-petg', name: 'PETG Transparent', costPer1000g: 28, supplyId: 'sup-petg', isActive: true },
]

export const sampleSupplies: Supply[] = [
  {
    id: 'sup-pla-black',
    name: 'PLA Black',
    unit: 'g',
    minThreshold: 500,
    adjustments: [
      { id: 'sa-1', delta: 1000, reason: 'purchase', createdAt: '2026-09-01' },
      { id: 'sa-2', delta: -210, reason: 'order: Lámpara Litofanía', createdAt: '2026-09-04' },
      { id: 'sa-3', delta: -180, reason: 'order: Organizador de Escritorio', createdAt: '2026-09-22' },
    ],
  },
  {
    id: 'sup-pla-white',
    name: 'PLA White',
    unit: 'g',
    minThreshold: 500,
    adjustments: [
      { id: 'sa-4', delta: 1000, reason: 'purchase', createdAt: '2026-09-01' },
      { id: 'sa-5', delta: -450, reason: 'order: Maqueta Escala 1:100', createdAt: '2026-09-10' },
    ],
  },
  {
    id: 'sup-petg',
    name: 'PETG Transparent',
    unit: 'g',
    minThreshold: 300,
    adjustments: [
      { id: 'sa-6', delta: 500, reason: 'purchase', createdAt: '2026-09-05' },
      { id: 'sa-7', delta: -95, reason: 'order: Carcasa Prototipo IoT', createdAt: '2026-09-26' },
    ],
  },
  {
    id: 'sup-nozzle',
    name: 'Nozzle 0.4mm',
    unit: 'pcs',
    minThreshold: 2,
    adjustments: [
      { id: 'sa-8', delta: 5, reason: 'purchase', createdAt: '2026-08-20' },
      { id: 'sa-9', delta: -1, reason: 'replacement', createdAt: '2026-09-15' },
    ],
  },
]

export const sampleMaintenance: MaintenanceRecord[] = [
  {
    id: 'mt-1',
    machineId: 'm-bambu',
    performedAt: '2026-08-15',
    description: 'Lubricated linear rails, cleaned AMS rollers',
    cost: 12,
    nextDueAt: '2026-11-15',
  },
  {
    id: 'mt-2',
    machineId: 'm-ender',
    performedAt: '2026-07-01',
    description: 'Replaced Bowden tube and nozzle',
    cost: 18,
    nextDueAt: '2026-10-01',
  },
]

/** The owner's real order history, with costs recomputed via the shared formulas. */
function buildSampleOrders(): Order[] {
  const rows = [
    {
      id: 'o-1', machineId: 'm-bambu', materialId: 'mat-pla-white',
      clientName: 'Roberto Gómez', designName: 'Lámpara Litofanía Personalizada',
      orderDate: '2026-09-04', grams: 210, printHours: 9.5, laborCost: null,
      priceTotal: 35, amountPaid: 35, status: 'completed' as const,
    },
    {
      id: 'o-2', machineId: 'm-bambu', materialId: 'mat-pla-white',
      clientName: 'Estudio Arquitectura', designName: 'Maqueta Escala 1:100 Casa',
      orderDate: '2026-09-10', grams: 450, printHours: 18, laborCost: null,
      priceTotal: 90, amountPaid: 45, status: 'open' as const,
    },
    {
      id: 'o-3', machineId: 'm-ender', materialId: 'mat-pla-black',
      clientName: 'María Fernández', designName: 'Organizador de Escritorio',
      orderDate: '2026-09-22', grams: 180, printHours: 7, laborCost: null,
      priceTotal: 25, amountPaid: 12.5, status: 'open' as const,
    },
    {
      id: 'o-4', machineId: 'm-bambu', materialId: 'mat-petg',
      clientName: 'Tech Corp', designName: 'Carcasa Prototipo Sensor IoT',
      orderDate: '2026-09-26', grams: 95, printHours: 4, laborCost: null,
      priceTotal: 28, amountPaid: 0, status: 'open' as const,
    },
  ]

  return rows.map((row) => {
    const machine = sampleMachines.find((m) => m.id === row.machineId)!
    const material = sampleMaterials.find((mt) => mt.id === row.materialId)!
    const breakdown = calculateQuote(machine, material.costPer1000g, sampleSettings, {
      grams: row.grams,
      printHours: row.printHours,
      laborCost: row.laborCost,
      priceTotal: row.priceTotal,
    })
    return {
      ...row,
      materialPricePer1000g: material.costPer1000g,
      materialCost: money(breakdown.materialCost),
      energyCost: money(breakdown.energyCost),
      wearCost: money(breakdown.wearCost),
      totalCost: money(breakdown.totalCost),
      profit: money(breakdown.profit),
    }
  })
}

export const sampleOrders: Order[] = buildSampleOrders()
