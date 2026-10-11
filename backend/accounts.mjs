import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { loginEmail, roleForPosition, validateAccount } from '../shared/accounts.mjs'

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
export async function assertAccountReady(db) {
  // Prevent partially migrating a real ADMIN before Email/Password and the new
  // access rules have been deployed. This marker is written by the deploy operator.
  if (!(await db.doc('system/accountAuth').get()).data()?.ready) throw new HttpError(503,'Đăng nhập tài khoản đang chờ kích hoạt. Vui lòng thử lại sau khi ADMIN hoàn tất thiết lập hệ thống.')
}
export async function authorize(auth, db, token, migration = false, allowManager = false) {
  if (!token) throw new HttpError(401, 'Vui lòng đăng nhập.')
  let decoded
  try { decoded = await auth.verifyIdToken(token, true) } catch { throw new HttpError(401, 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.') }
  const profile = await db.doc(`users/${decoded.uid}`).get()
  const user = profile.data()
  if (!user?.active || user.archived || !(allowManager ? ['admin','manager'].includes(user.role) : user.role === 'admin')) throw new HttpError(403, 'Bạn không có quyền thực hiện thao tác này.')
  const block = await db.doc(`employeeAccess/${user.email}`).get()
  if (block.exists && !block.data().active) throw new HttpError(403, 'Tài khoản đã bị thu hồi quyền.')
  if (decoded.firebase?.sign_in_provider !== 'password' && !(migration && !user.username && decoded.firebase?.sign_in_provider === 'google.com')) throw new HttpError(403, 'Thiết lập tài khoản mật khẩu trước khi quản lý nhân sự.')
  return { ...user, uid: decoded.uid }
}
export async function manageAccount({ auth, db }, actor, input) {
  const migrating = input.action === 'migrate'
  const uid = migrating ? actor.uid : input.uid || null
  let before = null
  if (uid) {
    before = (await db.doc(`users/${uid}`).get()).data()
    if (!before) throw new HttpError(404, 'Không tìm thấy nhân sự.')
    if (before.archived) throw new HttpError(409, 'Khôi phục nhân sự từ mục Đã xóa trước khi sửa tài khoản.')
  }
  let data
  try { data = validateAccount(input, !before?.username) } catch (e) { throw new HttpError(400, e.message) }
  // A legacy ADMIN keeps their authority during the one-time credential setup.
  const position = migrating ? 'admin' : data.position, role = roleForPosition(position)
  if (uid === actor.uid && role !== 'admin') throw new HttpError(400, 'Không thể tự hạ quyền ADMIN đang đăng nhập.')
  if (before?.username && data.username !== before.username) throw new HttpError(400, 'Tài khoản đã cấp không đổi tên đăng nhập. Có thể đổi mật khẩu, mức lương và vị trí.')
  const email = loginEmail(data.username), targetUid = uid || randomUUID(), nameRef = db.doc(`loginNames/${data.username}`)
  const lockRef=db.doc(`accountLocks/${targetUid}`), operation=randomUUID()
  // Reserve usernames transactionally. A retry for the same UID is safe; other UIDs cannot claim it.
  await db.runTransaction(async tx => {
    const reserved = await tx.get(nameRef)
    const lock=await tx.get(lockRef)
    const current=(await tx.get(db.doc(`users/${targetUid}`))).data()
    if (reserved.exists && reserved.data().uid !== targetUid) throw new HttpError(409, 'Tên tài khoản đã được sử dụng.')
    if(current?.username && current.username!==data.username) throw new HttpError(409,'Tài khoản vừa được cấp. Mở lại hồ sơ nhân sự.')
    if(lock.exists && lock.data().expiresAt.toMillis()>Date.now()) throw new HttpError(409,'Tài khoản đang được cập nhật. Vui lòng thử lại sau.')
    tx.set(nameRef, { uid: targetUid, updatedAt: FieldValue.serverTimestamp() })
    tx.set(lockRef,{operation,expiresAt:Timestamp.fromMillis(Date.now()+300000)})
  })
  let created = false, committed = false
  try {
    if (before) await auth.updateUser(targetUid, { email, ...(data.password ? { password: data.password } : {}), displayName: data.fullName, disabled: true, providersToUnlink: ['google.com'] })
    else { await auth.createUser({ uid: targetUid, email, password: data.password, displayName: data.fullName, disabled: true }); created = true }
    const timestamp = FieldValue.serverTimestamp(), auditRef=db.doc(`accountAudit/${randomUUID()}`)
    await db.runTransaction(async tx=>{
      const current=(await tx.get(db.doc(`users/${targetUid}`))).data()
      if(current?.username && current.username!==data.username) throw new HttpError(409,'Tài khoản vừa được cập nhật. Mở lại hồ sơ nhân sự.')
      if(before && current?.role !== before.role) throw new HttpError(409,'Vai trò vừa được cập nhật. Mở lại hồ sơ nhân sự trước khi lưu.')
      tx.set(db.doc(`users/${targetUid}`), { uid: targetUid, fullName: data.fullName, email, username: data.username, position, role, active: current?.active ?? true, ...(before?.email && before.email !== email ? { contactEmail: before.contactEmail || before.email } : {}), createdAt: current?.createdAt || timestamp, updatedAt: timestamp }, { merge: true })
      tx.set(db.doc(`staffSalary/${targetUid}`), { amount: data.salary, currency: 'VND', period: 'month', updatedAt: timestamp, updatedBy: actor.uid })
      tx.set(db.doc(`employeeAccess/${email}`), { uid: targetUid, email, active: current?.active ?? true, updatedAt: timestamp })
      tx.set(auditRef, { action: migrating ? 'migrate' : before ? 'update' : 'create', actorUid: actor.uid, targetUid, position, role, passwordChanged: Boolean(data.password), at: timestamp })
    }); committed = true
    // Access is controlled by the retained Firestore profile. Restoring access must
    // not require recreating an Auth identity (which would lose assignment history).
    await auth.updateUser(targetUid, { disabled: false })
    if (data.password && before) await auth.revokeRefreshTokens(targetUid)
    return { uid: targetUid, username: data.username }
  } catch (error) {
    if (!committed) {
      if (created) await auth.deleteUser(targetUid).catch(() => {})
      if (!before) await nameRef.delete().catch(() => {})
    }
    // If Auth changed but the profile transaction failed, allow the ADMIN to sign
    // in with the just-entered password and finish setup on the same retained UID.
    if(before) await auth.updateUser(targetUid,{disabled:false}).catch(()=>{})
    if (error instanceof HttpError) throw error
    if (error.code === 'auth/email-already-exists') throw new HttpError(409, 'Tên tài khoản đã được sử dụng.')
    throw new HttpError(503, before || committed ? 'Cập nhật chưa hoàn tất. Thử lưu lại; nếu phiên đã hết hạn, đăng nhập bằng tài khoản và mật khẩu vừa nhập để hoàn tất.' : 'Chưa cấp được tài khoản. Vui lòng thử lại.')
  } finally {
    await db.runTransaction(async tx=>{const lock=await tx.get(lockRef);if(lock.data()?.operation===operation)tx.delete(lockRef)}).catch(()=>{})
  }
}
