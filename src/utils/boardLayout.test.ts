import { describe, expect, it } from 'vitest'
import { boardColumns, columnWidth, defaultBoardLayout, moveBoardColumn, normalizeBoardLayout } from './boardLayout'

describe('Bố cục bảng nội dung cá nhân',()=>{
  it('kéo cột sang trái hoặc phải và giữ vị trí các cột khác',()=>{
    const original=defaultBoardLayout()
    const moved=moveBoardColumn(original,'title','page','before')
    expect(moved.order.slice(0,5)).toEqual(['title','page','content','video','campaign'])
    expect(moveBoardColumn(moved,'title','campaign','after').order).toEqual(original.order)
    expect(original.order[0]).toBe('page')
    expect(moveBoardColumn(original,'page','page','after')).toBe(original)
  })
  it('ẩn cột vẫn giữ thứ tự khi kéo và khi hiện lại',()=>{
    const layout={...defaultBoardLayout(),hidden:['content' as const]}
    const moved=moveBoardColumn(layout,'video','page','before')
    expect(moved.order.slice(0,3)).toEqual(['video','page','content'])
    expect(moved.hidden).toEqual(['content'])
  })
  it('đọc bố cục đã lưu, bỏ cột cũ và bổ sung cột mới mà không trùng',()=>{
    const layout=normalizeBoardLayout({order:['title','age','page','title'],hidden:['age','media','media'],widths:{title:420,sku:180}})
    expect(layout.order.slice(0,2)).toEqual(['title','page'])
    expect(new Set(layout.order).size).toBe(boardColumns.length)
    expect(layout.hidden).toEqual(['media'])
    expect(normalizeBoardLayout(JSON.parse(JSON.stringify(layout)))).toEqual(layout)
    expect(columnWidth(layout,'title')).toBe(420)
    expect(columnWidth(layout,'sku')).toBe(180)
  })
  it('giới hạn độ rộng để cột không biến mất hoặc làm vỡ bảng',()=>{
    const layout=normalizeBoardLayout({widths:{title:10000,page:1,media:NaN,content:174.6,unknown:200}})
    expect(layout.widths).toEqual({title:800,page:110,content:175})
    expect(columnWidth(layout,'media')).toBe(145)
  })
  it('giữ các cột đã ẩn từ bản trước và phục hồi dữ liệu lưu không hợp lệ',()=>{
    expect(normalizeBoardLayout(null,['source','age']).hidden).toEqual(['source'])
    expect(normalizeBoardLayout({order:'invalid',hidden:false,widths:null})).toEqual(defaultBoardLayout())
  })
})
