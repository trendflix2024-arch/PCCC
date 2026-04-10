import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const BRAND_OPTIONS = [
  { key: 'pyunhan', name: '편한인생연구소' },
  { key: 'fun',     name: 'FUN한인생연구소' },
  { key: 'cool',    name: '쿨한인생연구소' },
  { key: 'bbunhan', name: '뻔한인생연구소' },
]

const STATUS_TABS = [
  { key: '',          label: '전체',      desc: '등록된 모든 반품 항목' },
  { key: '회수중',    label: '회수중',    desc: '창고 회수 진행 중' },
  { key: '검수중',    label: '검수중',    desc: '입고 후 상태 검수 중' },
  { key: '재판매가능', label: '재판매가능', desc: '검수 완료, 재판매 가능 상태' },
  { key: '폐기예정',  label: '폐기예정',  desc: '재판매 불가, 폐기 대기 중' },
  { key: '처리완료',  label: '처리완료',  desc: '최종 처리 완료' },
]

const REASON_OPTIONS    = ['고객변심', '배송불가', '파손', '불량', '통관문제', '기타']
const CONDITION_OPTIONS = ['미개봉', '개봉양호', '개봉파손', '불량']
const ALL_STATUS        = STATUS_TABS.filter(t => t.key).map(t => t.key)
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
const GRADE_BADGE = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-amber-100 text-amber-700',
  C: 'bg-red-100 text-red-700',
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

function brandName(key) {
  return BRAND_OPTIONS.find(b => b.key === key)?.name ?? key
}
function fmtDate(str) {
  return str ? str.slice(0, 10) : '-'
}
function fmtKRW(v) {
  if (v == null || v === '') return '-'
  return '₩' + Number(v).toLocaleString('ko-KR')
}

export default function ReturnDashboard() {
  const [returns, setReturns]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [activeStatus, setActiveStatus] = useState('')
  const [filterBrand, setFilterBrand]   = useState('')
  const [searchQuery, setSearchQuery]   = useState('')
  const [selected, setSelected]         = useState([])
  const [bulkStatus, setBulkStatus]     = useState('')
  const [addOpen, setAddOpen]           = useState(false)
  const [addForm, setAddForm]           = useState(EMPTY_FORM)
  const [addError, setAddError]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [editOpen, setEditOpen]         = useState(false)
  const [editItem, setEditItem]         = useState(null)
  const [editError, setEditError]       = useState('')
  const [editingMemo, setEditingMemo]   = useState(null)
  const [deletingId, setDeletingId]     = useState(null)

  const fetchReturns = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('returns')
      .select('*')
      .order('created_at', { ascending: false })
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
    product_name:    f.product_name.trim(),
    brand:           f.brand,
    quantity:        Number(f.quantity) || 1,
    product_url:     f.product_url?.trim() || null,
    order_id:        f.order_id?.trim() || null,
    return_reason:   f.return_reason,
    status:          f.status,
    purchase_cost:   f.purchase_cost !== '' && f.purchase_cost != null ? Number(f.purchase_cost) : null,
    memo:            f.memo?.trim() || null,
    has_defect:        f.has_defect ?? false,
    exterior_grade:    f.exterior_grade || null,
    checked_at:        f.checked_at || null,
    storage_location:  f.storage_location?.trim() || null,
    sale_price:      f.sale_price !== '' && f.sale_price != null ? Number(f.sale_price) : null,
    carrot_price:    f.carrot_price !== '' && f.carrot_price != null ? Number(f.carrot_price) : null,
    carrot_uploaded: f.carrot_uploaded ?? false,
    resolution_type: f.resolution_type || null,
  })

  const handleAddSubmit = async () => {
    if (!addForm.product_name.trim()) { setAddError('상품명을 입력해 주세요.'); return }
    setSaving(true); setAddError('')
    const { error } = await supabase.from('returns').insert(buildPayload(addForm))
    setSaving(false)
    if (error) { setAddError('저장 오류: ' + error.message); return }
    setAddOpen(false); setAddForm(EMPTY_FORM)
    await fetchReturns()
  }

  const handleEditSubmit = async () => {
    if (!editItem.product_name?.trim()) { setEditError('상품명을 입력해 주세요.'); return }
    setSaving(true); setEditError('')
    const { error } = await supabase.from('returns').update(buildPayload(editItem)).eq('id', editItem.id)
    setSaving(false)
    if (error) { setEditError('저장 오류: ' + error.message); return }
    setEditOpen(false); setEditItem(null)
    await fetchReturns()
  }

  const handleDelete = async (id) => {
    await supabase.from('returns').delete().eq('id', id)
    setDeletingId(null); await fetchReturns()
  }

  const saveMemo = async (id, value) => {
    await supabase.from('returns').update({ memo: value || null }).eq('id', id)
    setReturns(p => p.map(r => r.id === id ? { ...r, memo: value || null } : r))
    setEditingMemo(null)
  }

  const currentDesc = STATUS_TABS.find(t => t.key === activeStatus)?.desc ?? ''

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
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

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* 상태 탭 */}
        <div className="flex gap-0 border-b border-gray-200 mb-5">
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

        <p className="text-xs text-gray-400 mb-3">{currentDesc}</p>

        {/* 툴바 */}
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="상품명 / 주문번호 검색..."
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white w-56" />
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
            <button onClick={() => { setAddForm(EMPTY_FORM); setAddError(''); setAddOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
              + 반품 등록
            </button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-10 px-4 py-3 text-left">
                      <input type="checkbox" checked={isAllSelected} onChange={toggleAll}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">상품명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">브랜드</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">반품사유</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">하자</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">외관</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">보관장소</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">처리상태</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">처리방법</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">판매가</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">당근가</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">등록일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">액션</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[150px]">메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredList.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.includes(item.id)}
                          onChange={() => toggleOne(item.id)}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                      </td>
                      {/* 상품명 */}
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px]">
                        <span title={item.product_name} className="block truncate">{item.product_name}</span>
                        {item.product_url && (
                          <a href={item.product_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-indigo-500 hover:underline">구매처 링크</a>
                        )}
                        {item.order_id && (
                          <span className="block text-xs font-mono text-gray-400">{item.order_id}</span>
                        )}
                      </td>
                      {/* 브랜드 */}
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{brandName(item.brand)}</td>
                      {/* 반품사유 */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REASON_BADGE[item.return_reason] ?? 'bg-gray-100 text-gray-600'}`}>
                          {item.return_reason}
                        </span>
                      </td>
                      {/* 하자 여부 */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-bold ${item.has_defect ? 'text-red-500' : 'text-gray-400'}`}>
                          {item.has_defect ? 'O' : 'X'}
                        </span>
                      </td>
                      {/* 외관 등급 */}
                      <td className="px-4 py-3 text-center">
                        {item.exterior_grade ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${GRADE_BADGE[item.exterior_grade] ?? 'bg-gray-100 text-gray-500'}`}>
                            {item.exterior_grade}
                          </span>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      {/* 보관장소 */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {item.storage_location || <span className="text-gray-300">-</span>}
                      </td>
                      {/* 처리상태 */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {item.status}
                        </span>
                      </td>
                      {/* 처리방법 */}
                      <td className="px-4 py-3">
                        {item.resolution_type ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RESOLUTION_BADGE[item.resolution_type] ?? 'bg-gray-100 text-gray-500'}`}>
                            {item.resolution_type}
                            {item.resolution_type === '당근판매' && item.carrot_uploaded && (
                              <span className="ml-1 text-xs opacity-60">업로드됨</span>
                            )}
                          </span>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      {/* 판매가 */}
                      <td className="px-4 py-3 text-right text-xs text-gray-600 whitespace-nowrap font-mono">
                        {fmtKRW(item.sale_price)}
                      </td>
                      {/* 당근가 */}
                      <td className="px-4 py-3 text-right text-xs text-orange-600 whitespace-nowrap font-mono">
                        {fmtKRW(item.carrot_price)}
                      </td>
                      {/* 등록일 */}
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(item.created_at)}</td>
                      {/* 액션 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => { setEditItem({ ...item }); setEditError(''); setEditOpen(true) }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 transition-colors mr-1">
                          수정
                        </button>
                        {deletingId === item.id ? (
                          <span className="inline-flex gap-1">
                            <button onClick={() => handleDelete(item.id)}
                              className="text-xs text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-50">확인</button>
                            <button onClick={() => setDeletingId(null)}
                              className="text-xs text-gray-400 px-2 py-1 rounded border border-gray-200">취소</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeletingId(item.id)}
                            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded border border-gray-200 hover:border-red-200 transition-colors">
                            삭제
                          </button>
                        )}
                      </td>
                      {/* 메모 */}
                      <td className="px-3 py-3 relative w-[150px]" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setEditingMemo(editingMemo?.id === item.id ? null : { id: item.id, value: item.memo || '' })}
                          className={`text-xs text-left w-full rounded-lg px-2.5 py-1.5 border transition-colors truncate ${
                            item.memo
                              ? 'border-amber-200 bg-amber-50 text-gray-700 hover:bg-amber-100'
                              : 'border-dashed border-gray-200 text-gray-300 hover:border-gray-300 hover:text-gray-400'
                          }`} title={item.memo || ''}>
                          {item.memo || '+ 메모 추가'}
                        </button>
                        {editingMemo?.id === item.id && (
                          <div className="absolute z-50 top-full right-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3">
                            <textarea autoFocus rows={4} value={editingMemo.value}
                              onChange={e => setEditingMemo({ id: item.id, value: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Escape') setEditingMemo(null) }}
                              placeholder="메모를 입력하세요"
                              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-indigo-400 resize-none" />
                            <div className="flex justify-between items-center mt-2">
                              <button onClick={() => saveMemo(item.id, '')} className="text-xs text-gray-300 hover:text-red-400">삭제</button>
                              <div className="flex gap-2">
                                <button onClick={() => setEditingMemo(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">취소</button>
                                <button onClick={() => saveMemo(item.id, editingMemo.value)} className="text-xs bg-indigo-500 text-white rounded-lg px-3 py-1 hover:bg-indigo-600">저장</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 등록 모달 */}
      {addOpen && (
        <ReturnModal
          title="반품 항목 등록"
          form={addForm} setForm={setAddForm}
          error={addError} saving={saving}
          onSubmit={handleAddSubmit}
          onClose={() => setAddOpen(false)}
          submitLabel="등록"
        />
      )}

      {/* 수정 모달 */}
      {editOpen && editItem && (
        <ReturnModal
          title="반품 항목 수정"
          form={editItem} setForm={setEditItem}
          error={editError} saving={saving}
          onSubmit={handleEditSubmit}
          onClose={() => { setEditOpen(false); setEditItem(null) }}
          submitLabel="저장"
        />
      )}
    </div>
  )
}

/* ── 등록/수정 공용 모달 ── */
function ReturnModal({ title, form, setForm, error, saving, onSubmit, onClose, submitLabel }) {
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
        </div>
        <div className="px-6 py-5 space-y-6">

          <FormRow label="브랜드" required>
            <select value={form.brand} onChange={e => set('brand', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              {BRAND_OPTIONS.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
            </select>
          </FormRow>

          <FormRow label="품목명" required>
            <input type="text" value={form.product_name}
              onChange={e => set('product_name', e.target.value)}
              placeholder="예: 프로젝터 / 나이키 에어포스 270mm"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
          </FormRow>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="반품 사유" required>
              <select value={form.return_reason} onChange={e => set('return_reason', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormRow>
            <FormRow label="수량" required>
              <input type="number" min={1} value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormRow>
          </div>

          <FormRow label="하자 여부" required>
            <div className="flex gap-3">
              {[{ val: false, label: 'X  없음' }, { val: true, label: 'O  있음' }].map(opt => (
                <label key={String(opt.val)}
                  className={`flex-1 flex items-center justify-center py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                    form.has_defect === opt.val
                      ? opt.val ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-400 bg-gray-100 text-gray-700'
                      : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}>
                  <input type="radio" name="has_defect" className="sr-only"
                    checked={form.has_defect === opt.val}
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
                    form.exterior_grade === g ? cls : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}>
                  <input type="radio" name="exterior_grade" className="sr-only"
                    checked={form.exterior_grade === g}
                    onChange={() => set('exterior_grade', g)} />
                  <span className="font-bold mr-1">{g}</span>{label}
                </label>
              ))}
            </div>
          </FormRow>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="확인날짜">
              <input type="date" value={form.checked_at || ''}
                onChange={e => set('checked_at', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
            </FormRow>
            <FormRow label="보관장소">
              <input type="text" value={form.storage_location || ''}
                onChange={e => set('storage_location', e.target.value)}
                placeholder="예: A창고 3번 선반"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="처리상태" required>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                {ALL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormRow>
            <FormRow label="처리방법">
              <select value={form.resolution_type} onChange={e => set('resolution_type', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">미정</option>
                {RESOLUTION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="판매가격 (KRW)">
              <input type="number" min={0} value={form.sale_price}
                onChange={e => set('sale_price', e.target.value)}
                placeholder="선택 입력"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormRow>
            <FormRow label="당근 업로드 가격 (KRW)">
              <input type="number" min={0} value={form.carrot_price}
                onChange={e => set('carrot_price', e.target.value)}
                placeholder="선택 입력"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="매입원가 (KRW)">
              <input type="number" min={0} value={form.purchase_cost}
                onChange={e => set('purchase_cost', e.target.value)}
                placeholder="선택 입력"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormRow>
            <FormRow label="당근 업로드 여부">
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input type="checkbox" checked={form.carrot_uploaded}
                  onChange={e => set('carrot_uploaded', e.target.checked)}
                  className="w-4 h-4 accent-orange-500 cursor-pointer" />
                <span className={`text-sm ${form.carrot_uploaded ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                  {form.carrot_uploaded ? '업로드 완료' : '미업로드'}
                </span>
              </label>
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="원 주문번호">
              <input type="text" value={form.order_id || ''}
                onChange={e => set('order_id', e.target.value)}
                placeholder="선택 입력"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormRow>
            <FormRow label="구매처 URL">
              <input type="text" value={form.product_url || ''}
                onChange={e => set('product_url', e.target.value)}
                placeholder="선택 입력"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300" />
            </FormRow>
          </div>

          <FormRow label="특이사항">
            <textarea rows={3} value={form.memo || ''}
              onChange={e => set('memo', e.target.value)}
              placeholder="특이사항 입력 (선택)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </FormRow>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
            취소
          </button>
          <button onClick={onSubmit} disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? '저장 중...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormRow({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-2">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
