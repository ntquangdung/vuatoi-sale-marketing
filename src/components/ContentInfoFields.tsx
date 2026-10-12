import { sourceLabels, videoTypes } from '../utils/content'
import type { ContentInfo, SourceStatus } from '../types'

export function ContentInfoFields({ value, change }: { value: ContentInfo; change: (value: ContentInfo) => void }) {
  function field<K extends keyof ContentInfo>(key: K, next: ContentInfo[K]) { change({ ...value, [key]: next }) }
  return <>
    <div className="form-grid">
      <label>Tên Page<input maxLength={180} value={value.pageName} onChange={e => field('pageName',e.target.value)} placeholder="VUA TỎI" /></label>
      <label>Loại video<select value={videoTypes.includes(value.videoType) ? value.videoType : ''} onChange={e => field('videoType',e.target.value)}><option value="" disabled>Chọn loại video</option>{videoTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
      <label>Chiến dịch / Sản phẩm<input maxLength={180} value={value.campaign} onChange={e => field('campaign',e.target.value)} placeholder="Ví dụ: Tỏi cô đơn Lý Sơn" /></label>
      <label>Trạng thái source<select value={value.sourceStatus} onChange={e => field('sourceStatus',e.target.value as SourceStatus)}>{Object.entries(sourceLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
  </>
}
