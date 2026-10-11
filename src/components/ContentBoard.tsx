import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Columns3, Copy, ExternalLink, Hash, Link2, Pencil, Plus, Search, Table2, Trash2 } from 'lucide-react'
import { api } from '../lib/data'
import { formatDate } from '../lib/date'
import { QuickContentRow } from './QuickContentRow'
import { BoardEditor } from './BoardEditor'
import { PublicationEditor } from './PublicationEditor'
import { DuplicateTasks } from './DuplicateTasks'
import { SkuEditor } from './SkuEditor'
import { Badge, Deadline, Empty, Loading, Modal } from './TaskUi'
import { contentTitles, reviewLabels, sourceLabels, stageMembers, stageState } from '../utils/content'
import { deadlineState } from '../utils/tasks'
import type { ContentInfo, MarketingTask, ReviewStage, SourceStatus, UserProfile } from '../types'

const columns = [
  ['page','Tên Page',175],['content','Content',145],['video','Loại video',160],['age','Độ tuổi',150],['campaign','Chiến dịch / Sản phẩm',185],
  ['title','Caption',310],['script','Link kịch bản',190],['scriptReview','Trạng thái kịch bản',160],['source','SOURCE',145],['sourceLink','Link source',190],
  ['media','Media',145],['mediaLink','Link media',190],['reviewer','Kiểm duyệt media',150],['mediaReview','Trạng thái media',160],['publication','Đăng Page chính',170],
  ['publishDate','Ngày đăng',140],['postUrl','Link bài đăng',180],['deadline','Deadline',180],['status','Công việc',160],
] as const
type Column = typeof columns[number][0]
type Action = (fn: () => Promise<unknown>, message: string) => Promise<void>

function InlineText({value,label,url=false,disabled,save}:{value:string;label:string;url?:boolean;disabled:boolean;save:(value:string)=>Promise<void>}) {
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState(value),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const inFlight=useRef(false)
  async function commit() {
    if(inFlight.current) return
    if(draft.trim()===value) {setEditing(false);return}
    inFlight.current=true;setBusy(true);setError('')
    try {await save(draft.trim());setEditing(false)} catch(e) {setError((e as Error).message)} finally {setBusy(false);inFlight.current=false}
  }
  return editing ? <div className="grid-cell-editor"><input autoFocus aria-label={label} type={url?'url':'text'} maxLength={url?2000:180} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} onBlur={()=>void commit()} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}if(e.key==='Escape'&&!busy){e.preventDefault();setEditing(false);setError('')}}}/>{error&&<small role="alert">{error}</small>}</div> : <div className="grid-editable"><button disabled={disabled} title={value || `Nhấp để nhập ${label}`} className={!value?'grid-placeholder':''} onClick={()=>{setDraft(value);setError('');setEditing(true)}}>{value || 'Chưa nhập'}</button>{url&&value&&<a href={value} target="_blank" rel="noopener noreferrer" aria-label={`Mở ${label}`}><ExternalLink size={13}/></a>}</div>
}
function People({task,stage}:{task:MarketingTask;stage:ReviewStage}) {
  const members=stageMembers(task,stage)
  return members.length ? <div className="grid-chips">{members.map(uid=><span className={`grid-chip ${stage}`} key={uid}>{task.assignments[uid].fullName}</span>)}</div> : <span className="grid-placeholder">—</span>
}
function ResultLinks({task,stage}:{task:MarketingTask;stage:ReviewStage|'source'}) {
  const key = stage === 'script' ? 'scriptUrl' : stage === 'source' ? 'sourceUrl' : 'mediaUrl'
  const members=(stage==='source'?task.assigneeUids:stageMembers(task,stage)).filter(uid=>task.contributions[uid]?.[key])
  if (!members.length && stage==='source' && task.contentInfo.sourceUrl) return <a href={task.contentInfo.sourceUrl} target="_blank" rel="noopener noreferrer">Mở source<ExternalLink size={11}/></a>
  return members.length ? <div className="grid-links">{members.map(uid=>{const url=task.contributions[uid][key];return <a key={uid} href={url} target="_blank" rel="noopener noreferrer" title={url}><Link2 size={13}/>{members.length>1?task.assignments[uid].fullName:url.replace(/^https?:\/\//,'')}<ExternalLink size={11}/></a>})}</div> : <span className="grid-placeholder">{stage==='script'?'Content chưa điền':'Nhân viên chưa điền'}</span>
}
function ReviewCell({task,stage,busy,review}:{task:MarketingTask;stage:ReviewStage;busy:boolean;review:(status:'approved'|'needs_revision')=>void}) {
  const state=stageState(task,stage),disabled=busy||state==='not_applicable'
  return <select aria-label={`Duyệt ${stage==='script'?'kịch bản':'media'} ${task.sku}`} className={`grid-status grid-status-${state}`} value={state} disabled={disabled} onChange={e=>review(e.target.value as 'approved'|'needs_revision')}>
    <option value={state}>{reviewLabels[state]}</option>{state!=='approved'&&<option value="approved">Đã duyệt</option>}{state!=='needs_revision'&&<option value="needs_revision">Yêu cầu sửa</option>}
  </select>
}
export function ContentBoard({month,tasks,users,onCreated,user,now,loading,openTask,requestDelete,action}: {month:string;tasks:MarketingTask[];users:UserProfile[];onCreated:(periodKey:string)=>void;user:UserProfile;now:number;loading:boolean;openTask:(task:MarketingTask)=>void;requestDelete:(tasks:MarketingTask[])=>void;action:Action}) {
  const [allMonths,setAllMonths]=useState(false),[allTasks,setAllTasks]=useState<MarketingTask[]>([]),[allLoading,setAllLoading]=useState(false)
  const [adding,setAdding]=useState(false)
  const [resetting,setResetting]=useState(false),[resetBusy,setResetBusy]=useState(false)
  const [duplicating,setDuplicating]=useState(false)
  const [skuTask,setSkuTask]=useState<MarketingTask|null>(null)
  const [selectedIds,setSelectedIds]=useState<string[]>([])
  const [search,setSearch]=useState(''),[page,setPage]=useState(''),[video,setVideo]=useState(''),[filter,setFilter]=useState(''),[desc,setDesc]=useState(false)
  const [chooser,setChooser]=useState(false),[hidden,setHidden]=useState<string[]>([]),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('')
  const [infoTask,setInfoTask]=useState<MarketingTask|null>(null),[publicationTask,setPublicationTask]=useState<MarketingTask|null>(null)
  const [skuRetry,setSkuRetry]=useState(0),assigning=useRef(new Set<string>())
  const preferenceKey=`mkt-board-columns:${user.uid}`
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(preferenceKey)||'[]');setHidden(Array.isArray(saved)?saved.filter((key:unknown)=>columns.some(c=>c[0]===key)):[])}catch{setHidden([])}},[preferenceKey])
  useEffect(()=>{
    if(!allMonths) return
    setAllLoading(true)
    return api.watchContentTasks(user,values=>{setAllTasks(values);setAllLoading(false)},e=>{setError(e.message);setAllTasks([]);setAllLoading(false)})
  },[allMonths,user])
  const records=allMonths?allTasks:tasks
  useEffect(()=>setSelectedIds(current=>current.filter(id=>records.some(task=>task.id===id))),[records])
  useEffect(()=>setSelectedIds([]),[search,page,video,filter,allMonths])
  useEffect(()=>{
    const missing=records.filter(t=>!t.sku&&!assigning.current.has(t.id)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(t=>t.id)
    if(!missing.length) return
    missing.forEach(id=>assigning.current.add(id))
    void api.ensureSkus(missing).catch(e=>setError('Chưa cấp được SKU: '+e.message)).finally(()=>missing.forEach(id=>assigning.current.delete(id)))
  },[records,skuRetry])
  const pages=[...new Set(records.map(t=>t.contentInfo.pageName).filter(Boolean))].sort(),videos=[...new Set(records.map(t=>t.contentInfo.videoType).filter(Boolean))].sort()
  const filtered=useMemo(()=>records.filter(t=>{
    const text=[t.sku,t.title,contentTitles(t),t.contentInfo.pageName,t.contentInfo.campaign,...Object.values(t.assignments).map(a=>a.fullName)].join(' ').toLocaleLowerCase('vi')
    return (!search||text.includes(search.toLocaleLowerCase('vi'))) && (!page||t.contentInfo.pageName===page) && (!video||t.contentInfo.videoType===video)
      && (!filter || (filter==='script'?stageState(t,'script')==='pending':filter==='media'?stageState(t,'media')==='pending':filter==='published'?t.publicationStatus==='published':filter==='unpublished'?t.requiresPublishing&&t.publicationStatus!=='published':deadlineState(t,now)==='late'))
  }).sort((a,b)=>((a.sku&&b.sku?a.sku.localeCompare(b.sku,'vi',{numeric:true,sensitivity:'base'}):a.sku?-1:b.sku?1:0)||a.createdAt.localeCompare(b.createdAt))*(desc?-1:1)),[records,search,page,video,filter,now,desc])
  async function update(task:MarketingTask,changes:Partial<ContentInfo>) {await action(()=>api.updateContentInfo(task.id,changes),'Đã lưu thông tin nội dung.')}
  async function review(task:MarketingTask,stage:ReviewStage,status:'approved'|'needs_revision') {
    setBusy(task.id);setError('')
    try{await action(()=>api.reviewStage(task.id,stage,status),status==='approved'?'Đã duyệt kết quả.':'Đã yêu cầu chỉnh sửa phần việc này.')}catch(e){setError((e as Error).message)}finally{setBusy(null)}
  }
  function cell(task:MarketingTask,column:Column):ReactNode {
    const disabled=false,info=task.contentInfo
    const text=(key:'pageName'|'videoType'|'campaign')=><InlineText value={info[key]} label={`${columns.find(c=>c[0]===column)?.[1]} ${task.sku}`} disabled={disabled} save={value=>update(task,{[key]:value})}/>
    switch(column) {
      case 'page':return text('pageName')
      case 'content':return <button className="grid-age-button" title="Sửa người làm và kết quả" onClick={()=>setInfoTask(task)}><People task={task} stage="script"/></button>
      case 'video':return text('videoType')
      case 'age':return <button className="grid-age-button" disabled={disabled} onClick={()=>setInfoTask(task)}>{info.ageGroups.length?<span className="grid-chips">{info.ageGroups.map(age=><span className="grid-chip age" key={age}>{age}</span>)}</span>:<span className="grid-placeholder">Chọn độ tuổi</span>}</button>
      case 'campaign':return text('campaign')
      case 'title':return <div className="grid-title"><InlineText value={task.title} label={`Caption ${task.sku}`} disabled={disabled} save={title=>action(()=>api.renameTask(task.id,title),'Đã lưu caption.')}/>{contentTitles(task)!==task.title&&<small title={contentTitles(task)}>{contentTitles(task)}</small>}</div>
      case 'script':return <div className="grid-link-edit"><ResultLinks task={task} stage="script"/><button className="icon-button" aria-label="Sửa link script ${task.sku}" onClick={()=>setInfoTask(task)}><Pencil size={12}/></button></div>
      case 'scriptReview':return <ReviewCell task={task} stage="script" busy={busy===task.id} review={status=>void review(task,'script',status)}/>
      case 'source':return <select aria-label={`Trạng thái source ${task.sku}`} className={`grid-status grid-source-${info.sourceStatus}`} value={info.sourceStatus} disabled={disabled||busy===task.id} onChange={async e=>{setBusy(task.id);try{await update(task,{sourceStatus:e.target.value as SourceStatus})}catch(e){setError((e as Error).message)}finally{setBusy(null)}}}>{Object.entries(sourceLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
      case 'sourceLink':return <div className="grid-link-edit"><ResultLinks task={task} stage="source"/><button className="icon-button" aria-label="Sửa link source ${task.sku}" onClick={()=>setInfoTask(task)}><Pencil size={12}/></button></div>
      case 'media':return <button className="grid-age-button" title="Sửa người làm và kết quả" onClick={()=>setInfoTask(task)}><People task={task} stage="media"/></button>
      case 'mediaLink':return <div className="grid-link-edit"><ResultLinks task={task} stage="media"/><button className="icon-button" aria-label="Sửa link media ${task.sku}" onClick={()=>setInfoTask(task)}><Pencil size={12}/></button></div>
      case 'reviewer':return <button className="grid-age-button" onClick={()=>setInfoTask(task)}>{task.mediaReview.byName?<span className="grid-chip reviewer">{task.mediaReview.byName}</span>:<span className="grid-placeholder">Chọn người duyệt</span>}</button>
      case 'mediaReview':return <ReviewCell task={task} stage="media" busy={busy===task.id} review={status=>void review(task,'media',status)}/>
      case 'publication':return <button disabled={disabled} className={`grid-status grid-publication-${task.publicationStatus}`} onClick={()=>setPublicationTask(task)}>{task.publicationStatus==='published'?'Đã đăng':task.publicationStatus==='scheduled'?'Đã lên lịch':task.requiresPublishing?'Chưa cập nhật':'Không yêu cầu'}<Pencil size={11}/></button>
      case 'publishDate':return <button className="grid-age-button" onClick={()=>setInfoTask(task)}><span className="grid-date">{formatDate(task.publishedDate||task.plannedPublishDate)}</span></button>
      case 'postUrl':return <div className="grid-link-edit">{task.postUrl?<a className="grid-post-link" href={task.postUrl} title={task.postUrl} target="_blank" rel="noopener noreferrer"><Link2 size={13}/>Mở bài đăng<ExternalLink size={12}/></a>:<span className="grid-placeholder">Chưa nhập</span>}<button className="icon-button" aria-label={`Sửa link bài đăng ${task.sku}`} onClick={()=>setInfoTask(task)}><Pencil size={12}/></button></div>
      case 'deadline':return <button className="grid-age-button" onClick={()=>setInfoTask(task)}><Deadline task={task} now={now}/></button>
      case 'status':return <button className="grid-age-button" onClick={()=>setInfoTask(task)}><Badge task={task}/></button>
    }
  }
  const visible=columns.filter(c=>!hidden.includes(c[0]))
  const actionWidth=user.role==='admin'?92:52
  const selectable=filtered.slice(0,100)
  const allSelected=selectable.length>0&&selectable.every(task=>selectedIds.includes(task.id))
  function toggleSelected(id:string) {setSelectedIds(current=>current.includes(id)?current.filter(value=>value!==id):current.length<100?[...current,id]:current)}
  return <section className="panel content-board">
    <div className="board-toolbar"><div className="board-view-name"><Table2 size={18}/><b>Bảng nội dung</b><span>{records.length} bản ghi</span></div><div className="board-tools"><button className="button primary compact" onClick={()=>setAdding(true)} disabled={adding}><Plus size={16}/>Thêm dòng</button><label className="filter-check"><input type="checkbox" checked={allMonths} onChange={e=>setAllMonths(e.target.checked)}/>Toàn bộ tháng</label><button className="button soft compact" onClick={()=>setDesc(!desc)}>{desc?<ArrowDownWideNarrow size={16}/>:<ArrowUpWideNarrow size={16}/>}SKU {desc?'giảm dần':'tăng dần'}</button><div className="column-picker"><button className="button soft compact" aria-expanded={chooser} onClick={()=>setChooser(!chooser)}><Columns3 size={16}/>Cột hiển thị</button>{chooser&&<div className="column-menu"><b>Hiển thị cột</b>{columns.map(([key,label])=><label key={key}><input type="checkbox" checked={!hidden.includes(key)} onChange={e=>{const next=e.target.checked?hidden.filter(k=>k!==key):[...hidden,key];setHidden(next);localStorage.setItem(preferenceKey,JSON.stringify(next))}}/>{label}</label>)}<button className="button soft" onClick={()=>{setHidden([]);localStorage.removeItem(preferenceKey);setChooser(false)}}>Hiện tất cả cột</button></div>}</div></div></div>
    <div className="board-filters"><div className="search-box"><Search size={16}/><input aria-label="Tìm trong bảng nội dung" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm SKU, Page, caption, nhân viên…"/></div><select aria-label="Lọc Page" value={page} onChange={e=>setPage(e.target.value)}><option value="">Tất cả Page</option>{pages.map(p=><option key={p}>{p}</option>)}</select><select aria-label="Lọc loại video" value={video} onChange={e=>setVideo(e.target.value)}><option value="">Tất cả loại video</option>{videos.map(v=><option key={v}>{v}</option>)}</select><select aria-label="Lọc bảng nội dung" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Tất cả nội dung</option><option value="script">Chờ duyệt kịch bản</option><option value="media">Chờ duyệt media</option><option value="published">Đã đăng Page</option><option value="unpublished">Cần đăng Page</option><option value="late">Trễ deadline</option></select></div>
    {user.role==='admin'&&selectedIds.length>0&&<div className="board-selection-bar"><span><b>Đã chọn {selectedIds.length} công việc</b><small>{filtered.length>100?'Mỗi lần chọn tối đa 100 dòng.':'Chọn thêm bằng ô vuông ở đầu mỗi dòng.'}</small></span><div><button className="button soft compact" onClick={()=>setSelectedIds([])}>Bỏ chọn</button><button className="button danger compact" onClick={()=>requestDelete(records.filter(task=>selectedIds.includes(task.id)))}><Trash2 size={15}/>Xóa {selectedIds.length} công việc</button></div></div>}
    {adding&&<QuickContentRow users={users} close={()=>setAdding(false)} save={async data=>{await action(async()=>{const result=await api.createTask(data);onCreated(result.task.periodKey);setSearch('');setPage('');setVideo('');setFilter('');setAdding(false);return result},'Đã thêm dòng nội dung.')}}/>}
    {error&&<p className="load-error" role="alert">{error}<button onClick={()=>{setError('');setSkuRetry(k=>k+1)}}>Thử lại</button></p>}
    {(allMonths?allLoading:loading)?<Loading/>:<div className="board-scroll" tabIndex={0} aria-label="Bảng nội dung, cuộn ngang để xem các cột"><table className="content-grid" style={{width:48+154+actionWidth+visible.reduce((sum,c)=>sum+c[2],0)}}><colgroup><col style={{width:48}}/><col style={{width:154}}/>{visible.map(([key,,width])=><col key={key} style={{width}}/>)}<col style={{width:actionWidth}}/></colgroup><thead><tr><th className="grid-number">{user.role==='admin'?<input type="checkbox" aria-label={`Chọn tất cả ${selectable.length} công việc đang hiển thị`} checked={allSelected} disabled={!selectable.length} ref={el=>{if(el)el.indeterminate=selectedIds.length>0&&!allSelected}} onChange={()=>setSelectedIds(allSelected?[]:selectable.map(task=>task.id))}/>:'#'}</th><th className="grid-sku"><Hash size={13}/>SKU / Tháng</th>{visible.map(([key,label])=><th key={key}>{['script','sourceLink','mediaLink','postUrl'].includes(key)&&<Link2 size={13}/>}<span>{label}</span></th>)}<th className="grid-actions" aria-label="Thao tác">Thao tác</th></tr></thead><tbody>{filtered.map((task,index)=><tr key={task.id} className={`${task.status==='cancelled'?'grid-cancelled':''} ${selectedIds.includes(task.id)?'grid-selected':''}`}><td className="grid-number">{user.role==='admin'?<input type="checkbox" aria-label={`Chọn ${task.sku}`} checked={selectedIds.includes(task.id)} disabled={selectedIds.length>=100&&!selectedIds.includes(task.id)} onChange={()=>toggleSelected(task.id)}/>:index+1}</td><td className="grid-sku"><div className="grid-sku-content"><button className="grid-sku-link" title="Mở chi tiết công việc" onClick={()=>openTask(task)}>{task.sku || 'Đang cấp mã…'}{allMonths&&<small className="sku-month">{task.periodKey}</small>}</button>{task.sku&&<button className="icon-button sku-edit-button" aria-label={`Sửa SKU ${task.sku}`} title="Sửa SKU" onClick={()=>setSkuTask(task)}><Pencil size={12}/></button>}</div></td>{visible.map(([key])=><td key={key}>{cell(task,key)}</td>)}<td className="grid-actions"><div className="grid-row-actions"><button className="icon-button" aria-label={`Sửa thông tin ${task.sku}`} onClick={()=>setInfoTask(task)}><Pencil size={15}/></button>{user.role==='admin'&&<button className="icon-button delete-task-button" aria-label={`Xóa công việc ${task.sku}`} title="Xóa công việc" onClick={()=>requestDelete([task])}><Trash2 size={15}/></button>}</div></td></tr>)}</tbody></table>{!filtered.length&&<Empty title="Chưa có nội dung phù hợp" text={records.length?'Đổi bộ lọc để xem các công việc.':'Tạo công việc để bắt đầu bảng nội dung của SALE - MARKETING.'}/>}</div>}
    <div className="board-bottom-actions"><button className="board-add-row" onClick={()=>{setError('');setResetting(true)}}>Reset SKU · {month}</button><button className="board-add-row" disabled={adding} onClick={()=>setAdding(true)}><Plus size={16}/>Thêm dòng nội dung</button><button className="board-add-row" disabled={!records.length||duplicating} onClick={()=>setDuplicating(true)}><Copy size={16}/>Sao chép SKU</button></div>
    {duplicating&&<DuplicateTasks tasks={records} close={()=>setDuplicating(false)} save={async(task,count,deadlineAt)=>{await action(async()=>{const result=await api.duplicateTask(task.id,count,deadlineAt);onCreated(result.periodKey);setSearch('');setPage('');setVideo('');setFilter('');setDuplicating(false)},`Đã tạo ${count} bản mới, mỗi bản có SKU riêng.`)}}/>}
    <div className="board-footer"><span><b>{filtered.length}</b> bản ghi hiển thị · {records.length} tổng</span><span>Nhấp vào ô để sửa · SKU mở chi tiết · Cuộn ngang để xem thêm</span></div>
    {resetting&&<Modal compact title={`Reset SKU tháng ${month}?`} close={()=>{if(!resetBusy)setResetting(false)}}><div className="form-stack"><p>Đánh số lại toàn bộ công việc của tháng <b>{month}</b> từ <b>vuatoi.0001</b>. Giữ nguyên nội dung, người làm và kết quả. Các tháng khác giữ nguyên.</p><p className="form-help">Công việc tạo tiếp sẽ nhận mã sau số cuối cùng của tháng. SKU cũ đã chia sẻ có thể thay đổi.</p>{error&&<p className="form-error">{error}</p>}<div className="form-actions"><button className="button soft" disabled={resetBusy} onClick={()=>setResetting(false)}>Hủy</button><button className="button primary" disabled={resetBusy} onClick={async()=>{setResetBusy(true);setError('');try{const result=await api.resetSkus(month);await action(async()=>{},`Đã reset ${result.count} công việc. Mã tiếp theo: ${result.nextSku}.`);setResetting(false)}catch(e){setError((e as Error).message)}finally{setResetBusy(false)}}}>{resetBusy?'Đang reset…':'Reset SKU tháng này'}</button></div></div></Modal>}
    {skuTask&&<Modal compact title="Sửa SKU" close={()=>setSkuTask(null)}><SkuEditor task={skuTask} close={()=>setSkuTask(null)} save={async sku=>{await action(()=>api.renameSku(skuTask.id,sku),'Đã cập nhật SKU.');setSkuTask(null)}}/></Modal>}
    {infoTask&&<Modal title="Sửa toàn bộ dòng nội dung" close={()=>setInfoTask(null)}><BoardEditor task={infoTask} users={users} actor={user} save={async fn=>{await action(fn,'Đã cập nhật dòng nội dung.');setInfoTask(null)}}/></Modal>}
    {publicationTask&&<Modal title="Đăng bài / video" close={()=>setPublicationTask(null)}><PublicationEditor task={publicationTask} manager save={async data=>{await action(()=>api.publish(publicationTask.id,data),'Đã cập nhật thông tin đăng Page.');setPublicationTask(null)}}/></Modal>}
  </section>
}
