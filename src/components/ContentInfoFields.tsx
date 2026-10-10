import { ageOptions, sourceLabels } from '../utils/content'
import type { ContentInfo, SourceStatus } from '../types'

export function ContentInfoFields({ value, change }: { value: ContentInfo; change: (value: ContentInfo) => void }) {
  function field<K extends keyof ContentInfo>(key: K, next: ContentInfo[K]) { change({ ...value, [key]: next }) }
  return <>
    <div className="form-grid">
      <label>Tên Page<input maxLength={180} value={value.pageName} onChange={e => field('pageName',e.target.value)} placeholder="VUA TỎI" /></label>
      <label>Loại video<input maxLength={180} list="video-types" value={value.videoType} onChange={e => field('videoType',e.target.value)} placeholder="Giới thiệu sản phẩm, giáo dục…" /><datalist id="video-types"><option>Giới thiệu sản phẩm</option><option>Giáo dục</option><option>Feedback khách hàng</option><option>Hậu trường</option><option>Giải trí</option></datalist></label>
      <label>Tuyến nội dung<input maxLength={180} value={value.contentLine} onChange={e => field('contentLine',e.target.value)} placeholder="Ví dụ: Tỏi Lý Sơn / Kiến thức" /></label>
      <label>Đối tượng<input maxLength={180} value={value.audience} onChange={e => field('audience',e.target.value)} placeholder="Khách hàng mục tiêu" /></label>
      <label>Chiến dịch / Sản phẩm<input maxLength={180} value={value.campaign} onChange={e => field('campaign',e.target.value)} placeholder="Ví dụ: Tỏi cô đơn Lý Sơn" /></label>
      <label>Trạng thái source<select value={value.sourceStatus} onChange={e => field('sourceStatus',e.target.value as SourceStatus)}>{Object.entries(sourceLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <fieldset className="age-picker"><legend>Độ tuổi mục tiêu</legend>{ageOptions.map(age => <label key={age}><input type="checkbox" checked={value.ageGroups.includes(age)} onChange={e => field('ageGroups',e.target.checked ? [...value.ageGroups,age] : value.ageGroups.filter(v => v !== age))} /><span>{age}</span></label>)}</fieldset>
  </>
}
