import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/Table'

/** No repeatable-row primitive exists elsewhere in this codebase to reuse - line
 * items are held as client-side-only state until the single Raise Bill submit, unlike
 * e.g. CaseFullDetailsPage's PartiesSection, which persists each row immediately via
 * its own mutation. localId only exists to give React a stable key; it's discarded
 * before the create-bill request is built. */
export interface BillLineItemRow {
  localId: string
  description: string
  amount: string
}

export function emptyLineItem(): BillLineItemRow {
  return { localId: crypto.randomUUID(), description: '', amount: '' }
}

export function sumLineItems(items: BillLineItemRow[]): number {
  return items.reduce((total, item) => total + (Number(item.amount) || 0), 0)
}

export function BillLineItemsTable({
  items,
  onChange,
}: {
  items: BillLineItemRow[]
  onChange: (items: BillLineItemRow[]) => void
}) {
  function updateItem(localId: string, patch: Partial<BillLineItemRow>) {
    onChange(items.map((item) => (item.localId === localId ? { ...item, ...patch } : item)))
  }

  function removeItem(localId: string) {
    onChange(items.filter((item) => item.localId !== localId))
  }

  return (
    <div className="space-y-2">
      <Table>
        <THead>
          <Tr>
            <Th>Description</Th>
            <Th className="w-32">Amount</Th>
            <Th className="w-10" />
          </Tr>
        </THead>
        <TBody>
          {items.map((item) => (
            <Tr key={item.localId}>
              <Td>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(item.localId, { description: e.target.value })}
                  placeholder="Court fee, stamp duty…"
                />
              </Td>
              <Td>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.amount}
                  onChange={(e) => updateItem(item.localId, { amount: e.target.value })}
                  placeholder="0.00"
                />
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() => removeItem(item.localId)}
                  className="grid size-7 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-danger"
                  aria-label="Remove line item"
                >
                  <X className="size-3.5" />
                </button>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, emptyLineItem()])}
        >
          Add line
        </Button>
        <p className="text-sm font-medium text-ink">
          Total: ₹{sumLineItems(items).toFixed(2)}
        </p>
      </div>
    </div>
  )
}
