import { describe, expect, it } from 'vitest'
import { emptyContentInfo, emptyReview, skuFor, stageSignature, stageState } from './content'
import { emptyContribution } from './tasks'
import type { MarketingTask } from '../types'

function task(): MarketingTask {
  return { id:'task',sku:'vuatoi.0001',skuNumber:1,title:'Video',description:'',taskType:'video',referenceUrl:'',contentInfo:emptyContentInfo(),scriptReview:emptyReview(),mediaReview:emptyReview(),
    assigneeUids:['content','media'],submittedUids:['content'],assignments:{content:{fullName:'Content',workRole:'content'},media:{fullName:'Media',workRole:'media'}},
    contributions:{content:{...emptyContribution(),title:'Tỏi Lý Sơn',scriptUrl:'https://example.com/script',status:'submitted',submittedAt:'2026-10-10T01:00:00.000Z'},media:emptyContribution()},
    createdByUid:'admin',createdByName:'Admin',status:'todo',priority:'normal',deadlineAt:'2026-10-10T05:00:00Z',durationHours:24,periodKey:'2026-10',requiresPublishing:false,publicationStatus:'not_applicable',plannedPublishDate:null,publishedDate:null,postUrl:null,createdAt:'2026-10-09T05:00:00Z',updatedAt:'',completedAt:null }
}
function approve(t: MarketingTask, stage:'script'|'media') { t[stage==='script'?'scriptReview':'mediaReview']={status:'approved',byUid:'admin',byName:'Admin',signature:stageSignature(t,stage),reviewedAt:'2026-10-10T02:00:00.000Z'} }
describe('SKU và duyệt theo từng phần việc',()=>{
  it('SKU giữ dãy tăng liên tục khi vượt 9999',()=>{
    expect(skuFor(1)).toBe('vuatoi.0001');expect(skuFor(9999)).toBe('vuatoi.9999');expect(skuFor(10000)).toBe('vuatoi.10000');expect(()=>skuFor(0)).toThrow()
  })
  it('duyệt kịch bản khi Media vẫn đang làm',()=>{
    const t=task();approve(t,'script');expect(stageState(t,'script')).toBe('approved');expect(stageState(t,'media')).toBe('not_submitted')
  })
  it('nộp lại hoặc sửa link sau duyệt phải chờ duyệt mới',()=>{
    const t=task();approve(t,'script');t.contributions.content.scriptUrl='https://example.com/new';expect(stageState(t,'script')).toBe('pending')
    const same=task();approve(same,'script');same.contributions.content.submittedAt='2026-10-10T03:00:00.000Z';expect(stageState(same,'script')).toBe('pending')
  })
  it('kết quả Content thay đổi không hạ duyệt Media',()=>{
    const t=task();t.contributions.media={...emptyContribution(),mediaUrl:'https://example.com/edit',status:'submitted',submittedAt:'2026-10-10T02:00:00.000Z'};approve(t,'media')
    t.contributions.content.title='Tiêu đề mới';expect(stageState(t,'media')).toBe('approved')
    t.contributions.media.mediaUrl='https://example.com/edit-2';expect(stageState(t,'media')).toBe('pending')
  })
  it('yêu cầu sửa giữ trạng thái cho đến khi nộp lại',()=>{
    const t=task();t.contributions.content.status='working';t.contributions.content.submittedAt=null
    t.scriptReview={status:'needs_revision',byUid:'admin',byName:'Admin',signature:stageSignature(t,'script'),reviewedAt:'2026-10-10T02:00:00Z'}
    expect(stageState(t,'script')).toBe('needs_revision');t.contributions.content.status='submitted';t.contributions.content.submittedAt='2026-10-10T03:00:00Z';expect(stageState(t,'script')).toBe('pending')
  })
  it('thêm Content mới cần người đó nộp trước khi duyệt lại',()=>{
    const t=task();approve(t,'script');t.assigneeUids.push('new');t.assignments.new={fullName:'New',workRole:'content'};t.contributions.new=emptyContribution();expect(stageState(t,'script')).toBe('not_submitted')
  })
})
