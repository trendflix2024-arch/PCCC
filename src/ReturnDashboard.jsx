import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const BRAND_OPTIONS = [
  { key: 'pyunhan', name: '편한인생연구소' },
  { key: 'fun',     name: 'FUN한인생연구소' },
  { key: 'cool',    name: '쿨한인생연구소' },
  { key: 'bbunhan', name: '뻔한인생연구소' },
]

const STATUS_TABS = [
  { key: '',          label: '전체',       desc: '등록된 모든 반품 항목' },
  { key: '회수중',    label: '회수중',     desc: '창고 회수 진행 중' },
  { key: '검수중',    label: '검수중',     desc: '입고 후 상태 검수 중' },
  { key: '재판매가능', label: '재판매가능', desc: '검수 완료, 재판매 가능 상태' },
  { key: '폐기예정',  label: '폐기예정',   desc: '재판매 불가, 폐기 대기 중' },
  { key: '처리완료',  label: '처리완료',   desc: '최종 처리 완료' },
]

const REASON_OPTIONS     = ['고객변심', '배송불가', '파손', '불량', '통관문제', '기타']
const ALL_STATUS         = STATUS_TABS.filter(t => t.key).map(t => t.key)
const RESOLUTION_OPTIONS = ['당근판매', '재고발송', '폐기']

const STATUS_BADGE = {
  '회수중':    'bg-blue-100 text-blue-700',
  '검수중':    'bg-amber-100 text-amber-700',
  '재판매가능': 'bg-green-100 text-green-700',
  '폐기예정':  'bg-red-100 text-red-700',
  '처리완료':  'bg-gray-100 text-gray-500',
}
const REASON_BADGE = {
  '고객변심': 'bg-sky-100 text-sky-700',
  '배송불가': 'bg-orange-100 text-orange-700',
  '파손':    'bg-red-100 text-red-700',
  '불량':    'bg-red-100 text-red-700',
  '통관문제': 'bg-purple-100 text-purple-700',
  '기타':    'bg-gray-100 text-gray-600',
}
const RESOLUTION_BADGE = {
  '당근판매': 'bg-orange-100 text-orange-700',
  '재고발송': 'bg-indigo-100 text-indigo-700',
  '폐기':    'bg-red-100 text-red-600',
}

const EMPTY_FORM = {
  product_name: '', brand: 'pyunhan', quantity: 1, product_url: '',
  order_id: '', return_reason: '고객변심',
  status: '회수중', purchase_cost: '', memo: '',
  has_defect: false, exterior_grade: 'A',
  checked_at: '', storage_location: '',
  sale_price: '', carrot_price: '', carrot_uploaded: false,
  resolution_type: '',
}

function brandName(key) { return BRAND_OPTIONS.find(b => b.key === key)?.name ?? key }
function fmtDate(str)   { return str ? str.slice(0, 10) : '-' }

export default function ReturnDashboard() {
  const [returns, setReturns]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [activeStatus, setActiveStatus] = useState('')
  const [filterBrand, setFilterBrand]   = useState('')
  const [searchQuery, setSearchQuery]   = useState('')
  const [selected, setSelected]         = useState([])
  const [bulkStatus, setBulkStatus]     = useState('')
  const [panelMode, setPanelMode]       = useState('none') // 'none' | 'add' | 'edit'
  const [formData, setFormData]         = useState(EMPTY_FORM)
  const [formError, setFormError]       = useState('')
  const [saving, setSaving]             = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [allPreviews, setAllPreviews]   = useState([]) // [{url, file}]
  const [imageIndex, setImageIndex]     = useState(0)
  const [lightbox, setLightbox]         = useState(null) // url | null

  const fetchReturns = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('returns').select('*').order('created_at', { ascending: false })
    if (!error) setReturns(data || [])
    else console.error('fetch error:', error)
    setLoading(false)
  }

  useEffect(() => { fetchReturns() }, [])

  const countOf = (s) => s === '' ? returns.length : returns.filter(r => r.status === s).length

  const filteredList = returns.filter(r => {
    if (activeStatus && r.status !== activeStatus) return false
    if (filterBrand   && r.brand  !== filterBrand)  return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (r.product_name?.toLowerCase().includes(q) ||
              r.order_id?.toLowerCase().includes(q) ||
              r.memo?.toLowerCase().includes(q))
    }
    return true
  })

  const isAllSelected = filteredList.length > 0 && filteredList.every(r => selected.includes(r.id))
  const toggleAll = () => {
    if (isAllSelected) setSelected(p => p.filter(id => !filteredList.find(r => r.id === id)))
    else setSelected(p => [...new Set([...p, ...filteredList.map(r => r.id)])])
  }
  const toggleOne = (id) =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const selectedInView = selected.filter(id => filteredList.find(r => r.id === id))

  const handleBulkStatusChange = async (newStatus) => {
    if (!newStatus || selected.length === 0) return
    setSaving(true)
    await supabase.from('returns').update({ status: newStatus }).in('id', selected)
    setSaving(false)
    await fetchReturns()
    setSelected([]); setBulkStatus('')
  }

  const buildPayload = (f) => ({
    product_name:     f.product_name.trim(),
    brand:            f.brand,
    quantity:         Number(f.quantity) || 1,
    product_url:      f.product_url?.trim() || null,
    order_id:         f.order_id?.trim() || null,
    return_reason:    f.return_reason,
    status:           f.status,
    purchase_cost:    f.purchase_cost !== '' && f.purchase_cost != null ? Number(f.purchase_cost) : null,
    memo:             f.memo?.trim() || null,
    has_defect:       f.has_defect ?? false,
    exterior_grade:   f.exterior_grade || null,
    checked_at:       f.checked_at || null,
    storage_location: f.storage_location?.trim() || null,
    sale_price:       f.sale_price !== '' && f.sale_price != null ? Number(f.sale_price) : null,
    carrot_price:     f.carrot_price !== '' && f.carrot_price != null ? Number(f.carrot_price) : null,
    carrot_uploaded:  f.carrot_uploaded ?? false,
    resolution_type:  f.resolution_type || null,
  })

  const set = (key, val) => setFormData(f => ({ ...f, [key]: val }))

  const addImages = (e) => {
    const files = Array.from(e.target.files)
    const newPreviews = files.map(file => ({ url: URL.createObjectURL(file), file }))
    setAllPreviews(prev => {
      const next = [...prev, ...newPreviews]
      setImageIndex(next.length - 1)
      return next
    })
  }
  const removeCurrentImage = () => {
    setAllPreviews(prev => {
      const next = prev.filter((_, i) => i !== imageIndex)
      setImageIndex(Math.max(0, imageIndex - 1))
      return next
    })
  }

  const openAdd = () => {
    setFormData(EMPTY_FORM); setFormError(''); setConfirmDelete(false)
    setAllPreviews([]); setImageIndex(0); setPanelMode('add')
  }
  const openEdit = (item) => {
    setFormData({ ...item }); setFormError(''); setConfirmDelete(false)
    setAllPreviews((item.image_urls || []).map(url => ({ url, file: null })))
    setImageIndex(0); setPanelMode('edit')
  }

  const handleSubmit = async () => {
    if (!formData.product_name.trim()) { setFormError('상품명을 입력해 주세요.'); return }
    setSaving(true); setFormError('')

    const uploadedUrls = []
    for (const preview of allPreviews) {
      if (preview.file) {
        const ext = preview.file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('returns').upload(fileName, preview.file)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('returns').getPublicUrl(fileName)
          uploadedUrls.push(urlData.publicUrl)
        }
      } else {
        uploadedUrls.push(preview.url)
      }
    }
    const payload = { ...buildPayload(formData), image_urls: uploadedUrls.length > 0 ? uploadedUrls : null }

    if (panelMode === 'add') {
      const { error } = await supabase.from('returns').insert(payload)
      if (error) { setFormError('저장 오류: ' + error.message); setSaving(false); return }
      setPanelMode('none')
    } else {
      const { error } = await supabase.from('returns').update(payload).eq('id', formData.id)
      if (error) { setFormError('저장 오류: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    setAllPreviews(uploadedUrls.map(url => ({ url, file: null })))
    setImageIndex(0)
    await fetchReturns()
  }

  const handleDelete = async () => {
    setSaving(true)
    await supabase.from('returns').delete().eq('id', formData.id)
    setSaving(false)
    setConfirmDelete(false)
    setPanelMode('none')
    setSelected(p => p.filter(id => id !== formData.id))
    await fetchReturns()
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Admin</p>
            <h1 className="text-xl font-bold text-gray-900">반품 재고 관리 대시보드</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.location.href = '/admin'}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              ← 통관 관리로
            </button>
            <button onClick={fetchReturns}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              ↻ 새로고침
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-4 pb-4 w-full flex-1 flex flex-col min-h-0">
        {/* 상태 탭 */}
        <div className="flex gap-0 border-b border-gray-200 mb-4 flex-shrink-0">
          {STATUS_TABS.map(tab => (
            <button key={tab.key}
              onClick={() => { setActiveStatus(tab.key); setSelected([]) }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeStatus === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeStatus === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
              }`}>{countOf(tab.key)}</span>
            </button>
          ))}
        </div>

        {/* 툴바 */}
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="상품명 / 주문번호 검색..."
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-52" />
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">전체 브랜드</option>
              {BRAND_OPTIONS.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
            </select>
            <p className="text-sm text-gray-500">
              {selectedInView.length > 0
                ? <span className="text-indigo-600 font-medium">{selectedInView.length}건 선택됨</span>
                : `총 ${filteredList.length}건`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedInView.length > 0 && (
              <select value={bulkStatus} onChange={e => handleBulkStatusChange(e.target.value)}
                disabled={saving}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">상태 일괄변경...</option>
                {ALL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
              + 반품 등록
            </button>
          </div>
        </div>

        {/* Split pane */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* 왼쪽: 리스트 */}
          <div style={{flex: 3}} className="min-w-0 bg-white border border-gray-200 rounded-xl overflow-auto">
            {loading ? (
              <div className="py-16 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                불러오는 중...
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                {returns.length === 0 ? '등록된 반품 항목이 없습니다.' : '검색 결과가 없습니다.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="w-10 px-4 py-3 text-left">
                      <input type="checkbox" checked={isAllSelected} onChange={toggleAll}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">상품명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">브랜드</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">반품사유</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">처리상태</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">처리방법</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">등록일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredList.map(item => (
                    <tr key={item.id}
                      onClick={() => openEdit(item)}
                      className={`cursor-pointer transition-colors ${
                        panelMode === 'edit' && formData.id === item.id
                          ? 'bg-indigo-50'
                          : 'hover:bg-gray-50'
                      }`}>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.includes(item.id)}
                          onChange={() => toggleOne(item.id)}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[220px]">
                        <span title={item.product_name} className="block truncate">{item.product_name}</span>
                        {item.order_id && (
                          <span className="block text-xs font-mono text-gray-400">{item.order_id}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{brandName(item.brand)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REASON_BADGE[item.return_reason] ?? 'bg-gray-100 text-gray-600'}`}>
                          {item.return_reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.resolution_type
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RESOLUTION_BADGE[item.resolution_type] ?? 'bg-gray-100 text-gray-500'}`}>{item.resolution_type}</span>
                          : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 오른쪽: 상세 패널 */}
          {panelMode !== 'none' ? (
            <div style={{flex: 2}} className="min-w-0 bg-white border border-gray-200 rounded-xl flex flex-col min-h-0">
              {/* 패널 헤더 */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm font-bold text-gray-900">
                  {panelMode === 'add' ? '반품 항목 등록' : '반품 항목 수정'}
                </h3>
                <button onClick={() => setPanelMode('none')}
                  className="text-gray-300 hover:text-gray-500 text-xl leading-none transition-colors">×</button>
              </div>

              {/* 폼 */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

                {/* 상단 2열: 텍스트 필드 | 이미지 */}
                <div style={{display:'flex', gap:'12px', alignItems:'stretch'}}>
                  {/* 왼쪽: 기본 필드 */}
                  <div style={{flex:1, display:'flex', flexDirection:'column', gap:'0'}}>
                    <FormRow label="브랜드" required>
                      <select value={formData.brand} onChange={e => set('brand', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                        {BRAND_OPTIONS.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
                      </select>
                    </FormRow>
                    <FormRow label="품목명" required>
                      <input type="text" value={formData.product_name}
                        onChange={e => set('product_name', e.target.value)}
                        placeholder="예: 프로젝터 / 나이키 에어포스 270mm"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                    </FormRow>
                    <FormRow label="반품 사유" required>
                      <select value={formData.return_reason} onChange={e => set('return_reason', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                        {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </FormRow>
                    <FormRow label="수량" required>
                      <input type="number" min={1} value={formData.quantity}
                        onChange={e => set('quantity', e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                    </FormRow>
                  </div>
                  {/* 오른쪽: 이미지 캐러셀 */}
                  <div style={{flex:1, display:'flex', flexDirection:'column'}}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">이미지</label>
                    <div style={{position:'relative', width:'100%', aspectRatio:'1'}}>
                      {allPreviews.length > 0 ? (
                        <>
                          {/* 현재 이미지 (클릭 시 확대) */}
                          <img src={allPreviews[imageIndex].url} alt="상품 이미지"
                            onClick={() => setLightbox(allPreviews[imageIndex].url)}
                            style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', objectFit:'cover', borderRadius:'8px', border:'1px solid #e5e7eb', cursor:'zoom-in'}} />
                          {/* 삭제 */}
                          <button onClick={removeCurrentImage}
                            style={{position:'absolute', top:'6px', right:'6px', background:'white', borderRadius:'50%', width:'22px', height:'22px', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', color:'#9ca3af', fontSize:'14px', cursor:'pointer', border:'none', zIndex:2}}>
                            ×
                          </button>
                          {/* 좌우 화살표 */}
                          {imageIndex > 0 && (
                            <button onClick={() => setImageIndex(i => i - 1)}
                              style={{position:'absolute', left:'6px', top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.85)', border:'none', borderRadius:'50%', width:'26px', height:'26px', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2}}>
                              ‹
                            </button>
                          )}
                          {imageIndex < allPreviews.length - 1 && (
                            <button onClick={() => setImageIndex(i => i + 1)}
                              style={{position:'absolute', right:'6px', top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.85)', border:'none', borderRadius:'50%', width:'26px', height:'26px', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2}}>
                              ›
                            </button>
                          )}
                          {/* 장 수 표시 + 추가 버튼 */}
                          <div style={{position:'absolute', bottom:'6px', left:'6px', right:'6px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <span style={{background:'rgba(0,0,0,0.45)', color:'white', borderRadius:'4px', padding:'1px 6px', fontSize:'11px'}}>
                              {imageIndex + 1} / {allPreviews.length}
                            </span>
                            <label style={{background:'rgba(255,255,255,0.85)', borderRadius:'4px', padding:'2px 8px', fontSize:'12px', color:'#6b7280', cursor:'pointer'}}>
                              <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={addImages} />
                              + 추가
                            </label>
                          </div>
                        </>
                      ) : (
                        <label style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'2px dashed #e5e7eb', borderRadius:'8px', cursor:'pointer', gap:'4px'}}>
                          <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={addImages} />
                          <span style={{fontSize:'24px', color:'#d1d5db'}}>📷</span>
                          <span style={{fontSize:'12px', color:'#9ca3af'}}>이미지 업로드</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* 라이트박스 */}
                {lightbox && (
                  <div onClick={() => setLightbox(null)}
                    style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out'}}>
                    <img src={lightbox} alt="확대"
                      style={{maxWidth:'90vw', maxHeight:'90vh', objectFit:'contain', borderRadius:'8px'}} />
                    <button onClick={() => setLightbox(null)}
                      style={{position:'absolute', top:'20px', right:'24px', background:'none', border:'none', color:'white', fontSize:'32px', cursor:'pointer', lineHeight:1}}>
                      ×
                    </button>
                  </div>
                )}

                <FormRow label="하자 여부" required>
                  <div className="flex gap-3">
                    {[{ val: false, label: 'X  없음' }, { val: true, label: 'O  있음' }].map(opt => (
                      <label key={String(opt.val)}
                        className={`flex-1 flex items-center justify-center py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                          formData.has_defect === opt.val
                            ? opt.val ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-400 bg-gray-100 text-gray-700'
                            : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                        }`}>
                        <input type="radio" name="has_defect" className="sr-only"
                          checked={formData.has_defect === opt.val}
                          onChange={() => set('has_defect', opt.val)} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </FormRow>

                <FormRow label="외관 상태">
                  <div className="flex gap-3">
                    {[
                      { g: 'A', label: '양호', cls: 'border-green-400 bg-green-50 text-green-700' },
                      { g: 'B', label: '보통', cls: 'border-amber-400 bg-amber-50 text-amber-700' },
                      { g: 'C', label: '불량', cls: 'border-red-400 bg-red-50 text-red-700' },
                    ].map(({ g, label, cls }) => (
                      <label key={g}
                        className={`flex-1 flex items-center justify-center py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                          formData.exterior_grade === g ? cls : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                        }`}>
                        <input type="radio" name="exterior_grade" className="sr-only"
                          checked={formData.exterior_grade === g}
                          onChange={() => set('exterior_grade', g)} />
                        <span className="font-bold mr-1">{g}</span>{label}
                      </label>
                    ))}
                  </div>
                </FormRow>

                <FormRow label="확인날짜">
                  <input type="date" value={formData.checked_at || ''}
                    onChange={e => set('checked_at', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                </FormRow>

                <FormRow label="보관장소">
                  <input type="text" value={formData.storage_location || ''}
                    onChange={e => set('storage_location', e.target.value)}
                    placeholder="예: A창고 3번 선반"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                </FormRow>

                <FormRow label="처리상태" required>
                  <select value={formData.status} onChange={e => set('status', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                    {ALL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormRow>

                <FormRow label="처리방법">
                  <select value={formData.resolution_type} onChange={e => set('resolution_type', e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                    <option value="">미정</option>
                    {RESOLUTION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormRow>

                <FormRow label="판매가격 (KRW)">
                  <input type="number" min={0} value={formData.sale_price}
                    onChange={e => set('sale_price', e.target.value)}
                    placeholder="선택 입력"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                </FormRow>

                <FormRow label="당근 업로드 가격 (KRW)">
                  <input type="number" min={0} value={formData.carrot_price}
                    onChange={e => set('carrot_price', e.target.value)}
                    placeholder="선택 입력"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                </FormRow>

                <FormRow label="당근 업로드 여부">
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input type="checkbox" checked={formData.carrot_uploaded}
                      onChange={e => set('carrot_uploaded', e.target.checked)}
                      className="w-4 h-4 accent-orange-500 cursor-pointer" />
                    <span className={`text-sm ${formData.carrot_uploaded ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                      {formData.carrot_uploaded ? '업로드 완료' : '미업로드'}
                    </span>
                  </label>
                </FormRow>

                <FormRow label="매입원가 (KRW)">
                  <input type="number" min={0} value={formData.purchase_cost}
                    onChange={e => set('purchase_cost', e.target.value)}
                    placeholder="선택 입력"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                </FormRow>

                <FormRow label="원 주문번호">
                  <input type="text" value={formData.order_id || ''}
                    onChange={e => set('order_id', e.target.value)}
                    placeholder="선택 입력"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                </FormRow>

                <FormRow label="구매처 URL">
                  <input type="text" value={formData.product_url || ''}
                    onChange={e => set('product_url', e.target.value)}
                    placeholder="선택 입력"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
                </FormRow>

                <FormRow label="특이사항">
                  <textarea rows={3} value={formData.memo || ''}
                    onChange={e => set('memo', e.target.value)}
                    placeholder="특이사항 입력 (선택)"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                </FormRow>

                {formError && <p className="text-xs text-red-500">{formError}</p>}
              </div>

              {/* 패널 푸터 */}
              <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
                {panelMode === 'edit' && (
                  <div className="mb-3">
                    {confirmDelete ? (
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-red-500">정말 삭제하시겠습니까?</span>
                        <button onClick={handleDelete} disabled={saving}
                          className="text-xs text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-50">확인</button>
                        <button onClick={() => setConfirmDelete(false)}
                          className="text-xs text-gray-400 px-2 py-1 rounded border border-gray-200">취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(true)}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded border border-gray-200 hover:border-red-200 transition-colors">
                        삭제
                      </button>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setPanelMode('none')}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                    취소
                  </button>
                  <button onClick={handleSubmit} disabled={saving}
                    className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {saving ? '저장 중...' : panelMode === 'add' ? '등록' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{flex: 2}} className="min-w-0 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-center">
              <p className="text-sm text-gray-400 leading-relaxed">
                항목을 클릭하면<br/>상세 정보를 수정할 수 있습니다
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FormRow({ label, required, children }) {
  return (
    <div style={{paddingBottom: '10px'}}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
