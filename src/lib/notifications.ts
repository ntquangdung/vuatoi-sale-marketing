import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'
import { firestore } from './firebase'
import { deadlineAlert } from '../utils/tasks'
import type { MarketingTask } from '../types'

export const alertKey = (task: MarketingTask, kind: 'soon' | 'late') => `${task.deadlineAt}:${kind}`

// Read state belongs to the Google account and is shared across its devices.
export function watchReadAlerts(uid: string, next: (keys: Record<string, string>) => void, error: () => void) {
  if (!firestore) return () => {}
  return onSnapshot(query(collection(firestore, 'users', uid, 'deadlineReads'), orderBy('readAt', 'desc'), limit(500)), snapshot => {
    next(Object.fromEntries(snapshot.docs.map(item => {
      const data = item.data()
      return [item.id, `${data.deadlineAt.toDate().toISOString()}:${data.kind}`]
    })))
  }, error)
}

export async function markAlertsRead(uid: string, tasks: MarketingTask[], now: number, employeeUid?: string) {
  if (!firestore) return
  const alerts = tasks.map(task => ({ task, kind: deadlineAlert(task, now, employeeUid) })).filter(item => item.kind)
  for (let start = 0; start < alerts.length; start += 450) {
    const batch = writeBatch(firestore)
    for (const { task, kind } of alerts.slice(start, start + 450)) batch.set(doc(firestore, 'users', uid, 'deadlineReads', task.id), {
      kind, deadlineAt: Timestamp.fromDate(new Date(task.deadlineAt)), readAt: serverTimestamp(),
    })
    await batch.commit()
  }
}
