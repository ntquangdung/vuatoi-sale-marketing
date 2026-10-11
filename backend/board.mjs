import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpError } from './accounts.mjs'

const now = () => FieldValue.serverTimestamp()
const skuFor = n => `vuatoi.${String(n).padStart(4,'0')}`
const sequence = sku => /^vuatoi\.\d+$/.test(sku || '') ? Number(sku.slice(7)) : 0
const periodAt = value => new Date(value).toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7)
const empty = () => ({title:'',scriptUrl:'',sourceUrl:'',mediaUrl:'',note:'',status:'pending',submittedAt:null})
const review = () => ({status:'pending',byUid:'',byName:'',signature:'',reviewedAt:null})
const fail = message => { throw new HttpError(400,message) }
function text(value,max,required=false) { if(typeof value!=='string'||value.length>max||(required&&!value.trim())) fail('Nội dung nhập không hợp lệ hoặc quá dài.'); return value.trim() }
function link(value) { const s=text(value || '',2000); if(s&&!/^https?:\/\/\S+$/.test(s)) fail('Link cần bắt đầu bằng https:// hoặc http://.'); return s }
function skuValue(value) { const s=text(value,80,true).toLowerCase(); if(!/^[a-z0-9][a-z0-9._-]*$/.test(s)||(/^vuatoi\.\d+$/.test(s)&&(!sequence(s)||sequence(s)>999999999))) fail('SKU không hợp lệ.'); return sequence(s)?skuFor(sequence(s)):s }
function period(value) { if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) fail('Chọn tháng hợp lệ.'); return value }
function content(value) {
  const result={}; for(const key of ['pageName','videoType','contentLine','audience','campaign']) result[key]=text(value?.[key] || '',180)
  if(!Array.isArray(value?.ageGroups)||new Set(value.ageGroups).size!==value.ageGroups.length||value.ageGroups.some(v=>!['Dưới 18','18–24','25–34','35–44','45–54','55+'].includes(v))) fail('Độ tuổi không hợp lệ.')
  result.ageGroups=value.ageGroups;result.sourceUrl=link(value.sourceUrl);result.sourceStatus=value.sourceStatus
  if(!['not_started','shooting','recorded'].includes(result.sourceStatus)) fail('Trạng thái source không hợp lệ.')
  return result
}
function date(value) { if(value===null||value==='') return null; if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value) fail('Ngày đăng không hợp lệ.'); return value }
function publication(input,before={}) {
  const required=input.requiresPublishing ?? before.requiresPublishing, status=input.publicationStatus ?? before.publicationStatus ?? 'not_scheduled'
  if(typeof required!=='boolean') fail('Chọn yêu cầu đăng bài.')
  if(!required) return {requiresPublishing:false,publicationStatus:'not_applicable',plannedPublishDate:null,publishedDate:null,postUrl:null}
  if(!['not_scheduled','not_applicable','scheduled','published'].includes(status)) fail('Trạng thái đăng bài không hợp lệ.')
  const planned=date(input.plannedPublishDate ?? before.plannedPublishDate ?? null), published=date(input.publishedDate ?? before.publishedDate ?? null), post=link(input.postUrl ?? before.postUrl ?? '')
  if(status==='scheduled'&&!planned) fail('Chọn ngày lên lịch đăng.')
  if(status==='published'&&(!published||!post)) fail('Nhập ngày đăng và link bài đăng.')
  return {requiresPublishing:true,publicationStatus:status==='not_applicable'?'not_scheduled':status,plannedPublishDate:planned,publishedDate:status==='published'?published:null,postUrl:status==='published'?post:null}
}
async function fields(tx,db,input,before) {
  const title=text(input.title,180,true),description=text(input.description || '',5000),referenceUrl=link(input.referenceUrl)
  if(!['video','content','seo','design','other'].includes(input.taskType)) fail('Loại công việc không hợp lệ.')
  if(!Array.isArray(input.assignees)||input.assignees.length<1||input.assignees.length>8||new Set(input.assignees.map(a=>a.uid)).size!==input.assignees.length) fail('Chọn 1–8 nhân viên khác nhau.')
  const deadline=Date.parse(input.deadlineAt); if(!Number.isFinite(deadline)||(!before&&deadline<=Date.now())) fail('Chọn deadline hợp lệ ở tương lai.')
  if(before&&deadline<=before.createdAt.toMillis()) fail('Deadline cần sau thời điểm tạo công việc.')
  const assignments={},contributions={}
  for(const a of input.assignees) {
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(a.uid)||!['content','media','other'].includes(a.workRole)) fail('Người được giao không hợp lệ.')
    const u=(await tx.get(db.doc(`users/${a.uid}`))).data()
    if(!u?.active||u.role!=='employee') { if(!before?.assignments[a.uid]) fail('Chỉ giao mới cho nhân viên đang hoạt động.'); assignments[a.uid]={...before.assignments[a.uid],workRole:a.workRole} }
    else assignments[a.uid]={fullName:before?.assignments[a.uid]?.fullName || u.fullName,workRole:a.workRole}
    const old=before?.contributions[a.uid] || empty()
    contributions[a.uid]=before?.assignments[a.uid]?.workRole===a.workRole ? old : {...old,status:'pending',submittedAt:null}
  }
  return {title,description,referenceUrl,taskType:input.taskType,contentInfo:content(input.contentInfo),assigneeUids:input.assignees.map(a=>a.uid),assignments,contributions,submittedUids:Object.keys(contributions).filter(uid=>contributions[uid].status==='submitted'),deadlineAt:Timestamp.fromMillis(deadline),periodKey:periodAt(deadline),requiresPublishing:input.requiresPublishing}
}
export async function boardAction(db,actor,input) {
  if(!['admin','manager'].includes(actor.role)) throw new HttpError(403,'Chỉ ADMIN hoặc quản lý được sửa bảng nội dung và reset SKU.')
  const action=input.action, id=input.id
  if(!['create','copy','rename','missing','reset','edit'].includes(action)) fail('Thao tác không hợp lệ.')
  if(!['create','reset'].includes(action)&&!(/^[a-zA-Z0-9_-]{1,128}$/.test(id))) fail('Công việc không hợp lệ.')
  const refs=action==='copy'?Array.from({length:Number.isInteger(input.count)&&input.count>=1&&input.count<=50?input.count:0},()=>db.collection('tasks').doc()):[]
  if(action==='copy'&&!refs.length) fail('Chọn 1–50 bản sao.')
  const target=action==='create'?db.collection('tasks').doc():id?db.doc(`tasks/${id}`):null
  return db.runTransaction(async tx=>{
    const snapshot=action==='create'||action==='reset'?null:await tx.get(target),before=snapshot?.data()
    if(snapshot&&!snapshot.exists) throw new HttpError(404,'Không tìm thấy công việc.')
    if(action==='missing'&&before.sku) return {id}
    if(action==='edit'&&input.expectedUpdatedAt&&before.updatedAt?.toDate().toISOString()!==input.expectedUpdatedAt) throw new HttpError(409,'Task vừa được người khác cập nhật. Mở lại dòng để lấy dữ liệu mới rồi lưu.')
    let data
    if(action==='create'||action==='edit') data=await fields(tx,db,input.data,before)
    if(action==='copy') data=await fields(tx,db,{...before,deadlineAt:input.deadlineAt,assignees:before.assigneeUids.map(uid=>({uid,workRole:before.assignments[uid].workRole}))},null)
    const month=period(action==='reset'?input.month:data?.periodKey || before.periodKey),counter=db.doc(`skuMonths/${month}`)
    // All allocation, rename, move and reset operations serialize on the month counter.
    const counterSnap=await tx.get(counter), rows=await tx.get(db.collection('tasks').where('periodKey','==',month))
    let value=Math.max(counterSnap.data()?.value || 0,...rows.docs.map(d=>sequence(d.data().sku)))
    if(action==='reset') {
      const ordered=rows.docs.sort((a,b)=>(a.data().sku || '').localeCompare(b.data().sku || '',undefined,{numeric:true})||a.data().createdAt.toMillis()-b.data().createdAt.toMillis()||a.id.localeCompare(b.id))
      ordered.forEach((row,index)=>tx.update(row.ref,{sku:skuFor(index+1),skuNumber:index+1,updatedAt:now()}))
      tx.set(counter,{value:ordered.length,updatedAt:now(),resetAt:now(),resetBy:actor.uid})
      return {count:ordered.length,month,nextSku:skuFor(ordered.length+1)}
    }
    let sku=before?.sku || '',number=before?.skuNumber ?? null
    const moving=action==='edit'&&month!==before.periodKey
    if(action==='rename'||(action==='edit'&&input.data.sku!==undefined&&input.data.sku!==before.sku)) {
      sku=skuValue(action==='rename'?input.sku:input.data.sku)
      if(rows.docs.some(d=>d.id!==id&&d.data().sku===sku)) throw new HttpError(409,'SKU đã tồn tại trong tháng này.')
      value=Math.max(value,sequence(sku));number=sequence(sku)||null
    } else if(action==='create'||action==='missing'||moving) { number=++value;sku=skuFor(number) }
    if(action==='copy') {
      const first=value+1
      refs.forEach((ref,index)=>tx.set(ref,{...data,assignments:before.assignments,contributions:Object.fromEntries(data.assigneeUids.map(uid=>[uid,empty()])),submittedUids:[],sku:skuFor(++value),skuNumber:value,scriptReview:review(),mediaReview:review(),createdByUid:actor.uid,createdByName:actor.fullName,status:'todo',...publication({requiresPublishing:data.requiresPublishing,publicationStatus:'not_scheduled'}),createdAt:now(),updatedAt:now(),completedAt:null}))
      tx.set(counter,{value,updatedAt:now()},{merge:true})
      return {count:refs.length,firstSku:skuFor(first),lastSku:skuFor(value),periodKey:month}
    }
    if(action==='create') data={...data,scriptReview:review(),mediaReview:review(),createdByUid:actor.uid,createdByName:actor.fullName,status:'todo',...publication({requiresPublishing:data.requiresPublishing,publicationStatus:'not_scheduled'}),createdAt:now(),completedAt:null}
    if(action==='edit') {
      const supplied=input.data
      if(supplied.contributions) for(const uid of data.assigneeUids) {
        const c=supplied.contributions[uid] || empty()
        if(!['pending','working','submitted'].includes(c.status)) fail('Trạng thái phần việc không hợp lệ.')
        const next={title:text(c.title,180),scriptUrl:link(c.scriptUrl),sourceUrl:link(c.sourceUrl),mediaUrl:link(c.mediaUrl),note:text(c.note,5000),status:c.status,submittedAt:c.status==='submitted'?(before.contributions[uid]?.submittedAt || Timestamp.now()):null}
        if(c.status==='submitted'&&(data.assignments[uid].workRole==='content'? !next.title||!next.scriptUrl:data.assignments[uid].workRole==='media'?!next.mediaUrl:false)) fail('Phần việc đã nộp cần có đủ link kết quả.')
        data.contributions[uid]=next
      }
      data.submittedUids=data.assigneeUids.filter(uid=>data.contributions[uid].status==='submitted')
      data={...data,...publication(supplied,before)}
      if(supplied.status!==undefined) {if(!['todo','in_progress','waiting_review','needs_revision','done','cancelled'].includes(supplied.status)) fail('Trạng thái không hợp lệ.');data.status=supplied.status;data.completedAt=supplied.status==='done'?before.completedAt || now():null}
      for(const key of ['scriptReview','mediaReview']) if(supplied[key]) {
        const r=supplied[key];if(!['pending','approved','needs_revision'].includes(r.status)) fail('Trạng thái duyệt không hợp lệ.')
        if(r.status==='pending') data[key]=review()
        else {
          const reviewer=await tx.get(db.doc(`users/${r.byUid || actor.uid}`)), person=reviewer.data()
          if(!person?.active||!['admin','manager'].includes(person.role)) fail('Người duyệt cần là ADMIN hoặc quản lý đang hoạt động.')
          const members=data.assigneeUids.filter(uid=>data.assignments[uid].workRole===(key==='scriptReview'?'content':'media')).sort()
          const signature=JSON.stringify(members.map(uid=>{const c=data.contributions[uid],at=c.submittedAt?.toDate().toISOString() || null;return key==='scriptReview'?[uid,c.title,c.scriptUrl,c.status,at]:[uid,c.mediaUrl,c.status,at]}))
          data[key]={status:r.status,byUid:reviewer.id,byName:person.fullName,signature,manual:true,reviewedAt:now()}
        }
      }
    }
    tx.set(counter,{value,updatedAt:now()},{merge:true})
    if(action==='create') tx.set(target,{...data,sku,skuNumber:number,updatedAt:now()})
    else tx.update(target,{...data,sku,skuNumber:number,updatedAt:now()})
    return {id:target.id}
  })
}
