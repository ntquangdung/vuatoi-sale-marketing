import { useState } from 'react'
import { ArrowUpRight, CheckCheck, CheckCircle2, ClipboardList, Clock3, Search } from 'lucide-react'
import { formatDateTime, monthLabel } from '../lib/date'
import { typeLabel } from '../lib/labels'
import { employeeState, employeeStateLabel, employeeTaskPool, employeeUrgency, needsEmployeeAction } from '../utils/employeeTasks'
import { remainingLabel } from '../utils/tasks'
import type { MarketingTask, UserProfile } from '../types'
import { Empty, Loading } from './TaskUi'

type View = 'work' | 'submitted' | 'done' | 'month'
const roleName = { content: 'Content', media: 'Media', other: 'Phần việc khác' }
export function EmployeeTasks({ tasks, activeTasks, user, month, now, loading, activeLoading, openTask }: {
  tasks: MarketingTask[]; activeTasks: MarketingTask[]; user: UserProfile; month: string; now: number; loading: boolean; activeLoading: boolean; openTask: (task: MarketingTask) => void
}) {
  const [view, setView] = useState<View>('work')
  const [search, setSearch] = useState(''), [role, setRole] = useState(''), [urgentOnly, setUrgentOnly] = useState(false)
  const pool = employeeTaskPool(activeTasks, tasks, user.uid)
  const monthTasks = pool.filter(task => task.periodKey === month)
  const work = pool.filter(task => needsEmployeeAction(task, user.uid))
  const submitted = pool.filter(task => employeeState(task, user.uid) === 'submitted')
  const done = monthTasks.filter(task => task.status === 'done')
  const urgent = work.filter(task => employeeUrgency(task, user.uid, now))
  const source = view === 'work' ? work : view === 'submitted' ? submitted : view === 'done' ? done : monthTasks
  const filtered = source.filter(task => {
    const text = [task.sku, task.title, task.contentInfo.pageName, task.description].join(' ').toLocaleLowerCase('vi')
    return (!search || text.includes(search.toLocaleLowerCase('vi'))) && (!role || task.assignments[user.uid]?.workRole === role) && (!urgentOnly || employeeUrgency(task, user.uid, now))
  })
  const busy = view === 'work' || view === 'submitted' ? activeLoading || loading : loading
  const tabs: { id: View; label: string; count: number }[] = [{ id: 'work', label: 'Cần làm', count: work.length }, { id: 'submitted', label: 'Đã nộp', count: submitted.length }, { id: 'done', label: 'Hoàn thành', count: done.length }, { id: 'month', label: 'Tất cả trong tháng', count: monthTasks.length }]
  return <div className="employee-workspace">
    <div className="employee-overview">
      {[{ label: 'Cần thực hiện', count: work.length, icon: ClipboardList, tone: 'blue', view: 'work' as View, urgent: false, note: 'Tất cả công việc đang mở' }, { label: 'Cần chú ý', count: urgent.length, icon: Clock3, tone: 'orange', view: 'work' as View, urgent: true, note: 'Sắp đến hạn hoặc đã trễ' }, { label: 'Đã nộp phần việc', count: submitted.length, icon: CheckCheck, tone: 'indigo', view: 'submitted' as View, urgent: false, note: 'Theo dõi phản hồi của quản lý' }, { label: 'Đã hoàn thành', count: done.length, icon: CheckCircle2, tone: 'green', view: 'done' as View, urgent: false, note: monthLabel(month) }].map(item => <button key={item.label} className={`employee-stat ${item.tone}`} onClick={() => { setView(item.view); setUrgentOnly(item.urgent); setSearch(''); setRole('') }}><span className="employee-stat-icon"><item.icon size={19} /></span><div><span>{item.label}</span><strong>{loading || activeLoading ? '—' : item.count}</strong><small>{item.note}</small></div></button>)}
    </div>
    <section className="panel employee-task-panel" aria-label="Danh sách công việc cá nhân">
      <div className="employee-tabs" role="tablist" aria-label="Nhóm công việc">{tabs.map(tab => <button role="tab" aria-selected={view === tab.id} aria-controls="employee-task-list" id={`employee-tab-${tab.id}`} key={tab.id} onClick={() => { setView(tab.id); setUrgentOnly(false) }}>{tab.label}<span>{tab.count}</span></button>)}</div>
      <div className="employee-filters"><div className="search-box"><Search size={17} /><input aria-label="Tìm công việc của tôi" placeholder="Tìm SKU, caption hoặc Page…" value={search} onChange={event => setSearch(event.target.value)} /></div><select aria-label="Lọc phần việc của tôi" value={role} onChange={event => setRole(event.target.value)}><option value="">Tất cả phần việc</option><option value="content">Content</option><option value="media">Media</option><option value="other">Phần việc khác</option></select>{view === 'work' && <label className="filter-check"><input type="checkbox" checked={urgentOnly} onChange={event => setUrgentOnly(event.target.checked)} />Sắp hạn / quá hạn</label>}</div>
      <div id="employee-task-list" role="tabpanel" aria-labelledby={`employee-tab-${view}`}>
        {busy ? <Loading /> : filtered.length ? <div className="employee-table-wrap"><table className="employee-table"><thead><tr><th scope="col">Công việc</th><th scope="col">Phần việc của tôi</th><th scope="col">Trạng thái của tôi</th><th scope="col">Deadline</th><th scope="col"><span className="sr-only">Mở công việc</span></th></tr></thead><tbody>{filtered.map(task => {
          const state = employeeState(task, user.uid)!, urgency = employeeUrgency(task, user.uid, now), ownRole = task.assignments[user.uid]?.workRole || 'other'
          return <tr key={task.id} className={urgency ? `employee-row-${urgency}` : ''}>
            <td className="employee-task-name"><span className="employee-task-sku">{task.sku || 'Chưa có SKU'}</span><button onClick={() => openTask(task)}>{task.title}</button><small>{task.contentInfo.pageName || 'Chưa có Page'}<span>·</span>{typeLabel[task.taskType]}</small></td>
            <td className="employee-role-cell"><span className={`employee-role ${ownRole}`}>{roleName[ownRole]}</span></td>
            <td className="employee-state-cell"><span className={`employee-state ${state}`}><i />{employeeStateLabel[state]}</span></td>
            <td className="employee-deadline-cell"><time dateTime={task.deadlineAt}>{formatDateTime(task.deadlineAt)}</time><small className={urgency ? `employee-urgency-${urgency}` : ''}>{needsEmployeeAction(task, user.uid) ? remainingLabel(task, now) : state === 'submitted' ? 'Phần việc đã nộp' : state === 'done' ? 'Đã hoàn thành' : 'Đã hủy'}</small></td>
            <td className="employee-open-cell"><button className={`button ${needsEmployeeAction(task, user.uid) ? 'primary' : 'soft'}`} aria-label={`${needsEmployeeAction(task, user.uid) ? 'Cập nhật' : 'Xem'} ${task.sku || task.title}`} onClick={() => openTask(task)}>{needsEmployeeAction(task, user.uid) ? 'Cập nhật' : 'Xem kết quả'}<ArrowUpRight size={15} /></button></td>
          </tr>
        })}</tbody></table></div> : <Empty title={view === 'work' && !search && !role && !urgentOnly ? 'Bạn đã xử lý hết phần việc hiện tại' : 'Chưa có công việc phù hợp'} text={view === 'work' ? 'Công việc mới được giao sẽ tự xuất hiện tại đây.' : 'Đổi bộ lọc hoặc tháng để xem các công việc khác.'} />}
      </div>
      <div className="employee-list-footer"><span>{filtered.length} công việc{view === 'done' || view === 'month' ? ` · ${monthLabel(month)}` : ' · Mọi tháng'}</span><span>Sắp xếp theo deadline gần nhất</span></div>
    </section>
  </div>
}
