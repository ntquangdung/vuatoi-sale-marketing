export const boardColumns = [
  ['page','Tên Page',175],['content','Content',145],['video','Loại video',160],['campaign','Chiến dịch / Sản phẩm',185],
  ['title','Caption',310],['script','Link kịch bản',190],['scriptReview','Trạng thái kịch bản',160],['source','SOURCE',145],['sourceLink','Link source',190],
  ['media','Media',145],['mediaLink','Link media',190],['reviewer','Kiểm duyệt media',150],['mediaReview','Trạng thái media',160],['publication','Đăng Page chính',170],
  ['publishDate','Ngày đăng',140],['postUrl','Link bài đăng',180],['deadline','Deadline',180],['status','Công việc',160],
] as const

export type BoardColumn = typeof boardColumns[number][0]
export type ResizableColumn = BoardColumn | 'sku'
export type ColumnPlacement = 'before' | 'after'
export interface BoardLayout { order: BoardColumn[]; hidden: BoardColumn[]; widths: Partial<Record<ResizableColumn,number>> }
export const columnWidthLimits = { min:110, max:800 }
const columnIds = boardColumns.map(([id])=>id)
const isColumn = (id:unknown):id is BoardColumn => typeof id==='string'&&columnIds.includes(id as BoardColumn)

export function clampColumnWidth(width:number) { return Math.round(Math.min(columnWidthLimits.max,Math.max(columnWidthLimits.min,width))) }
export function defaultColumnWidth(id:ResizableColumn):number { return id==='sku'?154:boardColumns.find(c=>c[0]===id)![2] }
export function columnWidth(layout:BoardLayout,id:ResizableColumn) { return layout.widths[id] ?? defaultColumnWidth(id) }
export function defaultBoardLayout():BoardLayout { return {order:[...columnIds],hidden:[],widths:{}} }

export function normalizeBoardLayout(value:unknown,legacyHidden:unknown=[]):BoardLayout {
  const saved=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
  const order=Array.isArray(saved.order)?[...new Set(saved.order.filter(isColumn))]:[]
  const hidden=Array.isArray(saved.hidden)?saved.hidden:legacyHidden
  const widths:BoardLayout['widths']={}
  if(saved.widths&&typeof saved.widths==='object') for(const id of [...columnIds,'sku'] as ResizableColumn[]) {
    const width=(saved.widths as Record<string,unknown>)[id]
    if(typeof width==='number'&&Number.isFinite(width)) widths[id]=clampColumnWidth(width)
  }
  return {order:[...order,...columnIds.filter(id=>!order.includes(id))],hidden:Array.isArray(hidden)?[...new Set(hidden.filter(isColumn))]:[],widths}
}

export function moveBoardColumn(layout:BoardLayout,from:BoardColumn,target:BoardColumn,placement:ColumnPlacement):BoardLayout {
  if(from===target||!layout.order.includes(from)||!layout.order.includes(target)) return layout
  const order=layout.order.filter(id=>id!==from)
  order.splice(order.indexOf(target)+(placement==='after'?1:0),0,from)
  return {...layout,order}
}
