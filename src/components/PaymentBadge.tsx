import type { PaymentStatus } from '../types'

const styles: Record<PaymentStatus, string> = {
  Pagado: 'badge badge-paid',
  'Pago Parcial': 'badge badge-partial',
  Pendiente: 'badge badge-pending',
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={styles[status]}>{status}</span>
}
