import {readFile} from 'node:fs/promises'
import {before,after,beforeEach,test} from 'node:test'
import assert from 'node:assert/strict'
import {initializeApp,deleteApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {getFirestore,Timestamp as AdminTimestamp} from 'firebase-admin/firestore'
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing'
import {doc,getDoc,getDocs,collection,setDoc,updateDoc,writeBatch,serverTimestamp,Timestamp,query,where,FieldPath,arrayUnion,deleteDoc} from 'firebase/firestore'
import {assertAccountReady,authorize,manageAccount} from '../backend/accounts.mjs'
import {boardAction} from '../backend/board.mjs'
import {loginEmail} from '../shared/accounts.mjs'
let env,app,auth,db
const actor={uid:'admin',role:'admin',fullName:'Admin',active:true,email:loginEmail('admin')}
const manager={uid:'manager',role:'manager',fullName:'Manager',active:true,email:loginEmail('manager')}
const employee={uid:'content',role:'employee',fullName:'Content',active:true,email:loginEmail('content')}
const profile=u=>({...u,username:u.uid,position:'content',createdAt:AdminTimestamp.now(),updatedAt:AdminTimestamp.now()})
const claims=uid=>({email:loginEmail(uid),firebase:{sign_in_provider:'password'}})
const client=(uid,provider='password')=>env.authenticatedContext(uid,{...claims(uid),firebase:{sign_in_provider:provider}}).firestore()
const input=(month='2030-10')=>({title:'Video VUA TỎI',description:'Yêu cầu',taskType:'video',referenceUrl:'https://example.com/brief',contentInfo:{pageName:'VUA TỎI',videoType:'Giáo dục',contentLine:'Tuyến 1',ageGroups:['25–34'],audience:'Khách hàng',campaign:'Tỏi',sourceUrl:'',sourceStatus:'not_started'},assignees:[{uid:'content',workRole:'content'},{uid:'media',workRole:'media'}],deadlineAt:month+'-15T03:00:00Z',requiresPublishing:false})
const create=(data=input(),who=actor)=>boardAction(db,who,{action:'create',data})
const row=async id=>(await db.doc('tasks/'+id).get()).data()
const account=(extra={})=>({action:'create',username:'nhanvien',password:'Test-password-8491',fullName:'Nhân viên mới',position:'media',salary:12000000,...extra})
async function login(username,password='Test-password-8491') {
 const r=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:loginEmail(username),password,returnSecureToken:true})});const data=await r.json();if(!r.ok)throw new Error(data.error.message);return data.idToken
}
async function access(uid,active,who='manager') {
 const c=client(who),batch=writeBatch(c),p=(await db.doc('users/'+uid).get()).data()
 batch.update(doc(c,'users',uid),{active,updatedAt:serverTimestamp()});batch.set(doc(c,'employeeAccess',p.email),{uid,email:p.email,active,updatedAt:serverTimestamp()});await batch.commit()
}
before(async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Tests must run on emulators only.')
 app=initializeApp({projectId:'demo-marketing-vua-toi'},'account-tests');auth=getAuth(app);db=getFirestore(app)
 env=await initializeTestEnvironment({projectId:'demo-marketing-vua-toi',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8')}})
})
after(async()=>{await env?.cleanup();await db?.terminate();if(app)await deleteApp(app)})
beforeEach(async()=>{
 await env.clearFirestore();await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/demo-marketing-vua-toi/accounts`,{method:'DELETE'})
 for(const u of [actor,manager,employee,{...employee,uid:'media',email:loginEmail('media'),fullName:'Media'}]) {await auth.createUser({uid:u.uid,email:u.email,password:'Test-password-8491'});await db.doc('users/'+u.uid).set(profile(u))}
})
test('ADMIN creates a password account with private salary and media position; no password is persisted',async()=>{
 const result=await manageAccount({auth,db},actor,account()),u=(await db.doc('users/'+result.uid).get()).data()
 assert.equal(u.username,'nhanvien');assert.equal(u.position,'media');assert.equal(u.role,'employee');assert.equal((await db.doc('staffSalary/'+u.uid).get()).data().amount,12000000)
 assert.equal(u.password,undefined);assert.equal((await db.collection('accountAudit').get()).docs[0].data().password,undefined)
 const token=await login('nhanvien');assert.equal((await auth.verifyIdToken(token)).uid,u.uid)
})

test('ADMIN can provision ADMIN and manager positions with the matching access',async()=>{
 for(const position of ['admin','manager']) {
  const {uid}=await manageAccount({auth,db},actor,account({username:'new.'+position,position}))
  const user=(await db.doc('users/'+uid).get()).data()
  assert.equal(user.position,position);assert.equal(user.role,position)
  const token=await login('new.'+position)
  assert.equal((await authorize(auth,db,token,false,true)).role,position)
  if(position==='manager') await assert.rejects(authorize(auth,db,token),e=>e.status===403)
  else assert.equal((await authorize(auth,db,token)).role,'admin')
 }
})

test('position updates change permissions immediately and keep the existing UID and login',async()=>{
 const data=account({action:'update',uid:'content',username:'content',password:'',position:'manager'})
 await manageAccount({auth,db},actor,data)
 const token=await login('content')
 assert.equal((await authorize(auth,db,token,false,true)).role,'manager')
 await assert.rejects(authorize(auth,db,token),e=>e.status===403)
 await manageAccount({auth,db},actor,{...data,position:'media'})
 assert.equal((await db.doc('users/content').get()).data().role,'employee')
 assert.equal((await auth.verifyIdToken(await login('content'))).uid,'content')
 await assert.rejects(authorize(auth,db,token,false,true),e=>e.status===403)
})

test('ADMIN cannot demote themselves through account API or direct profile changes',async()=>{
 await assert.rejects(manageAccount({auth,db},actor,account({action:'update',uid:'admin',username:'admin',position:'manager',password:''})),e=>e.status===400)
 assert.equal((await db.doc('users/admin').get()).data().role,'admin')
 assert.equal((await auth.getUser('admin')).disabled,false)
 await assertFails(updateDoc(doc(client('admin'),'users','admin'),{role:'manager',position:'manager',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(client('content'),'users','content'),{role:'admin',position:'admin',updatedAt:serverTimestamp()}))
 await assertSucceeds(updateDoc(doc(client('admin'),'users','content'),{role:'manager',position:'manager',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(client('admin'),'users','content'),{position:'media',updatedAt:serverTimestamp()}))
})
test('migration stays blocked until the deploy operator enables password Auth and new rules',async()=>{
 await assert.rejects(assertAccountReady(db),e=>e.status===503);assert.equal((await auth.getUser('admin')).email,actor.email)
 await db.doc('system/accountAuth').set({ready:true});await assertAccountReady(db)
 await assertFails(setDoc(doc(client('admin'),'system','accountAuth'),{ready:true}))
})
test('manager, employee, absent token and Google provider cannot invoke account provisioning',async()=>{
 for(const u of ['manager','content']) await assert.rejects(authorize(auth,db,await login(u)),e=>e.status===403)
 await assert.rejects(authorize(auth,db,null),e=>e.status===401)
 await assert.rejects(authorize({verifyIdToken:async()=>({uid:'admin',firebase:{sign_in_provider:'google.com'}})},db,'emulator-only'),e=>e.status===403)
 assert.equal((await authorize(auth,db,await login('admin'))).role,'admin')
})
test('username reservations serialize concurrent account creation and keep ADMIN signed in',async()=>{
 const results=await Promise.allSettled([manageAccount({auth,db},actor,account()),manageAccount({auth,db},actor,account())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);assert.equal((await auth.verifyIdToken(await login('admin'))).uid,'admin')
})
test('concurrent updates to a legacy identity cannot separate its login email and profile',async()=>{
 await db.doc('users/content').update({username:(await import('firebase-admin/firestore')).FieldValue.delete()})
 const results=await Promise.allSettled(['first.content','second.content'].map(username=>manageAccount({auth,db},actor,account({action:'update',uid:'content',username}))))
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 const u=(await db.doc('users/content').get()).data();assert.equal((await auth.getUser('content')).email,u.email);assert.equal((await auth.verifyIdToken(await login(u.username))).uid,'content')
})
test('password reset preserves UID, assignments and salary; old password stops working',async()=>{
 const {id}=await create();const before=await row(id)
 await manageAccount({auth,db},actor,account({action:'update',uid:'content',username:'content',password:'New-password-6259',fullName:'Content mới',position:'content',salary:9000000}))
 assert.equal((await row(id)).assignments.content.fullName,before.assignments.content.fullName)
 await assert.rejects(login('content'));assert.equal((await auth.verifyIdToken(await login('content','New-password-6259'))).uid,'content')
})
test('existing Google ADMIN migrates on same UID and keeps ADMIN role',async()=>{
 await db.doc('users/admin').update({username:(await import('firebase-admin/firestore')).FieldValue.delete()})
 const oldAuth={verifyIdToken:async()=>({uid:'admin',firebase:{sign_in_provider:'google.com'}})}
 const permitted=await authorize(oldAuth,db,'emulator-only',true)
 await manageAccount({auth,db},permitted,account({action:'migrate',username:'admin.moi',fullName:'Admin'}))
 assert.equal((await auth.verifyIdToken(await login('admin.moi'))).uid,'admin');assert.equal((await db.doc('users/admin').get()).data().role,'admin')
 assert.equal((await db.doc('users/admin').get()).data().position,'admin')
 await assert.rejects(authorize(oldAuth,db,'emulator-only',true),e=>e.status===403)
})
test('self registration cannot create profiles or gain access; Google identities cannot read tasks',async()=>{
 const {id}=await create(),newDb=client('new')
 await assertFails(setDoc(doc(newDb,'users','new'),{...profile({...employee,uid:'new',email:loginEmail('new')}),createdAt:serverTimestamp(),updatedAt:serverTimestamp()}))
 await assertFails(getDoc(doc(client('content','google.com'),'tasks',id)))
 await assertFails(getDoc(doc(client('admin','google.com'),'tasks',id)))
 await assertFails(getDoc(doc(newDb,'tasks',id)))
})
test('salary is readable only by ADMIN and cannot be changed directly from any client',async()=>{
 await db.doc('staffSalary/content').set({amount:10000000})
 await assertSucceeds(getDoc(doc(client('admin'),'staffSalary','content')))
 for(const uid of ['manager','content']) await assertFails(getDoc(doc(client(uid),'staffSalary','content')))
 await assertFails(setDoc(doc(client('admin'),'staffSalary','content'),{amount:1}))
})
test('revocation keeps historical names, immediately denies access and manager can restore it',async()=>{
 const {id}=await create();await access('content',false)
 assert.equal((await row(id)).assignments.content.fullName,'Content')
 await assertFails(getDoc(doc(client('content'),'tasks',id)));await assert.rejects(authorize(auth,db,await login('content'),false,true),e=>e.status===403)
 await access('content',true);await assertSucceeds(getDoc(doc(client('content'),'tasks',id)))
 await assertFails(deleteDoc(doc(client('admin'),'users','content')))
})
test('manager cannot revoke another manager, change role, salary, username or position',async()=>{
 const c=client('manager');await assertFails(updateDoc(doc(c,'users','admin'),{active:false,updatedAt:serverTimestamp()}));await assertFails(updateDoc(doc(c,'users','content'),{role:'admin',updatedAt:serverTimestamp()}));await assertFails(updateDoc(doc(client('admin'),'users','content'),{username:'other',updatedAt:serverTimestamp()}));await assertFails(updateDoc(doc(c,'users','content'),{position:'media',updatedAt:serverTimestamp()}))
})
test('months start independently at 0001 and deleting a task does not reuse its number',async()=>{
 const a=await create(),b=await create(input('2030-11'));assert.equal((await row(a.id)).sku,'vuatoi.0001');assert.equal((await row(b.id)).sku,'vuatoi.0001')
 await db.doc('tasks/'+a.id).delete();const c=await create();assert.equal((await row(c.id)).sku,'vuatoi.0002')
})
test('legacy tasks initialize monthly high water without changing current SKUs',async()=>{
 const {id}=await create();await db.doc('tasks/'+id).update({sku:'vuatoi.0037',skuNumber:37});await db.doc('skuMonths/2030-10').delete();const next=await create();assert.equal((await row(next.id)).sku,'vuatoi.0038');assert.equal((await row(id)).sku,'vuatoi.0037')
})
test('concurrent creation and copy allocate distinct contiguous numbers',async()=>{
 const source=await create();await Promise.all([create(input(),manager),boardAction(db,manager,{action:'copy',id:source.id,count:10,deadlineAt:input().deadlineAt})]);const rows=(await db.collection('tasks').get()).docs.map(d=>d.data());assert.equal(rows.length,12);assert.equal(new Set(rows.map(r=>r.sku)).size,12);assert.deepEqual(rows.map(r=>r.skuNumber).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));assert.equal(rows.every(r=>r.assignments.content.fullName==='Content'),true)
})
test('ADMIN and manager can rename SKU; duplicates only blocked within same month',async()=>{
 const a=await create(),b=await create();await create(input('2030-11'))
 await boardAction(db,manager,{action:'rename',id:a.id,sku:'VUATOI.0010'});assert.equal((await row(a.id)).sku,'vuatoi.0010');await assert.rejects(boardAction(db,actor,{action:'rename',id:b.id,sku:'vuatoi.0010'}),e=>e.status===409)
 const next=await create();assert.equal((await row(next.id)).sku,'vuatoi.0011');await assert.rejects(boardAction(db,employee,{action:'rename',id:a.id,sku:'x'}),e=>e.status===403)
})
test('monthly reset reindexes only that month, preserves results and next number follows last row',async()=>{
 const a=await create(),b=await create(),other=await create(input('2030-11'));await db.doc('tasks/'+a.id).update({sku:'vuatoi.0080','contributions.content.note':'Giữ nguyên kết quả'})
 const result=await boardAction(db,manager,{action:'reset',month:'2030-10'});assert.equal(result.count,2);assert.equal(result.nextSku,'vuatoi.0003');assert.equal((await row(a.id)).contributions.content.note,'Giữ nguyên kết quả');assert.equal((await row(other.id)).sku,'vuatoi.0001');assert.equal((await row(b.id)).sku,'vuatoi.0001');assert.equal((await row((await create()).id)).sku,'vuatoi.0003')
})
test('reset on an empty month starts at 0001; employees cannot reset or write counters',async()=>{
 assert.equal((await boardAction(db,actor,{action:'reset',month:'2030-12'})).nextSku,'vuatoi.0001');await assert.rejects(boardAction(db,employee,{action:'reset',month:'2030-12'}),e=>e.status===403)
 for(const uid of ['admin','manager','content']) await assertFails(setDoc(doc(client(uid),'skuMonths','2030-12'),{value:0}))
})
test('concurrent reset and creation leave all SKUs unique',async()=>{
 await create();await create();await Promise.all([boardAction(db,manager,{action:'reset',month:'2030-10'}),create()]);const rows=(await db.collection('tasks').get()).docs.map(d=>d.data());assert.equal(new Set(rows.map(r=>r.sku)).size,3);assert.equal((await row((await create()).id)).sku,'vuatoi.0004')
})
test('manager can edit every board field on a closed task with named reviewer and results',async()=>{
 const {id}=await create();await db.doc('tasks/'+id).update({status:'cancelled'})
 const before=await row(id), data={...input(),sku:'content-special',title:'Tiêu đề mới',description:'Sửa tất cả',status:'done',requiresPublishing:true,publicationStatus:'published',plannedPublishDate:'2030-10-16',publishedDate:'2030-10-17',postUrl:'https://example.com/post',contributions:{content:{...before.contributions.content,title:'Kịch bản mới',scriptUrl:'https://example.com/script',sourceUrl:'https://example.com/source',status:'submitted'},media:{...before.contributions.media,mediaUrl:'https://example.com/media',status:'submitted'}},scriptReview:{status:'approved',byUid:'admin'},mediaReview:{status:'approved',byUid:'manager'}}
 await boardAction(db,manager,{action:'edit',id,data,expectedUpdatedAt:before.updatedAt.toDate().toISOString()});const result=await row(id);assert.equal(result.sku,'content-special');assert.equal(result.status,'done');assert.equal(result.mediaReview.byName,'Manager');assert.equal(result.contributions.media.mediaUrl,data.contributions.media.mediaUrl);assert.equal(result.publicationStatus,'published');assert.equal(result.submittedUids.length,2)
})
test('moving deadlines across months allocates a unique code in destination month',async()=>{
 const a=await create(),b=await create(input('2030-11'));await boardAction(db,manager,{action:'edit',id:a.id,data:{...input('2030-11'),sku:'vuatoi.0001'}});assert.equal((await row(a.id)).sku,'vuatoi.0002');assert.equal((await row(b.id)).sku,'vuatoi.0001');assert.equal((await row(a.id)).periodKey,'2030-11')
})
test('stale editor cannot overwrite a new employee submission; invalid links are rejected',async()=>{
 const {id}=await create(),before=await row(id);await db.doc('tasks/'+id).update({'contributions.content.note':'Mới',updatedAt:AdminTimestamp.now()});await assert.rejects(boardAction(db,manager,{action:'edit',id,data:input(),expectedUpdatedAt:before.updatedAt.toDate().toISOString()}),e=>e.status===409);await assert.rejects(create({...input(),referenceUrl:'javascript:alert(1)'}),e=>e.status===400)
})
test('employees only read assigned tasks and update their own contribution',async()=>{
 const {id}=await create(),c=client('content'),ref=doc(c,'tasks',id),own={title:'Kịch bản',scriptUrl:'https://example.com/script',sourceUrl:'',mediaUrl:'',note:'',status:'submitted',submittedAt:serverTimestamp()}
 await assertSucceeds(updateDoc(ref,new FieldPath('contributions','content'),own,'submittedUids',arrayUnion('content'),'updatedAt',serverTimestamp()))
 await assertFails(updateDoc(ref,new FieldPath('contributions','media'),own,'updatedAt',serverTimestamp()));await assertFails(updateDoc(ref,{deadlineAt:Timestamp.now(),updatedAt:serverTimestamp()}));await assertSucceeds(getDocs(query(collection(c,'tasks'),where('assigneeUids','array-contains','content'))));await assertFails(getDocs(collection(c,'tasks')))
})
test('only ADMIN can delete tasks; direct SKU writes and task creation are denied',async()=>{
 const {id}=await create();await assertFails(deleteDoc(doc(client('manager'),'tasks',id)));await assertFails(updateDoc(doc(client('manager'),'tasks',id),{sku:'forged',updatedAt:serverTimestamp()}));const value=(await getDoc(doc(client('admin'),'tasks',id))).data();await assertFails(setDoc(doc(client('admin'),'tasks','forged'),value));await assertSucceeds(deleteDoc(doc(client('admin'),'tasks',id)))
})
test('manager can edit title and metadata on closed rows; employee cannot edit closed results',async()=>{
 const {id}=await create();await db.doc('tasks/'+id).update({status:'done',completedAt:AdminTimestamp.now()});await assertSucceeds(updateDoc(doc(client('manager'),'tasks',id),{title:'Sửa tiêu đề sau hoàn thành',updatedAt:serverTimestamp()}));await assertFails(updateDoc(doc(client('content'),'tasks',id),{'contributions.content.note':'Sửa lén',updatedAt:serverTimestamp()}))
})
