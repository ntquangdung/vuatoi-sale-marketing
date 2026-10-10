import { readFile } from 'node:fs/promises'
import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { arrayUnion, collection, doc, FieldPath, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
let env
const claims = uid => ({email:uid+'@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}})
const actor = uid => env.authenticatedContext(uid,claims(uid)).firestore()
const profile = (uid,role='employee') => ({uid,fullName:uid,email:uid+'@example.com',role,active:true,createdAt:Timestamp.now(),updatedAt:Timestamp.now()})
const empty = () => ({title:'',scriptUrl:'',mediaUrl:'',note:'',status:'pending',submittedAt:null})
const contentInfo = () => ({pageName:'Vua Tỏi',videoType:'Giáo dục',contentLine:'Tuyến 1',ageGroups:['25–34'],audience:'Khách hàng',campaign:'',thumbnailUrl:'',sourceUrl:'',sourceStatus:'not_started'})
const emptyReview = () => ({status:'pending',byUid:'',byName:'',signature:'',reviewedAt:null})
const skuFor = n => 'vuatoi.'+String(n).padStart(4,'0')
async function createTask(db,id,value=taskValue()) {
 return runTransaction(db,async tx=>{
  const counter=doc(db,'counters','taskSku'),before=await tx.get(counter),skuNumber=(before.data()?.value||0)+1
  tx.set(counter,{value:skuNumber,taskId:id,updatedAt:serverTimestamp()})
  tx.set(doc(db,'tasks',id),{...value,sku:skuFor(skuNumber),skuNumber})
 })
}
function taskValue(uids=['content','media']) {
 return {title:'Video Vua Tỏi',description:'',taskType:'video',referenceUrl:'https://example.com/brief',contentInfo:contentInfo(),scriptReview:emptyReview(),mediaReview:emptyReview(),assigneeUids:uids,submittedUids:[],
 assignments:Object.fromEntries(uids.map(uid=>[uid,{fullName:uid,workRole:uid==='media'?'media':'content'}])),
 contributions:Object.fromEntries(uids.map(uid=>[uid,empty()])),createdByUid:'admin',createdByName:'admin',status:'todo',priority:'normal',
 deadlineAt:Timestamp.fromMillis(Date.now()+86400000),durationHours:24,periodKey:'2026-10',requiresPublishing:false,
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
 await assertSucceeds(updateDoc(doc(admin,'users','content'),{active:false,updatedAt:serverTimestamp()}))
 await assertFails(getDoc(doc(actor('content'),'tasks','one')))
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
