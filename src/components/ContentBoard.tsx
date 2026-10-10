import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Columns3, Copy, ExternalLink, Hash, Link2, Pencil, Plus, Search, Table2 } from 'lucide-react'
import { api } from '../lib/data'
import { formatDate } from '../lib/date'
import { QuickContentRow } from './QuickContentRow'
import { ContentInfoFields } from './ContentInfoFields'
import { PublicationEditor } from './PublicationEditor'
import { DuplicateTasks } from './DuplicateTasks'
import { Badge, Deadline, Empty, Loading, Modal } from './TaskUi'
import { contentTitles, reviewLabels, sourceLabels, stageMembers, stageState } from '../utils/content'
import { deadlineState } from '../utils/tasks'
import type { ContentInfo, MarketingTask, ReviewStage, SourceStatus, UserProfile } from '../types'

const columns = [
  ['page','Tên Page',175],['content','Content',145],['video','Loại video',160],['line','Tuyến nội dung',155],['age','Độ tuổi',150],['audience','Đối tượng',185],['campaign','Chiến dịch / Sản phẩm',185],
  ['title','Tiêu đề nội dung',310],['script','Link kịch bản',190],['scriptReview','Trạng thái kịch bản',160],['source','SOURCE',145],['sourceLink','Link source',190],
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
  const state=stageState(task,stage),disabled=busy||['done','cancelled'].includes(task.status)||['not_applicable','not_submitted','needs_revision'].includes(state)
  return <select aria-label={`Duyệt ${stage==='script'?'kịch bản':'media'} ${task.sku}`} className={`grid-status grid-status-${state}`} value={state} disabled={disabled} onChange={e=>review(e.target.value as 'approved'|'needs_revision')}>
    <option value={state}>{reviewLabels[state]}</option>{state!=='approved'&&<option value="approved">Đã duyệt</option>}{state!=='needs_revision'&&<option value="needs_revision">Yêu cầu sửa</option>}
  </select>
}
function InfoEditor({task,save}:{task:MarketingTask;save:(info:Partial<ContentInfo>)=>Promise<void>}) {
  const [info,setInfo]=useState(task.contentInfo),[busy,setBusy]=useState(false),[error,setError]=useState('')
  return <form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await save(Object.fromEntries(Object.entries(info).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(task.contentInfo[key as keyof ContentInfo]))));}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}><div className="sku-preview"><b>{task.sku}</b><span>{task.title}</span></div><ContentInfoFields value={info} change={setInfo}/>{error&&<p className="form-error">{error}</p>}<div className="form-actions"><button disabled={busy} className="button primary">{busy?'Đang lưu…':'Lưu thông tin'}</button></div></form>
}
export function ContentBoard({tasks,users,onCreated,user,now,loading,openTask,action}:{tasks:MarketingTask[];users:UserProfile[];onCreated:(periodKey:string)=>void;user:UserProfile;now:number;loading:boolean;openTask:(task:MarketingTask)=>void;action:Action}) {
  const [allMonths,setAllMonths]=useState(false),[allTasks,setAllTasks]=useState<MarketingTask[]>([]),[allLoading,setAllLoading]=useState(false)
  const [adding,setAdding]=useState(false)
  const [duplicating,setDuplicating]=useState(false)
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
  }).sort((a,b)=>((a.skuNumber??Number.MAX_SAFE_INTEGER)-(b.skuNumber??Number.MAX_SAFE_INTEGER)||a.createdAt.localeCompare(b.createdAt))*(desc?-1:1)),[records,search,page,video,filter,now,desc])
  async function update(task:MarketingTask,changes:Partial<ContentInfo>) {await action(()=>api.updateContentInfo(task.id,changes),'Đã lưu thông tin nội dung.')}
  async function review(task:MarketingTask,stage:ReviewStage,status:'approved'|'needs_revision') {
    setBusy(task.id);setError('')
    try{await action(()=>api.reviewStage(task.id,stage,status),status==='approved'?'Đã duyệt kết quả.':'Đã yêu cầu chỉnh sửa phần việc này.')}catch(e){setError((e as Error).message)}finally{setBusy(null)}
  }
  function cell(task:MarketingTask,column:Column):ReactNode {
    const disabled=task.status==='cancelled',info=task.contentInfo
    const text=(key:'pageName'|'videoType'|'contentLine'|'audience'|'campaign')=><InlineText value={info[key]} label={`${columns.find(c=>c[0]===column)?.[1]} ${task.sku}`} disabled={disabled} save={value=>update(task,{[key]:value})}/>
    switch(column) {
      case 'page':return text('pageName')
      case 'content':return <People task={task} stage="script"/>
      case 'video':return text('videoType')
      case 'line':return text('contentLine')
      case 'age':return <button className="grid-age-button" disabled={disabled} onClick={()=>setInfoTask(task)}>{info.ageGroups.length?<span className="grid-chips">{info.ageGroups.map(age=><span className="grid-chip age" key={age}>{age}</span>)}</span>:<span className="grid-placeholder">Chọn độ tuổi</span>}</button>
      case 'audience':return text('audience')
      case 'campaign':return text('campaign')
      case 'title':return <div className="grid-title"><InlineText value={task.title} label={`Tiêu đề ${task.sku}`} disabled={disabled||task.status==='done'} save={title=>action(()=>api.renameTask(task.id,title),'Đã lưu tiêu đề.')}/>{contentTitles(task)!==task.title&&<small title={contentTitles(task)}>{contentTitles(task)}</small>}</div>
      case 'script':return <ResultLinks task={task} stage="script"/>
      case 'scriptReview':return <ReviewCell task={task} stage="script" busy={busy===task.id} review={status=>void review(task,'script',status)}/>
      case 'source':return <select aria-label={`Trạng thái source ${task.sku}`} className={`grid-status grid-source-${info.sourceStatus}`} value={info.sourceStatus} disabled={disabled||busy===task.id} onChange={async e=>{setBusy(task.id);try{await update(task,{sourceStatus:e.target.value as SourceStatus})}catch(e){setError((e as Error).message)}finally{setBusy(null)}}}>{Object.entries(sourceLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
      case 'sourceLink':return <ResultLinks task={task} stage="source"/>
      case 'media':return <People task={task} stage="media"/>
      case 'mediaLink':return <ResultLinks task={task} stage="media"/>
      case 'reviewer':return task.mediaReview.byName?<span className="grid-chip reviewer">{task.mediaReview.byName}</span>:<span className="grid-placeholder">—</span>
      case 'mediaReview':return <ReviewCell task={task} stage="media" busy={busy===task.id} review={status=>void review(task,'media',status)}/>
      case 'publication':return <button disabled={disabled} className={`grid-status grid-publication-${task.publicationStatus}`} onClick={()=>setPublicationTask(task)}>{task.publicationStatus==='published'?'Đã đăng':task.publicationStatus==='scheduled'?'Đã lên lịch':task.requiresPublishing?'Chưa cập nhật':'Không yêu cầu'}<Pencil size={11}/></button>
      case 'publishDate':return <span className="grid-date">{formatDate(task.publishedDate||task.plannedPublishDate)}</span>
      case 'postUrl':return task.postUrl?<a className="grid-post-link" href={task.postUrl} title={task.postUrl} target="_blank" rel="noopener noreferrer"><Link2 size={13}/>Mở bài đăng<ExternalLink size={12}/></a>:<span className="grid-placeholder">—</span>
      case 'deadline':return <Deadline task={task} now={now}/>
      case 'status':return <Badge task={task}/>
    }
  }
  const visible=columns.filter(c=>!hidden.includes(c[0]))
  return <section className="panel content-board">
    <div className="board-toolbar"><div className="board-view-name"><Table2 size={18}/><b>Bảng nội dung</b><span>{records.length} bản ghi</span></div><div className="board-tools"><button className="button primary compact" onClick={()=>setAdding(true)} disabled={adding}><Plus size={16}/>Thêm dòng</button><label className="filter-check"><input type="checkbox" checked={allMonths} onChange={e=>setAllMonths(e.target.checked)}/>Toàn bộ tháng</label><button className="button soft compact" onClick={()=>setDesc(!desc)}>{desc?<ArrowDownWideNarrow size={16}/>:<ArrowUpWideNarrow size={16}/>}SKU {desc?'giảm dần':'tăng dần'}</button><div className="column-picker"><button className="button soft compact" aria-expanded={chooser} onClick={()=>setChooser(!chooser)}><Columns3 size={16}/>Cột hiển thị</button>{chooser&&<div className="column-menu"><b>Hiển thị cột</b>{columns.map(([key,label])=><label key={key}><input type="checkbox" checked={!hidden.includes(key)} onChange={e=>{const next=e.target.checked?hidden.filter(k=>k!==key):[...hidden,key];setHidden(next);localStorage.setItem(preferenceKey,JSON.stringify(next))}}/>{label}</label>)}<button className="button soft" onClick={()=>{setHidden([]);localStorage.removeItem(preferenceKey);setChooser(false)}}>Hiện tất cả cột</button></div>}</div></div></div>
    <div className="board-filters"><div className="search-box"><Search size={16}/><input aria-label="Tìm trong bảng nội dung" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm SKU, Page, tiêu đề, nhân viên…"/></div><select aria-label="Lọc Page" value={page} onChange={e=>setPage(e.target.value)}><option value="">Tất cả Page</option>{pages.map(p=><option key={p}>{p}</option>)}</select><select aria-label="Lọc loại video" value={video} onChange={e=>setVideo(e.target.value)}><option value="">Tất cả loại video</option>{videos.map(v=><option key={v}>{v}</option>)}</select><select aria-label="Lọc bảng nội dung" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Tất cả nội dung</option><option value="script">Chờ duyệt kịch bản</option><option value="media">Chờ duyệt media</option><option value="published">Đã đăng Page</option><option value="unpublished">Cần đăng Page</option><option value="late">Trễ deadline</option></select></div>
    {adding&&<QuickContentRow users={users} close={()=>setAdding(false)} save={async data=>{await action(async()=>{const result=await api.createTask(data);onCreated(result.task.periodKey);setSearch('');setPage('');setVideo('');setFilter('');setAdding(false);return result},'Đã thêm dòng nội dung.')}}/>}
    {error&&<p className="load-error" role="alert">{error}<button onClick={()=>{setError('');setSkuRetry(k=>k+1)}}>Thử lại</button></p>}
    {(allMonths?allLoading:loading)?<Loading/>:<div className="board-scroll" tabIndex={0} aria-label="Bảng nội dung, cuộn ngang để xem các cột"><table className="content-grid" style={{width:48+154+52+visible.reduce((sum,c)=>sum+c[2],0)}}><colgroup><col style={{width:48}}/><col style={{width:154}}/>{visible.map(([key,,width])=><col key={key} style={{width}}/>)}<col style={{width:52}}/></colgroup><thead><tr><th className="grid-number">#</th><th className="grid-sku"><Hash size={13}/>SKU</th>{visible.map(([key,label])=><th key={key}>{['script','sourceLink','mediaLink','postUrl'].includes(key)&&<Link2 size={13}/>}<span>{label}</span></th>)}<th aria-label="Sửa thông tin"/></tr></thead><tbody>{filtered.map((task,index)=><tr key={task.id} className={task.status==='cancelled'?'grid-cancelled':''}><td className="grid-number">{index+1}</td><td className="grid-sku"><button title="Mở chi tiết công việc" onClick={()=>openTask(task)}>{task.sku || 'Đang cấp mã…'}</button></td>{visible.map(([key])=><td key={key}>{cell(task,key)}</td>)}<td><button className="icon-button" disabled={task.status==='cancelled'} aria-label={`Sửa thông tin ${task.sku}`} onClick={()=>setInfoTask(task)}><Pencil size={15}/></button></td></tr>)}</tbody></table>{!filtered.length&&<Empty title="Chưa có nội dung phù hợp" text={records.length?'Đổi bộ lọc để xem các công việc.':'Tạo công việc để bắt đầu bảng nội dung của SALE - MARKETING.'}/>}</div>}
    <div className="board-bottom-actions"><button className="board-add-row" disabled={adding} onClick={()=>setAdding(true)}><Plus size={16}/>Thêm dòng nội dung</button><button className="board-add-row" disabled={!records.length||duplicating} onClick={()=>setDuplicating(true)}><Copy size={16}/>Sao chép SKU</button></div>
    {duplicating&&<DuplicateTasks tasks={records} close={()=>setDuplicating(false)} save={async(task,count,deadlineAt)=>{await action(async()=>{const result=await api.duplicateTask(task.id,count,deadlineAt);onCreated(result.periodKey);setSearch('');setPage('');setVideo('');setFilter('');setDuplicating(false)},`Đã tạo ${count} bản mới, mỗi bản có SKU riêng.`)}}/>}
    <div className="board-footer"><span><b>{filtered.length}</b> bản ghi hiển thị · {records.length} tổng</span><span>Nhấp vào ô để sửa · SKU mở chi tiết · Cuộn ngang để xem thêm</span></div>
    {infoTask&&<Modal title="Thông tin nội dung" close={()=>setInfoTask(null)}><InfoEditor task={infoTask} save={async info=>{await update(infoTask,info);setInfoTask(null)}}/></Modal>}
    {publicationTask&&<Modal title="Đăng bài / video" close={()=>setPublicationTask(null)}><PublicationEditor task={publicationTask} manager save={async data=>{await action(()=>api.publish(publicationTask.id,data),'Đã cập nhật thông tin đăng Page.');setPublicationTask(null)}}/></Modal>}
  </section>
}
