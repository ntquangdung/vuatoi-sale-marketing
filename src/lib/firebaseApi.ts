import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { arrayRemove, arrayUnion, collection, doc, FieldPath, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, updateDoc, where, type DocumentData, type DocumentReference, type DocumentSnapshot, type Transaction } from 'firebase/firestore'
import type { Assignment, ContentInfo, Contribution, MarketingTask, StageReview, TaskInput, UserProfile } from '../types'
import { ApiError } from './api'
import { firebaseAuth, firestore } from './firebase'
import type { DataApi } from './data'
import { emptyContribution, periodAt, taskStatus, validLink } from '../utils/tasks'
import { ageOptions, emptyContentInfo, emptyReview, skuFor, stageMembers, stageSignature } from '../utils/content'
import { copyTaskInput, validateCopyCount } from '../utils/duplicate'

function services() {
  if (!firebaseAuth || !firestore) throw new Error('Chưa cấu hình Firebase. Kiểm tra .env.local.')
  return { auth: firebaseAuth, db: firestore }
}
function message(error: unknown): never {
  const code = (error as { code?: string })?.code || ''
  if (code === 'permission-denied') throw new ApiError('Bạn không có quyền thực hiện thao tác này hoặc tài khoản đã bị khóa.', 403)
  if (code === 'auth/popup-closed-by-user') throw new Error('Cửa sổ đăng nhập đã đóng. Bạn có thể thử lại.')
  if (code === 'auth/popup-blocked') throw new Error('Cho phép cửa sổ Google trong trình duyệt rồi thử lại.')
  if (code === 'auth/unauthorized-domain') throw new Error('Tên miền chưa được cho phép trong Firebase Authentication.')
  if (code === 'unavailable') throw new Error('Không kết nối được Firestore. Kiểm tra kết nối mạng.')
  throw error
}
const iso = (value: unknown): string => value && typeof (value as Timestamp).toDate === 'function' ? (value as Timestamp).toDate().toISOString() : typeof value === 'string' ? value : ''
function profile(snapshot: DocumentSnapshot<DocumentData>): UserProfile {
  const v = snapshot.data()!
  return { uid: snapshot.id, fullName: v.fullName, email: v.email, role: v.role, active: v.active, createdAt: iso(v.createdAt), updatedAt: iso(v.updatedAt) }
}
function task(snapshot: DocumentSnapshot<DocumentData>): MarketingTask {
  const v = snapshot.data()!
  const contributions = Object.fromEntries(Object.entries(v.contributions || {}).map(([uid, value]) => {
    const c = value as Contribution
    return [uid, { ...emptyContribution(), ...c, submittedAt: c.submittedAt ? iso(c.submittedAt) : null }]
  }))
  const review = (r?: StageReview) => ({ ...emptyReview(), ...r, reviewedAt: r?.reviewedAt ? iso(r.reviewedAt) : null })
  const { thumbnailUrl: _removedThumbnail, ...contentInfo } = v.contentInfo || {}
  return { ...v, id: snapshot.id, sku: v.sku || '', skuNumber: v.skuNumber ?? null, contentInfo: { ...emptyContentInfo(), ...contentInfo }, scriptReview: review(v.scriptReview), mediaReview: review(v.mediaReview), contributions, deadlineAt: iso(v.deadlineAt), createdAt: iso(v.createdAt), updatedAt: iso(v.updatedAt), completedAt: v.completedAt ? iso(v.completedAt) : null } as MarketingTask
}
async function currentUser(): Promise<UserProfile> {
  const { auth, db } = services()
  await auth.authStateReady()
  if (!auth.currentUser) throw new ApiError('Vui lòng đăng nhập.', 401)
  const google = auth.currentUser
  try {
    const ref = doc(db, 'users', google.uid)
    await runTransaction(db, async tx => {
      if ((await tx.get(ref)).exists()) return
      tx.set(ref, { uid: google.uid, fullName: (google.displayName || google.email?.split('@')[0] || 'Nhân viên').slice(0, 120), email: google.email!.toLowerCase(), role: 'employee', active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    })
    const user = profile(await getDoc(ref))
    if (!['admin', 'manager', 'employee'].includes(user.role) || !user.active) throw new ApiError('Tài khoản đã bị khóa. Vui lòng liên hệ ADMIN.', 403)
    return user
  } catch (error) { message(error) }
}
async function requireManager() {
  const user = await currentUser()
  if (user.role === 'employee') throw new ApiError('Chỉ ADMIN hoặc quản lý được thực hiện thao tác này.', 403)
  return user
}
function taskQuery(user: UserProfile, period: string | null) {
  const constraints = []
  if (user.role === 'employee') constraints.push(where('assigneeUids', 'array-contains', user.uid))
  if (period) constraints.push(where('periodKey', '==', period))
  else constraints.push(where('status', 'in', ['todo', 'in_progress', 'needs_revision', 'waiting_review']))
  return query(collection(services().db, 'tasks'), ...constraints)
}
async function getTask(id: string) {
  const snapshot = await getDoc(doc(services().db, 'tasks', id))
  if (!snapshot.exists()) throw new ApiError('Không tìm thấy công việc.', 404)
  return task(snapshot)
}
function validateTask(data: TaskInput) {
  if (!data.title.trim() || data.title.trim().length > 180) throw new Error('Tên công việc cần có từ 1 đến 180 ký tự.')
  if (data.description.length > 5000) throw new Error('Mô tả tối đa 5.000 ký tự.')
  if (!data.deadlineAt || !Number.isFinite(Date.parse(data.deadlineAt))) throw new Error('Chọn ngày và giờ deadline hợp lệ.')
  if (!data.assignees.length || data.assignees.length > 8 || new Set(data.assignees.map(a => a.uid)).size !== data.assignees.length) throw new Error('Chọn từ 1 đến 8 nhân viên khác nhau.')
  if (!validLink(data.referenceUrl) || data.referenceUrl.length > 2000) throw new Error('Link tài liệu cần bắt đầu bằng https:// hoặc http://.')
  validateContentInfo(data.contentInfo)
}
function validateContentInfo(info: ContentInfo) {
  for (const key of ['pageName','videoType','contentLine','audience','campaign'] as const) if (typeof info[key] !== 'string' || info[key].length > 180) throw new Error('Thông tin nội dung tối đa 180 ký tự mỗi trường.')
  if (!Array.isArray(info.ageGroups) || info.ageGroups.length > 6 || new Set(info.ageGroups).size !== info.ageGroups.length || info.ageGroups.some(age => !ageOptions.includes(age))) throw new Error('Nhóm tuổi không hợp lệ.')
  if (typeof info.sourceUrl !== 'string' || info.sourceUrl.length > 2000 || !validLink(info.sourceUrl)) throw new Error('Link source cần là http:// hoặc https:// hợp lệ.')
  if (!['not_started','shooting','recorded'].includes(info.sourceStatus)) throw new Error('Trạng thái source không hợp lệ.')
}
async function assignmentsFor(data: TaskInput): Promise<Record<string, Assignment>> {
  const result: Record<string, Assignment> = {}
  for (const a of data.assignees) {
    const snapshot = await getDoc(doc(services().db, 'users', a.uid))
    if (!snapshot.exists() || !snapshot.data().active || snapshot.data().role !== 'employee') throw new Error('Chọn nhân viên đang hoạt động.')
    result[a.uid] = { fullName: snapshot.data().fullName, workRole: a.workRole }
  }
  return result
}
const editableFields = (data: TaskInput, assignments: Record<string, Assignment>) => ({
  title: data.title.trim(), description: data.description.trim(), taskType: data.taskType,
  referenceUrl: data.referenceUrl.trim(), assigneeUids: data.assignees.map(a => a.uid), assignments,
  deadlineAt: Timestamp.fromDate(new Date(data.deadlineAt)), periodKey: periodAt(data.deadlineAt),
  requiresPublishing: data.requiresPublishing,
  contentInfo: Object.fromEntries(Object.entries(data.contentInfo).map(([key,value]) => [key,typeof value === 'string' ? value.trim() : value])),
})
function newTaskFields(data: TaskInput, assignments: Record<string, Assignment>, actor: UserProfile, skuNumber: number) {
  return {
    ...editableFields(data, assignments), sku: skuFor(skuNumber), skuNumber,
    scriptReview: emptyReview(), mediaReview: emptyReview(),
    contributions: Object.fromEntries(data.assignees.map(a => [a.uid, emptyContribution()])), submittedUids: [],
    createdByUid: actor.uid, createdByName: actor.fullName, status: 'todo',
    publicationStatus: data.requiresPublishing ? 'not_scheduled' : 'not_applicable', plannedPublishDate: null,
    publishedDate: null, postUrl: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), completedAt: null,
  }
}
async function allocateSku(write: (tx: Transaction, counter: DocumentReference, firstValue: number) => Promise<void>) {
  const db = services().db, counter = doc(db, 'counters', 'taskSku')
  for (let attempt = 0; ; attempt++) {
    let previousValue: number | null = null
    try {
      await runTransaction(db, async tx => {
        previousValue = (await tx.get(counter)).data()?.value || 0
        await write(tx, counter, previousValue! + 1)
      })
      return
    } catch (error) {
      // Some Firestore evaluations reject a stale counter before the SDK reports a conflict.
      // Retry only a failed atomic write whose counter actually advanced; stable refs avoid duplicates.
      if (attempt < 3 && previousValue !== null && (error as {code?: string}).code === 'permission-denied') {
        const current = (await getDoc(counter)).data()?.value || 0
        if (current !== previousValue) continue
      }
      throw error
    }
  }
}
export const firebaseApi: DataApi = {
  async loginGoogle() {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try { await signInWithPopup(services().auth, provider); return { user: await currentUser() } } catch (error) { message(error) }
  },
  async logout() { await signOut(services().auth); return { ok: true } },
  async me() { return { user: await currentUser() } },
  async users() {
    await requireManager()
    try { return { users: (await getDocs(collection(services().db, 'users'))).docs.map(profile).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')) } } catch (error) { message(error) }
  },
  async updateUser(uid, data) {
    const actor = await currentUser()
    if (actor.role !== 'admin') throw new ApiError('Chỉ ADMIN được sửa nhân sự.', 403)
    if (uid === actor.uid && (!data.active || data.role !== 'admin')) throw new Error('Không thể tự khóa hoặc hạ quyền ADMIN đang đăng nhập.')
    try {
      const ref = doc(services().db, 'users', uid)
      await updateDoc(ref, { fullName: data.fullName.trim(), role: data.role, active: data.active, updatedAt: serverTimestamp() })
      return { user: profile(await getDoc(ref)) }
    } catch (error) { message(error) }
  },
  async tasks(period) {
    const user = await currentUser()
    try { return { tasks: (await getDocs(taskQuery(user, period))).docs.map(task).sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt)) } } catch (error) { message(error) }
  },
  async task(id) { await currentUser(); return { task: await getTask(id) } },
  watchTask(id, next, error) {
    return onSnapshot(doc(services().db,'tasks',id), snapshot => {
      if (snapshot.exists()) next(task(snapshot))
      else error(new Error('Không tìm thấy công việc.'))
    }, err => error(err))
  },
  watchTasks(user, period, next, error) {
    return onSnapshot(taskQuery(user, period), snapshot => next(snapshot.docs.map(task).sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt))), err => {
      try { message(err) } catch (e) { error(e as Error) }
    })
  },
  watchContentTasks(user, next, error) {
    if (user.role === 'employee') { error(new ApiError('Bảng nội dung dành cho ADMIN và quản lý.',403)); return () => {} }
    return onSnapshot(collection(services().db,'tasks'),snapshot => next(snapshot.docs.map(task)),err => error(err))
  },
  async createTask(data) {
    const actor = await requireManager(); validateTask(data)
    try {
      const assignments = await assignmentsFor(data)
      if (Date.parse(data.deadlineAt) <= Date.now()) throw new Error('Deadline của công việc mới cần ở tương lai.')
      const ref = doc(collection(services().db, 'tasks'))
      await allocateSku(async (tx, counter, skuNumber) => {
        tx.set(counter,{value:skuNumber,taskId:ref.id,updatedAt:serverTimestamp()})
        tx.set(ref, newTaskFields(data, assignments, actor, skuNumber))
      })
      return { task: task(await getDoc(ref)) }
    } catch (error) { message(error) }
  },
  async duplicateTask(id, count, deadlineAt) {
    const actor = await requireManager(); validateCopyCount(count)
    const db = services().db, refs = Array.from({ length: count }, () => doc(collection(db, 'tasks')))
    let firstNumber = 0
    try {
      await allocateSku(async (tx, counter, firstValue) => {
        const source = await tx.get(doc(db, 'tasks', id))
        if (!source.exists()) throw new Error('Không tìm thấy công việc mẫu.')
        const before = task(source), input = copyTaskInput(before, deadlineAt)
        validateTask(input)
        if (Date.parse(deadlineAt) <= Date.now()) throw new Error('Chọn deadline tương lai cho các bản mới.')
        // All profile reads precede writes; retrying the transaction cannot produce partial copies.
        for (const uid of before.assigneeUids) {
          const member = await tx.get(doc(db, 'users', uid))
          if (!member.exists() || !member.data().active || member.data().role !== 'employee') throw new Error('Task mẫu có nhân viên ngừng hoạt động. Cập nhật người được giao trước khi sao chép.')
        }
        tx.set(counter, { value: firstValue + count - 1, firstValue, taskIds: refs.map(ref => ref.id), taskId: refs[count - 1].id, updatedAt: serverTimestamp() })
        refs.forEach((ref, index) => tx.set(ref, newTaskFields(input, before.assignments, actor, firstValue + index)))
        firstNumber = firstValue
      })
      return { count, firstSku: skuFor(firstNumber), lastSku: skuFor(firstNumber + count - 1), periodKey: periodAt(deadlineAt) }
    } catch (error) { message(error) }
  },
  async updateTask(id, data) {
    await requireManager(); validateTask(data)
    try {
      const assignments = await assignmentsFor(data)
      const ref = doc(services().db, 'tasks', id)
      await runTransaction(services().db, async tx => {
        const snapshot = await tx.get(ref)
        if (!snapshot.exists()) throw new Error('Không tìm thấy công việc.')
        const before = task(snapshot)
        if (['done', 'cancelled'].includes(before.status)) throw new Error('Không thể sửa công việc đã hoàn thành hoặc hủy.')
        if (Date.parse(data.deadlineAt) <= Date.parse(before.createdAt)) throw new Error('Deadline phải sau thời điểm tạo công việc.')
        const contributions = Object.fromEntries(data.assignees.map(a => [a.uid, before.assignments[a.uid]?.workRole === a.workRole ? snapshot.data().contributions[a.uid] : { ...(snapshot.data().contributions[a.uid] || emptyContribution()), status: 'pending', submittedAt: null }]))
        tx.update(ref, {
          ...editableFields(data, assignments), contributions,
          submittedUids: before.submittedUids.filter(uid => data.assignees.some(a => a.uid === uid && a.workRole === before.assignments[uid].workRole)),
          publicationStatus: !data.requiresPublishing ? 'not_applicable' : before.publicationStatus === 'not_applicable' ? 'not_scheduled' : before.publicationStatus,
          plannedPublishDate: data.requiresPublishing ? before.plannedPublishDate : null,
          publishedDate: data.requiresPublishing ? before.publishedDate : null, postUrl: data.requiresPublishing ? before.postUrl : null, updatedAt: serverTimestamp(),
        })
      })
      return { task: await getTask(id) }
    } catch (error) { message(error) }
  },
  async renameTask(id, title) {
    await requireManager()
    if (!title.trim() || title.trim().length > 180) throw new Error('Tiêu đề cần có từ 1 đến 180 ký tự.')
    try {
      const ref = doc(services().db, 'tasks', id)
      await runTransaction(services().db, async tx => {
        const snapshot = await tx.get(ref)
        if (!snapshot.exists() || ['done', 'cancelled'].includes(snapshot.data().status)) throw new Error('Không thể sửa công việc đã đóng.')
        tx.update(ref, { title: title.trim(), updatedAt: serverTimestamp() })
      })
      return { task: await getTask(id) }
    } catch (error) { message(error) }
  },
  async report(id, data) {
    const actor = await currentUser()
    if (![data.scriptUrl, data.sourceUrl, data.mediaUrl].every(validLink)) throw new Error('Link cần bắt đầu bằng https:// hoặc http://.')
    if (data.title.length > 180 || data.note.length > 5000 || data.scriptUrl.length > 2000 || data.sourceUrl.length > 2000 || data.mediaUrl.length > 2000) throw new Error('Nội dung vượt giới hạn ký tự.')
    const ref = doc(services().db, 'tasks', id)
    try {
      const before = await getTask(id)
      if (!before.assigneeUids.includes(actor.uid)) throw new ApiError('Bạn chỉ được cập nhật phần việc được giao.', 403)
      if (['done', 'cancelled'].includes(before.status)) throw new Error('Công việc đã đóng.')
      if (!data.submit && before.contributions[actor.uid].status === 'submitted') throw new Error('Phần việc đã nộp. Dùng Nộp lại kết quả để cập nhật.')
      const role = before.assignments[actor.uid].workRole
      if (data.submit && (role === 'content' ? !data.title.trim() || !data.scriptUrl : role === 'media' ? !data.mediaUrl : !data.note.trim() && !data.scriptUrl && !data.sourceUrl && !data.mediaUrl)) throw new Error(role === 'content' ? 'Thêm tiêu đề và link kịch bản trước khi nộp.' : role === 'media' ? 'Thêm link media đã edit trước khi nộp.' : 'Thêm kết quả trước khi nộp.')
      // Only this member's map entry changes; atomic set operations preserve concurrent submissions.
      await updateDoc(ref, new FieldPath('contributions',actor.uid), {
        title:data.title.trim(),scriptUrl:data.scriptUrl.trim(),sourceUrl:data.sourceUrl.trim(),mediaUrl:data.mediaUrl.trim(),note:data.note.trim(),
        status:data.submit ? 'submitted' : 'working',submittedAt:data.submit ? serverTimestamp() : null,
      }, 'submittedUids', data.submit ? arrayUnion(actor.uid) : arrayRemove(actor.uid), 'updatedAt',serverTimestamp())
      return { task: await getTask(id) }
    } catch (error) { message(error) }
  },
  async ensureSkus(ids) {
    await requireManager()
    try {
      for (const id of ids) await allocateSku(async (tx, counter, skuNumber) => {
        const ref = doc(services().db,'tasks',id), snapshot = await tx.get(ref)
        if (!snapshot.exists() || snapshot.data().sku) return
        tx.set(counter,{value:skuNumber,taskId:id,updatedAt:serverTimestamp()})
        tx.update(ref,{sku:skuFor(skuNumber),skuNumber,updatedAt:serverTimestamp()})
      })
    } catch (error) { message(error) }
  },
  async updateContentInfo(id, changes) {
    await requireManager()
    try {
      const ref = doc(services().db,'tasks',id)
      await runTransaction(services().db,async tx => {
        const snapshot = await tx.get(ref)
        if (!snapshot.exists()) throw new Error('Không tìm thấy công việc.')
        const before = task(snapshot)
        if (before.status === 'cancelled') throw new Error('Công việc đã hủy.')
        const info = { ...before.contentInfo,...changes }; validateContentInfo(info)
        tx.update(ref,{contentInfo:info,updatedAt:serverTimestamp()})
      })
      return {task:await getTask(id)}
    } catch (error) { message(error) }
  },
  async reviewStage(id, stage, status) {
    const actor = await requireManager()
    try {
      const ref = doc(services().db,'tasks',id)
      await runTransaction(services().db,async tx => {
        const snapshot = await tx.get(ref)
        if (!snapshot.exists()) throw new Error('Không tìm thấy công việc.')
        const before = task(snapshot), members = stageMembers(before,stage)
        if (['done','cancelled'].includes(before.status)) throw new Error('Công việc đã đóng.')
        if (!members.length || members.some(uid => before.contributions[uid].status !== 'submitted')) throw new Error('Cần nộp đủ kết quả của phần việc này trước khi duyệt.')
        const next = status === 'needs_revision' ? { ...before,contributions:{...before.contributions} } : before
        if (status === 'needs_revision') for (const uid of members) next.contributions[uid] = { ...next.contributions[uid],status:'working',submittedAt:null }
        tx.update(ref,{
          [stage === 'script' ? 'scriptReview' : 'mediaReview']: {status,byUid:actor.uid,byName:actor.fullName,signature:stageSignature(next,stage),reviewedAt:serverTimestamp()},
          ...(status === 'needs_revision' ? {contributions:Object.fromEntries(Object.entries(snapshot.data().contributions).map(([uid,c]) => [uid,members.includes(uid) ? {...(c as object),status:'working',submittedAt:null} : c])),submittedUids:before.submittedUids.filter(uid => !members.includes(uid))} : {}),
          updatedAt:serverTimestamp(),
        })
      })
      return {task:await getTask(id)}
    } catch (error) { message(error) }
  },
  async review(id, status) {
    const actor = await requireManager()
    try {
      const ref = doc(services().db, 'tasks', id)
      await runTransaction(services().db, async tx => {
        const snapshot = await tx.get(ref)
        if (!snapshot.exists()) throw new Error('Không tìm thấy công việc.')
        const before = task(snapshot)
        if (['done', 'cancelled'].includes(before.status)) throw new Error('Công việc đã đóng.')
        if (status !== 'cancelled' && taskStatus(before) !== 'waiting_review') throw new Error('Cần tất cả nhân viên nộp kết quả trước khi duyệt.')
        const next = status === 'needs_revision' ? { ...before,contributions:Object.fromEntries(Object.entries(before.contributions).map(([uid,c]) => [uid,{...c,status:'working' as const,submittedAt:null}])) } : before
        const stageReviews = Object.fromEntries((['script','media'] as const).filter(stage => status !== 'cancelled' && stageMembers(before,stage).length).map(stage => [stage === 'script' ? 'scriptReview' : 'mediaReview',{status:status === 'done' ? 'approved' : 'needs_revision',byUid:actor.uid,byName:actor.fullName,signature:stageSignature(next,stage),reviewedAt:serverTimestamp()}]))
        tx.update(ref, { status, completedAt: status === 'done' ? serverTimestamp() : null,
          ...stageReviews,
          ...(status === 'needs_revision' ? { submittedUids: [], contributions: Object.fromEntries(Object.entries(snapshot.data().contributions).map(([uid, c]) => [uid, { ...(c as object), status: 'working', submittedAt: null }])) } : {}),
          updatedAt: serverTimestamp(),
        })
      })
      return { task: await getTask(id) }
    } catch (error) { message(error) }
  },
  async publish(id, data) {
    const actor = await currentUser()
    try {
      const ref = doc(services().db,'tasks',id)
      await runTransaction(services().db,async tx => {
        const snapshot = await tx.get(ref)
        if (!snapshot.exists()) throw new Error('Không tìm thấy công việc.')
        const before = task(snapshot), required = data.requiresPublishing ?? before.requiresPublishing
        if (actor.role === 'employee' && (!before.assigneeUids.includes(actor.uid) || required !== before.requiresPublishing)) throw new ApiError('Bạn chỉ được cập nhật lịch đăng của công việc được giao.', 403)
        if (before.status === 'cancelled') throw new Error('Công việc đã hủy.')
        if (required && !['scheduled', 'published'].includes(data.publicationStatus)) throw new Error('Chọn Đã lên lịch hoặc Đã đăng.')
        if (required && data.publicationStatus === 'published' && (!data.publishedDate || !data.postUrl || !validLink(data.postUrl) || data.postUrl.length > 2000)) throw new Error('Nhập ngày đăng và link bài đăng hợp lệ.')
        if (!required && data.requiresPublishing === undefined) throw new Error('Công việc không có lịch đăng.')
        const planned = data.plannedPublishDate === undefined ? before.plannedPublishDate : data.plannedPublishDate
        if (required && data.publicationStatus === 'scheduled' && !planned) throw new Error('Nhập ngày đăng dự kiến.')
        tx.update(ref,{requiresPublishing:required,plannedPublishDate:required ? planned : null,publicationStatus:required ? data.publicationStatus : 'not_applicable',publishedDate:required && data.publicationStatus === 'published' ? data.publishedDate : null,postUrl:required && data.publicationStatus === 'published' ? data.postUrl : null,updatedAt:serverTimestamp()})
      })
      return { task: await getTask(id) }
    } catch (error) { message(error) }
  },
}

