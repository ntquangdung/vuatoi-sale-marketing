import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { boardColumns, clampColumnWidth, columnWidth, columnWidthLimits, defaultColumnWidth, moveBoardColumn, normalizeBoardLayout, type BoardColumn, type BoardLayout, type ColumnPlacement, type ResizableColumn } from '../utils/boardLayout'

type DropTarget = { id:BoardColumn; placement:ColumnPlacement }
type Gesture = { pointerId:number; startX:number; x:number; y:number } & (
  {kind:'move';id:BoardColumn;startY:number;active:boolean;target:DropTarget|null} |
  {kind:'resize';id:ResizableColumn;startWidth:number;width:number}
)
const labelFor = (id:ResizableColumn) => id==='sku'?'SKU / Tháng':boardColumns.find(c=>c[0]===id)![1]
function readLayout(uid:string) {
  let saved:unknown,legacy:unknown
  try { saved=JSON.parse(localStorage.getItem(`mkt-board-layout:${uid}`)||'null') } catch { /* Use defaults if browser storage is unavailable. */ }
  try { legacy=JSON.parse(localStorage.getItem(`mkt-board-columns:${uid}`)||'[]') } catch { /* Ignore invalid legacy preferences. */ }
  return normalizeBoardLayout(saved,legacy)
}

export function useBoardLayout(uid:string) {
  const [stored,setStored]=useState(()=>({uid,layout:readLayout(uid)}))
  const [storageWarning,setStorageWarning]=useState(''),[announcement,setAnnouncement]=useState('')
  const [gesture,setGesture]=useState<Gesture|null>(null)
  const gestureRef=useRef<Gesture|null>(null),scrollRef=useRef<HTMLDivElement>(null)
  const layout=stored.uid===uid?stored.layout:readLayout(uid)
  useEffect(()=>{if(stored.uid!==uid)setStored({uid,layout:readLayout(uid)})},[uid,stored.uid])
  useEffect(()=>{
    if(stored.uid!==uid) return
    try { localStorage.setItem(`mkt-board-layout:${uid}`,JSON.stringify(stored.layout));setStorageWarning('') }
    catch { setStorageWarning('Trình duyệt chưa lưu được bố cục. Thay đổi chỉ áp dụng trong lần mở này.') }
  },[stored,uid])
  const changeLayout=useCallback((change:(value:BoardLayout)=>BoardLayout)=>{
    setStored(current=>({uid,layout:normalizeBoardLayout(change(current.uid===uid?current.layout:readLayout(uid)))}))
  },[uid])
  const showGesture=useCallback((next:Gesture|null)=>{gestureRef.current=next;setGesture(next)},[])
  const cancelGesture=useCallback(()=>showGesture(null),[showGesture])
  const targetAt=useCallback((x:number,y:number):DropTarget|null=>{
    const board=scrollRef.current
    if(!board) return null
    const bounds=board.getBoundingClientRect(),left=bounds.left+48+columnWidth(layout,'sku')
    if(y<bounds.top-40||y>bounds.bottom||x<bounds.left-40||x>bounds.right+40) return null
    const headers=Array.from(board.querySelectorAll<HTMLElement>('th[data-board-column]')).map(header=>({id:header.dataset.boardColumn as BoardColumn,rect:header.getBoundingClientRect()})).filter(h=>h.rect.right>left&&h.rect.left<bounds.right)
    const point=Math.max(left,Math.min(x,bounds.right-1))
    const header=headers.find(h=>point<h.rect.right)||headers.at(-1)
    return header?{id:header.id,placement:point<header.rect.left+header.rect.width/2?'before':'after'}:null
  },[layout])
  function beginMove(event:PointerEvent<HTMLElement>,id:BoardColumn) {
    if(event.button!==0) return
    event.currentTarget.focus({preventScroll:true})
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId)
    showGesture({kind:'move',id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false,target:null})
  }
  function beginResize(event:PointerEvent<HTMLElement>,id:ResizableColumn) {
    if(event.button!==0) return
    event.currentTarget.focus({preventScroll:true})
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId)
    const width=columnWidth(layout,id)
    showGesture({kind:'resize',id,pointerId:event.pointerId,startX:event.clientX,x:event.clientX,y:event.clientY,startWidth:width,width})
  }
  function movePointer(event:PointerEvent<HTMLElement>) {
    const current=gestureRef.current
    if(!current||event.pointerId!==current.pointerId) return
    if(current.kind==='resize') showGesture({...current,x:event.clientX,y:event.clientY,width:clampColumnWidth(current.startWidth+event.clientX-current.startX)})
    else {
      const active=current.active||Math.hypot(event.clientX-current.startX,event.clientY-current.startY)>5
      showGesture({...current,x:event.clientX,y:event.clientY,active,target:active?targetAt(event.clientX,event.clientY):null})
    }
  }
  function endPointer(event:PointerEvent<HTMLElement>) {
    const current=gestureRef.current
    if(!current||event.pointerId!==current.pointerId) return
    if(current.kind==='resize') {
      changeLayout(value=>({...value,widths:{...value.widths,[current.id]:current.width}}))
      setAnnouncement(`${labelFor(current.id)}: độ rộng ${current.width} pixel.`)
    } else if(current.active&&current.target) {
      const target=current.target
      changeLayout(value=>moveBoardColumn(value,current.id,target.id,target.placement))
      setAnnouncement(`Đã chuyển cột ${labelFor(current.id)} ${target.placement==='before'?'trước':'sau'} cột ${labelFor(target.id)}.`)
    }
    showGesture(null)
    if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  // Scroll the table while a column is held near either edge, including off-screen columns.
  const moving=gesture?.kind==='move'&&gesture.active
  useEffect(()=>{
    if(!moving) return
    let frame=0
    function tick() {
      const current=gestureRef.current,board=scrollRef.current
      if(!current||current.kind!=='move'||!board) return
      const bounds=board.getBoundingClientRect(),left=bounds.left+48+columnWidth(layout,'sku'),edge=42
      let speed=0
      if(current.y>=bounds.top-40&&current.y<=bounds.bottom) {
        if(current.x<left+edge) speed=-Math.min(18,Math.max(0,(left+edge-current.x)/3))
        else if(current.x>bounds.right-edge) speed=Math.min(18,(current.x-bounds.right+edge)/3)
      }
      const before=board.scrollLeft
      if(speed) board.scrollLeft+=speed
      if(board.scrollLeft!==before) showGesture({...current,target:targetAt(current.x,current.y)})
      frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(frame)
  },[moving,layout,targetAt,showGesture])
  const interacting=gesture!==null
  useEffect(()=>{
    if(!interacting) return
    const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();cancelGesture()}}
    window.addEventListener('keydown',escape);window.addEventListener('blur',cancelGesture)
    return ()=>{window.removeEventListener('keydown',escape);window.removeEventListener('blur',cancelGesture)}
  },[interacting,cancelGesture])
  useEffect(()=>cancelGesture(),[uid,cancelGesture])
  function moveColumn(id:BoardColumn,direction:-1|1,includeHidden=false) {
    const ordered=includeHidden?layout.order:layout.order.filter(key=>!layout.hidden.includes(key)),index=ordered.indexOf(id),target=ordered[index+direction]
    if(!target) return
    changeLayout(value=>moveBoardColumn(value,id,target,direction<0?'before':'after'))
    setAnnouncement(`Đã chuyển cột ${labelFor(id)} ${direction<0?'sang trái':'sang phải'}.`)
  }
  function resizeKey(event:KeyboardEvent<HTMLElement>,id:ResizableColumn) {
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
    event.preventDefault()
    const step=event.shiftKey?50:10
    const width=clampColumnWidth(event.key==='Home'?defaultColumnWidth(id):event.key==='End'?columnWidthLimits.max:columnWidth(layout,id)+(event.key==='ArrowLeft'?-step:step))
    changeLayout(value=>({...value,widths:{...value.widths,[id]:width}}))
    setAnnouncement(`${labelFor(id)}: độ rộng ${width} pixel.`)
  }
  const displayLayout=gesture?.kind==='resize'?{...layout,widths:{...layout.widths,[gesture.id]:gesture.width}}:layout
  return {layout:displayLayout,changeLayout,scrollRef,gesture,beginMove,beginResize,movePointer,endPointer,cancelGesture,moveColumn,resizeKey,storageWarning,announcement}
}
