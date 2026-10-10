import { readFile } from 'node:fs/promises'
import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { arrayUnion, collection, deleteDoc, doc, FieldPath, getDoc, getDocs, getDocsFromServer, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
let env
const claims = uid => ({email:uid+'@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}})
const actor = uid => env.authenticatedContext(uid,claims(uid)).firestore()
const profile = (uid,role='employee') => ({uid,fullName:uid,email:uid+'@example.com',role,active:true,createdAt:Timestamp.now(),updatedAt:Timestamp.now()})
const empty = () => ({title:'',scriptUrl:'',sourceUrl:'',mediaUrl:'',note:'',status:'pending',submittedAt:null})
const contentInfo = () => ({pageName:'Vua Tỏi',videoType:'Giáo dục',contentLine:'Tuyến 1',ageGroups:['25–34'],audience:'Khách hàng',campaign:'',thumbnailUrl:'',sourceUrl:'',sourceStatus:'not_started'})
const emptyReview = () => ({status:'pending',byUid:'',byName:'',signature:'',reviewedAt:null})
const skuFor = n => 'vuatoi.'+String(n).padStart(4,'0')
async function setAccess(db,uid,active) {
 return runTransaction(db,async tx=>{
  const ref=doc(db,'users',uid),user=await tx.get(ref)
  tx.update(ref,{active,updatedAt:serverTimestamp()})
  tx.set(doc(db,'employeeAccess',user.data().email),{uid,email:user.data().email,active,updatedAt:serverTimestamp()})
 })
}
async function createTask(db,id,value=taskValue()) {
 return allocateSku(db,async (tx,counter,skuNumber)=>{
  tx.set(counter,{value:skuNumber,taskId:id,updatedAt:serverTimestamp()})
  tx.set(doc(db,'tasks',id),{...value,sku:skuFor(skuNumber),skuNumber})
 })
}
async function allocateSku(db,write) {
 const counter=doc(db,'counters','taskSku')
 for(let attempt=0;;attempt++) {
  let previous=null,revision=''
  try { return await runTransaction(db,async tx=>{const before=(await tx.get(counter)).data();previous=before?.value||0;revision=before?.updatedAt?.toString()||'';return write(tx,counter,previous+1)}) }
  catch(error) {
   if(attempt<3&&previous!==null&&error.code==='permission-denied') {const fresh=(await getDoc(counter)).data();if((fresh?.value||0)!==previous||(fresh?.updatedAt?.toString()||'')!==revision)continue}
   throw error
  }
 }
}
function taskValue(uids=['content','media']) {
 return {title:'Video Vua Tỏi',description:'',taskType:'video',referenceUrl:'https://example.com/brief',contentInfo:contentInfo(),scriptReview:emptyReview(),mediaReview:emptyReview(),assigneeUids:uids,submittedUids:[],
 assignments:Object.fromEntries(uids.map(uid=>[uid,{fullName:uid,workRole:uid==='media'?'media':'content'}])),
 contributions:Object.fromEntries(uids.map(uid=>[uid,empty()])),createdByUid:'admin',createdByName:'admin',status:'todo',
 deadlineAt:Timestamp.fromMillis(Date.now()+86400000),periodKey:'2026-10',requiresPublishing:false,
 publicationStatus:'not_applicable',plannedPublishDate:null,publishedDate:null,postUrl:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),completedAt:null}
}
before(async()=>{ env=await initializeTestEnvironment({projectId:'demo-marketing-vua-toi',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8')}}) })
after(async()=>{ await env?.cleanup() })
beforeEach(async()=>{
 await env.clearFirestore()
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore()
  for(const uid of ['admin','manager','content','media',...Array.from({length:6},(_,i)=>'extra'+i)]) await setDoc(doc(db,'users',uid),profile(uid,uid==='admin'?'admin':uid==='manager'?'manager':'employee'))
 })
})
test('Google tự tạo employee, không tự nâng ADMIN hoặc giả email',async()=>{
 const db=actor('new')
 const own={...profile('new'),createdAt:serverTimestamp(),updatedAt:serverTimestamp()}
 await assertFails(setDoc(doc(db,'users','new'),{...own,role:'admin'}))
 await assertFails(setDoc(doc(db,'users','new'),{...own,email:'admin@example.com'}))
 await assertSucceeds(setDoc(doc(db,'users','new'),own))
 await assertFails(updateDoc(doc(db,'users','new'),{role:'admin',updatedAt:serverTimestamp()}))
 await assertFails(setDoc(doc(db,'users','another'),{...own,uid:'another'}))
})
test('không đăng nhập / không được giao không đọc được task; query array-contains được phép',async()=>{
 const admin=actor('admin'); await assertSucceeds(createTask(admin,'one'))
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'tasks','one')))
 await assertFails(getDoc(doc(actor('extra0'),'tasks','one')))
 await assertSucceeds(getDocs(query(collection(actor('content'),'tasks'),where('assigneeUids','array-contains','content'),where('periodKey','==','2026-10'))))
 await assertFails(getDocs(collection(actor('content'),'tasks')))
})
test('tối đa 8 người và không trùng; nhân viên không được tự giao task',async()=>{
 const admin=actor('admin')
 await assertSucceeds(createTask(admin,'eight',taskValue(['content','media',...Array.from({length:6},(_,i)=>'extra'+i)])))
 await assertFails(createTask(admin,'duplicate',taskValue(['content','content'])))
 await assertFails(setDoc(doc(actor('content'),'tasks','bad'),taskValue()))
})
test('nhân viên chỉ sửa phần mình; chặn sửa deadline, phần người khác và tự duyệt',async()=>{
 const admin=actor('admin'); await createTask(admin,'one')
 const content=actor('content'); const ref=doc(content,'tasks','one')
 const data=(await getDoc(ref)).data()
 const own={...empty(),title:'Kịch bản',scriptUrl:'https://example.com/script',status:'submitted',submittedAt:serverTimestamp()}
 await assertSucceeds(updateDoc(ref,{contributions:{...data.contributions,content:own},submittedUids:['content'],updatedAt:serverTimestamp()}))
 const fresh=(await getDoc(ref)).data()
 await assertFails(updateDoc(ref,new FieldPath('contributions','content'),{...own,status:'working',submittedAt:null},'submittedUids',[],'updatedAt',serverTimestamp()))
 await assertFails(updateDoc(ref,{contributions:{...fresh.contributions,media:{...empty(),note:'Fake',status:'working'}},updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{deadlineAt:Timestamp.fromMillis(Date.now()+999999999),updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{status:'done',completedAt:serverTimestamp(),updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{'contributions.content.scriptUrl':'javascript:alert(1)',updatedAt:serverTimestamp()}))
})
test('hai người lưu đồng thời giữ đủ hai kết quả; chỉ duyệt khi đủ phần việc',async()=>{
 const admin=actor('admin'); await createTask(admin,'one')
 await assertFails(updateDoc(doc(admin,'tasks','one'),{status:'done',completedAt:serverTimestamp(),updatedAt:serverTimestamp()}))
 await Promise.all(['content','media'].map(uid=>{
  const db=actor(uid); const ref=doc(db,'tasks','one')
  return updateDoc(ref,new FieldPath('contributions',uid),{...empty(),title:'Title '+uid,scriptUrl:uid==='content'?'https://example.com/script':'',mediaUrl:uid==='media'?'https://example.com/edit':'',status:'submitted',submittedAt:serverTimestamp()},'submittedUids',arrayUnion(uid),'updatedAt',serverTimestamp())
 }))
 const result=(await getDoc(doc(admin,'tasks','one'))).data()
 assert.equal(result.contributions.content.title,'Title content')
 assert.equal(result.contributions.media.mediaUrl,'https://example.com/edit')
 const approval={status:'approved',byUid:'admin',byName:'admin',signature:'current submitted results',reviewedAt:serverTimestamp()}
 await assertSucceeds(updateDoc(doc(admin,'tasks','one'),{status:'done',scriptReview:approval,mediaReview:approval,completedAt:serverTimestamp(),updatedAt:serverTimestamp()}))
 await assertSucceeds(updateDoc(doc(admin,'tasks','one'),{requiresPublishing:true,publicationStatus:'published',publishedDate:'2026-10-10',postUrl:'https://example.com/post',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(actor('media'),'tasks','one'),{'contributions.media.note':'Edit after close',updatedAt:serverTimestamp()}))
})
test('khóa nhân viên ngăn truy cập; ADMIN không tự hạ quyền',async()=>{
 const admin=actor('admin'); await createTask(admin,'one')
 await assertFails(updateDoc(doc(admin,'users','admin'),{role:'employee',updatedAt:serverTimestamp()}))
 await assertSucceeds(setAccess(admin,'content',false))
 await assertFails(getDoc(doc(actor('content'),'tasks','one')))
})

test('chỉ ADMIN đang hoạt động được xóa task; giữ nguyên bộ đếm và không dùng lại SKU',async()=>{
 const admin=actor('admin')
 await createTask(admin,'one');await createTask(admin,'keep')
 for(const db of [actor('manager'),actor('content'),actor('extra0'),env.unauthenticatedContext().firestore()]) {
  await assertFails(deleteDoc(doc(db,'tasks','one')))
 }
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'users','admin'),{active:false}))
 await assertFails(deleteDoc(doc(admin,'tasks','one')))
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'users','admin'),{active:true}))
 const counterBefore=(await getDoc(doc(admin,'counters','taskSku'))).data()
 await assertSucceeds(deleteDoc(doc(admin,'tasks','one')))
 assert.equal((await getDoc(doc(admin,'tasks','one'))).exists(),false)
 assert.equal((await getDoc(doc(admin,'tasks','keep'))).exists(),true)
 assert.deepEqual((await getDoc(doc(admin,'counters','taskSku'))).data(),counterBefore)
 // Deleting the most recently allocated SKU also must not reset the sequence.
 await assertSucceeds(deleteDoc(doc(admin,'tasks','keep')))
 await assertSucceeds(createTask(admin,'next'))
 assert.equal((await getDoc(doc(admin,'tasks','next'))).data().sku,'vuatoi.0003')
 for(const status of ['done','cancelled']) {
  await createTask(admin,status)
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'tasks',status),{status}))
  await assertFails(deleteDoc(doc(actor('manager'),'tasks',status)))
  await assertFails(deleteDoc(doc(actor('content'),'tasks',status)))
  await assertSucceeds(deleteDoc(doc(admin,'tasks',status)))
  assert.equal((await getDoc(doc(admin,'tasks',status))).exists(),false)
 }
})

test('xóa nhiều task là một lần ghi nguyên tử; chặn quản lý và nhân viên, đủ 100 task cho ADMIN',async()=>{
 const admin=actor('admin');await createTask(admin,'one');await createTask(admin,'two')
 for(const uid of ['manager','content','extra0']) {
  const db=actor(uid),batch=writeBatch(db)
  batch.delete(doc(db,'tasks','one'));batch.delete(doc(db,'tasks','two'))
  await assertFails(batch.commit())
  assert.equal((await getDoc(doc(admin,'tasks','one'))).exists(),true)
  assert.equal((await getDoc(doc(admin,'tasks','two'))).exists(),true)
 }
 const invalid=writeBatch(admin)
 invalid.delete(doc(admin,'tasks','one'));invalid.delete(doc(admin,'users','content'))
 await assertFails(invalid.commit())
 assert.equal((await getDoc(doc(admin,'tasks','one'))).exists(),true)
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore(),batch=writeBatch(db)
  for(let n=3;n<=100;n++) batch.set(doc(db,'tasks','bulk-'+n),{...taskValue(),sku:skuFor(n),skuNumber:n})
  batch.set(doc(db,'counters','taskSku'),{value:100,taskId:'bulk-100',updatedAt:serverTimestamp()})
  await batch.commit()
 })
 const counterBefore=(await getDoc(doc(admin,'counters','taskSku'))).data()
 const batch=writeBatch(admin)
 for(const id of ['one','two',...Array.from({length:98},(_,i)=>'bulk-'+(i+3))]) batch.delete(doc(admin,'tasks',id))
 await assertSucceeds(batch.commit())
 assert.equal((await getDocs(collection(admin,'tasks'))).size,0)
 assert.deepEqual((await getDoc(doc(admin,'counters','taskSku'))).data(),counterBefore)
 await assertSucceeds(createTask(admin,'next'))
 assert.equal((await getDoc(doc(admin,'tasks','next'))).data().sku,'vuatoi.0101')
})

test('đã đọc lưu theo tài khoản, không sửa hoặc đọc thông báo người khác',async()=>{
 const admin=actor('admin'), content=actor('content'); const value=taskValue()
 await createTask(admin,'one',value)
 const read={kind:'soon',deadlineAt:value.deadlineAt,readAt:serverTimestamp()}
 await assertSucceeds(setDoc(doc(content,'users','content','deadlineReads','one'),read))
 await assertSucceeds(getDoc(doc(content,'users','content','deadlineReads','one')))
 await assertSucceeds(setDoc(doc(admin,'users','admin','deadlineReads','one'),read))
 await assertFails(getDoc(doc(actor('media'),'users','content','deadlineReads','one')))
 await assertFails(setDoc(doc(content,'users','admin','deadlineReads','one'),read))
 await assertFails(setDoc(doc(actor('extra0'),'users','extra0','deadlineReads','one'),read))
 await assertFails(setDoc(doc(content,'users','content','deadlineReads','missing'),read))
 await assertFails(setDoc(doc(content,'users','content','deadlineReads','one'),{...read,kind:'admin'}))
})

test('hai quản lý tạo đồng thời có SKU riêng, không đổi hoặc giả mã đã cấp',async()=>{
 const admin=actor('admin'),manager=actor('manager')
 const second={...taskValue(),createdByUid:'manager',createdByName:'manager'}
 await Promise.all([createTask(admin,'one'),createTask(manager,'two',second)])
 const one=(await getDoc(doc(admin,'tasks','one'))).data(),two=(await getDoc(doc(admin,'tasks','two'))).data()
 assert.deepEqual([one.sku,two.sku].sort(),['vuatoi.0001','vuatoi.0002'])
 await assertFails(updateDoc(doc(admin,'tasks','one'),{sku:'vuatoi.9999',skuNumber:9999,updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(actor('content'),'tasks','one'),{sku:'vuatoi.9999',updatedAt:serverTimestamp()}))
 await assertFails(setDoc(doc(admin,'tasks','forged'),{...taskValue(),sku:one.sku,skuNumber:one.skuNumber}))
 await assertFails(getDoc(doc(actor('content'),'counters','taskSku')))
 await assertFails(setDoc(doc(admin,'counters','taskSku'),{value:99,taskId:'forged',updatedAt:serverTimestamp()}))
})

test('task cũ được cấp SKU một lần, giữ nguyên phần việc đã nộp',async()=>{
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'tasks','old'),taskValue()))
 const admin=actor('admin')
 await assertSucceeds(runTransaction(admin,async tx=>{
  const ref=doc(admin,'tasks','old'),counter=doc(admin,'counters','taskSku')
  await tx.get(ref);await tx.get(counter)
  tx.set(counter,{value:1,taskId:'old',updatedAt:serverTimestamp()});tx.update(ref,{sku:'vuatoi.0001',skuNumber:1,updatedAt:serverTimestamp()})
 }))
 const saved=(await getDoc(doc(admin,'tasks','old'))).data();assert.equal(saved.sku,'vuatoi.0001');assert.equal(saved.contributions.content.status,'pending')
 await assertFails(updateDoc(doc(admin,'tasks','old'),{sku:'vuatoi.0002',skuNumber:2,updatedAt:serverTimestamp()}))
})

test('chỉ quản lý sửa thông tin bảng và duyệt, chặn link script độc hại',async()=>{
 const admin=actor('admin'),manager=actor('manager');await createTask(admin,'one')
 await assertSucceeds(updateDoc(doc(manager,'tasks','one'),{'contentInfo.pageName':'Vua Tỏi Lý Sơn','contentInfo.sourceStatus':'recorded','contentInfo.sourceUrl':'https://example.com/source',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(actor('content'),'tasks','one'),{'contentInfo.pageName':'Fake',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(manager,'tasks','one'),{'contentInfo.thumbnailUrl':'javascript:alert(1)',updatedAt:serverTimestamp()}))
 const review={status:'approved',byUid:'manager',byName:'manager',signature:'approved',reviewedAt:serverTimestamp()}
 await assertSucceeds(updateDoc(doc(manager,'tasks','one'),{scriptReview:review,updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(actor('content'),'tasks','one'),{scriptReview:review,updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(admin,'tasks','one'),{mediaReview:review,updatedAt:serverTimestamp()}))
})

async function copyBatch(db, prefix, count, corrupt=false) {
 return allocateSku(db,async (tx,counter,firstValue)=>{
  const taskIds=Array.from({length:count},(_,i)=>prefix+i)
  tx.set(counter,{value:firstValue+count-1,firstValue,taskIds,taskId:taskIds[count-1],updatedAt:serverTimestamp()})
  taskIds.forEach((id,i)=>tx.set(doc(db,'tasks',id),{...taskValue(),sku:skuFor(firstValue+i),skuNumber:corrupt&&i===0?99999:firstValue+i}))
 })
}
test('tạo đồng thời lô 10 bản và task đơn vẫn có SKU riêng; đủ 50 bản trong một giao dịch',async()=>{
 const admin=actor('admin');await createTask(admin,'original')
 const original=(await getDoc(doc(admin,'tasks','original'))).data()
 await Promise.all([copyBatch(admin,'copy-',10),createTask(admin,'single')])
 const records=(await getDocs(collection(admin,'tasks'))).docs.map(d=>d.data())
 assert.equal(records.length,12);assert.equal(new Set(records.map(d=>d.sku)).size,12)
 assert.deepEqual(records.map(d=>d.skuNumber).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1))
 assert.deepEqual((await getDoc(doc(admin,'tasks','original'))).data(),original)
 for(const d of records) {assert.deepEqual(d.assigneeUids,original.assigneeUids);assert.deepEqual(d.assignments,original.assignments)}
 await assertSucceeds(copyBatch(admin,'large-',50))
 assert.equal((await getDocs(collection(admin,'tasks'))).size,62)
})
test('lô lỗi không tạo dở dang, không đổi bộ đếm; nhân viên không tự nhân bản',async()=>{
 const admin=actor('admin');await createTask(admin,'original')
 await assertFails(copyBatch(admin,'bad-',10,true))
 assert.equal((await getDocs(collection(admin,'tasks'))).size,1)
 assert.equal((await getDoc(doc(admin,'counters','taskSku'))).data().value,1)
 await assertFails(copyBatch(actor('content'),'employee-',10))
 await assertFails(copyBatch(admin,'too-many-',51))
})
test('nhân viên tự điền source của mình, không sửa source người khác và chặn URL độc hại',async()=>{
 const admin=actor('admin');await createTask(admin,'one')
 const ref=doc(actor('media'),'tasks','one')
 await assertSucceeds(updateDoc(ref,{'contributions.media.sourceUrl':'https://example.com/footage','contributions.media.status':'working',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{'contributions.content.sourceUrl':'https://example.com/other',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{'contributions.media.sourceUrl':'javascript:alert(1)',updatedAt:serverTimestamp()}))
 await assertSucceeds(updateDoc(doc(admin,'tasks','one'),{'assignments.media.workRole':'other',updatedAt:serverTimestamp()}))
 await assertSucceeds(updateDoc(ref,{'contributions.media.status':'submitted','contributions.media.submittedAt':serverTimestamp(),submittedUids:['media'],updatedAt:serverTimestamp()}))
})
test('người được giao tự lên lịch và đánh dấu đã đăng; không được sửa deadline hay lịch task khác',async()=>{
 const admin=actor('admin'),content=actor('content'),value={...taskValue(),requiresPublishing:true,publicationStatus:'not_scheduled'}
 await createTask(admin,'one',value);const ref=doc(content,'tasks','one')
 await assertFails(updateDoc(ref,{publicationStatus:'scheduled',updatedAt:serverTimestamp()}))
 await assertSucceeds(updateDoc(ref,{publicationStatus:'scheduled',plannedPublishDate:'2026-10-20',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(actor('extra0'),'tasks','one'),{plannedPublishDate:'2026-10-21',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{plannedPublishDate:'2026-10-21',deadlineAt:Timestamp.fromMillis(Date.now()+200000000),updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{publicationStatus:'published',publishedDate:'2026-10-20',postUrl:'javascript:alert(1)',updatedAt:serverTimestamp()}))
 await assertSucceeds(updateDoc(ref,{publicationStatus:'published',publishedDate:'2026-10-20',postUrl:'https://example.com/post',updatedAt:serverTimestamp()}))
 await assertSucceeds(updateDoc(doc(admin,'tasks','one'),{status:'cancelled',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(ref,{publishedDate:'2026-10-21',updatedAt:serverTimestamp()}))
})
test('deadline chọn ngày giờ không còn giới hạn 720 giờ và sửa task cũ vẫn tương thích',async()=>{
 const admin=actor('admin'),value=taskValue();value.deadlineAt=Timestamp.fromMillis(Date.now()+180*86400000)
 await assertSucceeds(createTask(admin,'long',value))
 const legacy={...taskValue(),priority:'normal',durationHours:24}
 await assertSucceeds(createTask(admin,'legacy',legacy))
 await assertSucceeds(updateDoc(doc(admin,'tasks','legacy'),{title:'Nội dung mới',updatedAt:serverTimestamp()}))
})

async function renameSku(db,id,sku,manualNumber=0) {
 return allocateSku(db,async(tx,counter)=>{
  const sequence=await tx.get(counter),ref=doc(db,'tasks',id),before=await tx.get(ref)
  if(before.data().sku===sku)return
  const matches=await getDocsFromServer(query(collection(db,'tasks'),where('sku','==',sku)))
  if(matches.docs.some(match=>match.id!==id))throw new Error('SKU_TRUNG')
  tx.set(counter,{value:Math.max(sequence.data().value,manualNumber),taskId:id,manualSku:sku,manualNumber,updatedAt:serverTimestamp()})
  tx.update(ref,{sku,updatedAt:serverTimestamp()})
 })
}

test('chỉ ADMIN sửa SKU, giữ lịch sử và tiếp tục dãy sau khi xóa hoặc đổi mã',async()=>{
 const admin=actor('admin');await createTask(admin,'one');await createTask(admin,'two')
 const original=(await getDoc(doc(admin,'tasks','one'))).data()
 for(const uid of ['manager','content'])await assertFails(renameSku(actor(uid),'one','vuatoi-video-01'))
 await assertFails(updateDoc(doc(admin,'tasks','one'),{sku:'vuatoi-video-01',updatedAt:serverTimestamp()}))
 await assertSucceeds(renameSku(admin,'one','vuatoi-video-01'))
 const edited=(await getDoc(doc(admin,'tasks','one'))).data()
 assert.equal(edited.sku,'vuatoi-video-01');assert.equal(edited.skuNumber,1)
 for(const key of Object.keys(original).filter(key=>!['sku','updatedAt'].includes(key)))assert.deepEqual(edited[key],original[key])
 await assert.rejects(renameSku(admin,'two','vuatoi-video-01'),/SKU_TRUNG/)
 await assertSucceeds(deleteDoc(doc(admin,'tasks','two')))
 await assertSucceeds(createTask(admin,'next'));assert.equal((await getDoc(doc(admin,'tasks','next'))).data().sku,'vuatoi.0003')
 await assertSucceeds(renameSku(admin,'one','vuatoi.0100',100))
 await assertSucceeds(createTask(admin,'after-future'));assert.equal((await getDoc(doc(admin,'tasks','after-future'))).data().sku,'vuatoi.0101')
 await assertSucceeds(renameSku(admin,'one','vuatoi.0002',2))
 await assertSucceeds(createTask(admin,'keep-increasing'));assert.equal((await getDoc(doc(admin,'tasks','keep-increasing'))).data().sku,'vuatoi.0102')
})

test('sửa SKU cả task đóng, chặn SKU sai định dạng và sửa bộ đếm / nội dung kèm theo',async()=>{
 const admin=actor('admin');await createTask(admin,'one')
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'tasks','one'),{status:'cancelled'}))
 await assertSucceeds(renameSku(admin,'one','cancelled-video'))
 for(const [sku,number] of [['vuatoi.0008',0],['vuatoi.8',8],['VUATOI.0008',8],['invalid/sku',0],['x'.repeat(81),0]])await assertFails(renameSku(admin,'one',sku,number))
 const counter=doc(admin,'counters','taskSku'),ref=doc(admin,'tasks','one')
 await assertFails(setDoc(counter,{value:1,taskId:'one',manualSku:'counter-only',manualNumber:0,updatedAt:serverTimestamp()}))
 const mixed=writeBatch(admin)
 mixed.set(counter,{value:1,taskId:'one',manualSku:'mixed',manualNumber:0,updatedAt:serverTimestamp()})
 mixed.update(ref,{sku:'mixed',title:'Unexpected edit',updatedAt:serverTimestamp()})
 await assertFails(mixed.commit())
 const lower=writeBatch(admin)
 lower.set(counter,{value:0,taskId:'one',manualSku:'lower',manualNumber:0,updatedAt:serverTimestamp()})
 lower.update(ref,{sku:'lower',updatedAt:serverTimestamp()})
 await assertFails(lower.commit())
 assert.equal((await getDoc(counter)).data().value,1)
})

test('hai lần đổi cùng SKU đồng thời chỉ thành công một lần, không làm trùng mã',async()=>{
 const admin=actor('admin');await createTask(admin,'one');await createTask(admin,'two')
 const result=await Promise.allSettled([renameSku(actor('admin'),'one','shared-code'),renameSku(actor('admin'),'two','shared-code')])
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(result.filter(r=>r.status==='rejected'&&r.reason.message==='SKU_TRUNG').length,1)
 await assertSucceeds(copyBatch(admin,'copies-',10))
 const records=(await getDocs(collection(admin,'tasks'))).docs.map(d=>d.data())
 assert.equal(new Set(records.map(d=>d.sku)).size,12)
 assert.equal((await getDoc(doc(admin,'counters','taskSku'))).data().value,12)
})

test('đổi SKU tương lai đồng thời tạo lô vẫn không trùng mã và không quay lại số đã xóa',async()=>{
 const admin=actor('admin');await createTask(admin,'one')
 await Promise.all([renameSku(actor('admin'),'one','vuatoi.0100',100),copyBatch(actor('admin'),'copies-',10)])
 const records=(await getDocs(collection(admin,'tasks'))).docs.map(d=>d.data())
 assert.equal(new Set(records.map(d=>d.sku)).size,11)
 const high=(await getDoc(doc(admin,'counters','taskSku'))).data().value
 assert.ok(high>=100)
 await assertSucceeds(deleteDoc(doc(admin,'tasks','one')))
 await assertSucceeds(createTask(admin,'next'))
 assert.equal((await getDoc(doc(admin,'tasks','next'))).data().sku,skuFor(high+1))
})

test('quản lý thu hồi / cấp lại quyền nhân viên; giữ hồ sơ và kết quả cũ, chặn tự đăng ký lại',async()=>{
 const admin=actor('admin'),manager=actor('manager'),employee=actor('content')
 await createTask(admin,'one')
 await updateDoc(doc(employee,'tasks','one'),{'contributions.content.note':'Kết quả trước khi thu hồi','contributions.content.status':'working',updatedAt:serverTimestamp()})
 const before=(await getDoc(doc(admin,'tasks','one'))).data()
 const ref=doc(manager,'users','content')
 await assertFails(updateDoc(ref,{active:false,updatedAt:serverTimestamp()}))
 await assertSucceeds(setAccess(manager,'content',false))
 assert.deepEqual((await getDoc(doc(manager,'tasks','one'))).data(),before)
 assert.equal((await getDoc(ref)).data().fullName,'content')
 await assertFails(getDoc(doc(employee,'tasks','one')))
 await assertFails(getDocs(query(collection(employee,'tasks'),where('assigneeUids','array-contains','content'))))
 await assertFails(updateDoc(doc(employee,'tasks','one'),{'contributions.content.note':'Try bypass',updatedAt:serverTimestamp()}))
 await assertFails(setDoc(doc(employee,'users','content'),{...profile('content'),createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(employee,'users','content'),{active:true,updatedAt:serverTimestamp()}))
 await assertFails(deleteDoc(ref));await assertFails(deleteDoc(doc(admin,'users','content')))
 // New sign-in context with the same Google account remains revoked until explicitly restored.
 await assertFails(getDoc(doc(actor('content'),'tasks','one')))
 await assertSucceeds(setAccess(manager,'content',true))
 await assertSucceeds(getDoc(doc(actor('content'),'tasks','one')))
 await assertSucceeds(setAccess(admin,'content',false))
 await assertSucceeds(setAccess(admin,'content',true))
})

test('quản lý không đổi vai trò, tên, khóa quản lý / ADMIN; nhân viên không cấp quyền cho nhau',async()=>{
 const manager=actor('manager')
 for(const uid of ['manager','admin'])await assertFails(updateDoc(doc(manager,'users',uid),{active:false,updatedAt:serverTimestamp()}))
 for(const patch of [{role:'admin'},{role:'manager'},{fullName:'Changed name'},{email:'other@example.com'},{role:'manager',active:false}])await assertFails(updateDoc(doc(manager,'users','content'),{...patch,updatedAt:serverTimestamp()}))
 for(const active of [false,true])await assertFails(updateDoc(doc(actor('media'),'users','content'),{active,updatedAt:serverTimestamp()}))
 await assertSucceeds(updateDoc(doc(actor('admin'),'users','media'),{role:'manager',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(manager,'users','media'),{active:false,updatedAt:serverTimestamp()}))
})

test('email Google bị thu hồi không thể đăng ký lại bằng UID khác; chỉ quản lý cấp lại quyền',async()=>{
 const admin=actor('admin'),manager=actor('manager')
 await createTask(admin,'one');await setAccess(manager,'content',false)
 const fresh=env.authenticatedContext('content-new',claims('content')).firestore()
 const own={...profile('content-new'),email:'content@example.com',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}
 await assertSucceeds(getDoc(doc(fresh,'employeeAccess','content@example.com')))
 await assertFails(getDoc(doc(actor('media'),'employeeAccess','content@example.com')))
 await assertFails(setDoc(doc(fresh,'users','content-new'),own))
 const restore={uid:'content',email:'content@example.com',active:true,updatedAt:serverTimestamp()}
 await assertFails(setDoc(doc(fresh,'employeeAccess','content@example.com'),restore))
 await assertFails(setDoc(doc(actor('media'),'employeeAccess','content@example.com'),restore))
 await assertFails(setDoc(doc(manager,'employeeAccess','content@example.com'),restore))
 await assertFails(deleteDoc(doc(admin,'employeeAccess','content@example.com')))
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'users','content-new'),{...profile('content-new'),email:'content@example.com'}))
 await assertFails(getDocs(collection(fresh,'tasks')))
 await assertFails(updateDoc(doc(fresh,'users','content-new'),{active:true,updatedAt:serverTimestamp()}))
 await env.withSecurityRulesDisabled(ctx=>deleteDoc(doc(ctx.firestore(),'users','content-new')))
 await assertSucceeds(setAccess(manager,'content',true))
 await assertSucceeds(setDoc(doc(fresh,'users','content-new'),own))
 await assertSucceeds(getDoc(doc(actor('content'),'tasks','one')))
})
