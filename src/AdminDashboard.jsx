import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const TABS = [
  { key: 'waiting',          label: '대기중',   desc: '알림톡 발송 완료, 고객 미제출' },
  { key: 'pending_resubmit', label: '접수완료', desc: '고객 수정 제출 완료, 배대지 재접수 필요' },
  { key: 'done',             label: '처리완료', desc: '배대지 재접수 처리 완료' },
]

const BRAND_OPTIONS = [
  { key: 'pyunhan', name: '편한인생연구소' },
  { key: 'cool',    name: '쿨한인생연구소' },
  { key: 'bbunhan', name: '뻔한인생연구소' },
]

function nowStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('pending_resubmit')
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [addOpen, setAddOpen]     = useState(false)
  const [addForm, setAddForm]     = useState({ id: '', name: '', phone: '', brand: 'pyunhan', seller: '' })
  const [addError, setAddError]   = useState('')
  const [smsResult, setSmsResult] = useState(null)   // null | { ok, message }
  const [saving, setSaving]       = useState(false)
  const [deletingId, setDeletingId] = useState(null)  // 삭제 확인 중인 행 ID
  const [copiedId, setCopiedId]   = useState(null)    // 복사 완료 표시용

  const fetchOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('registered_at', { ascending: false })
    if (!error) setOrders(data || [])
    else console.error('fetch error:', error)
    setLoading(false)
  }

  useEffect(() => { fetchOrders() }, [])

  const waitingList = orders.filter(o => o.status === 'waiting')
  const pendingList = orders.filter(o => o.status === 'pending_resubmit')
  const doneList    = orders.filter(o => o.status === 'done')
  const currentList = activeTab === 'waiting' ? waitingList
                    : activeTab === 'pending_resubmit' ? pendingList
                    : doneList

  const countOf = (key) =>
    key === 'waiting' ? waitingList.length
    : key === 'pending_resubmit' ? pendingList.length
    : doneList.length

  const isAllSelected = currentList.length > 0 && currentList.every(o => selected.includes(o.id))
  const toggleAll = () => {
    if (isAllSelected) setSelected(prev => prev.filter(id => !currentList.find(o => o.id === id)))
    else setSelected(prev => [...new Set([...prev, ...currentList.map(o => o.id)])])
  }
  const toggleOne = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const selectedInTab = selected.filter(id => currentList.find(o => o.id === id))

  // 고객 추가 (대기중) + 알리고 SMS 발송
  const handleAddSubmit = async () => {
    if (!addForm.id.trim() || !addForm.name.trim() || !addForm.phone.trim()) {
      setAddError('모든 항목을 입력해 주세요.')
      return
    }
    setSaving(true)
    setSmsResult(null)

    const brandName = BRAND_OPTIONS.find(b => b.key === addForm.brand)?.name ?? addForm.brand

    const { error } = await supabase.from('orders').insert({
      id:            addForm.id.trim(),
      name:          addForm.name.trim(),
      phone:         addForm.phone.trim(),
      status:        'waiting',
      registered_at: nowStr(),
    })
    if (error) {
      setSaving(false)
      setAddError(error.code === '23505' ? '이미 존재하는 주문번호입니다.' : `저장 오류: ${error.message} (${error.code})`)
      return
    }

    // 알리고 SMS 발송
    try {
      const smsRes = await fetch('/api/send-sms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          phone:     addForm.phone.trim(),
          orderId:   addForm.id.trim(),
          brandName,
          brandKey:  addForm.brand,
          seller:    addForm.seller.trim(),
        }),
      })
      const smsData = await smsRes.json()
      setSmsResult(smsData)
    } catch (e) {
      setSmsResult({ ok: false, message: 'SMS 요청 실패: ' + e.message })
    }

    setSaving(false)
    await fetchOrders()
  }

  // 대기중 행 삭제
  const handleDelete = async (id) => {
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (!error) { await fetchOrders(); setDeletingId(null) }
  }

  // 고객 링크 복사
  const copyLink = (order) => {
    const url = `https://pccc-six.vercel.app/?orderId=${encodeURIComponent(order.id)}&token=ok`
    navigator.clipboard.writeText(url)
    setCopiedId(order.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // 접수완료 → 처리완료
  const handleMarkDone = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('orders')
      .update({ status: 'done' })
      .in('id', selectedInTab)
    setSaving(false)
    if (error) { console.error(error); return }
    await fetchOrders()
    setSelected([])
    setConfirmOpen(false)
  }

  // CSV 다운로드
  const downloadCSV = () => {
    const rows = [
      ['주문번호', '수령인', '연락처', '통관부호(PCCC)', '우편번호', '수정일시'],
      ...pendingList.map(o => [o.id, o.name, o.phone ?? '-', o.pccc ?? '-', o.zipcode ?? '-', o.updated_at ?? '-']),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }))
    a.download = `접수완료_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Admin</p>
            <h1 className="text-xl font-bold text-gray-900">통관 지연 관리 대시보드</h1>
          </div>
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ↻ 새로고침
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* 탭 */}
        <div className="flex gap-0 border-b border-gray-200 mb-5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelected([]) }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {countOf(tab.key)}
              </span>
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 mb-3">{TABS.find(t => t.key === activeTab)?.desc}</p>

        {/* 툴바 */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            {activeTab === 'pending_resubmit' && selectedInTab.length > 0
              ? <span className="text-indigo-600 font-medium">{selectedInTab.length}건 선택됨</span>
              : `총 ${currentList.length}건`}
          </p>
          <div className="flex gap-2">
            {activeTab === 'waiting' && (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700
                           text-white text-sm font-medium rounded-lg transition-colors"
              >
                + 고객 추가
              </button>
            )}
            {activeTab === 'pending_resubmit' && (
              <>
                <button
                  onClick={downloadCSV}
                  disabled={pendingList.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700
                             text-white text-sm font-medium rounded-lg transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ⬇ 엑셀 다운로드
                </button>
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={selectedInTab.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700
                             text-white text-sm font-medium rounded-lg transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ✓ 선택 건 처리완료
                </button>
              </>
            )}
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
              불러오는 중...
            </div>
          ) : currentList.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">항목이 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {activeTab === 'pending_resubmit' && (
                    <th className="w-10 px-4 py-3 text-left">
                      <input type="checkbox" checked={isAllSelected} onChange={toggleAll}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">주문번호</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">수령인</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">연락처</th>
                  {activeTab !== 'waiting' && (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">통관부호 (PCCC)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">우편번호</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {activeTab === 'waiting' ? '등록일시' : activeTab === 'pending_resubmit' ? '수정일시' : '처리일시'}
                  </th>
                  {activeTab === 'waiting' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">액션</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentList.map(order => {
                  const isChecked = selected.includes(order.id)
                  return (
                    <tr
                      key={order.id}
                      onClick={() => activeTab === 'pending_resubmit' && toggleOne(order.id)}
                      className={`transition-colors ${activeTab === 'pending_resubmit' ? 'cursor-pointer' : ''}
                        ${isChecked ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    >
                      {activeTab === 'pending_resubmit' && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleOne(order.id)}
                            className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs">{order.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{order.name}</td>
                      <td className="px-4 py-3 text-gray-600">{order.phone ?? '-'}</td>
                      {activeTab !== 'waiting' && (
                        <>
                          <td className="px-4 py-3 font-mono text-gray-700 tracking-wider text-xs">{order.pccc ?? '-'}</td>
                          <td className="px-4 py-3 font-mono text-gray-700">{order.zipcode ?? '-'}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-gray-500">
                        {order.registered_at ?? order.updated_at ?? '-'}
                      </td>
                      {activeTab === 'waiting' && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {deletingId === order.id ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <span className="text-gray-500">삭제?</span>
                              <button onClick={() => handleDelete(order.id)}
                                className="text-red-600 font-medium hover:underline">확인</button>
                              <button onClick={() => setDeletingId(null)}
                                className="text-gray-400 hover:underline">취소</button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <button
                                onClick={() => copyLink(order)}
                                className="text-xs text-indigo-500 hover:text-indigo-700"
                                title="고객 링크 복사"
                              >
                                {copiedId === order.id ? '복사됨 ✓' : '링크복사'}
                              </button>
                              <button
                                onClick={() => setDeletingId(order.id)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                삭제
                              </button>
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 고객 추가 모달 */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
          onClick={() => { if (!smsResult) { setAddOpen(false); setAddError('') } }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>

            {/* SMS 발송 결과 화면 */}
            {smsResult ? (
              <>
                <div className={`rounded-xl p-4 mb-5 text-center ${smsResult.ok ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-2xl mb-2`}>{smsResult.ok ? '✓' : '✗'}</p>
                  <p className={`text-sm font-semibold ${smsResult.ok ? 'text-green-700' : 'text-red-700'}`}>
                    {smsResult.ok ? 'SMS 발송 완료' : 'SMS 발송 실패'}
                  </p>
                  {!smsResult.ok && (
                    <>
                      <p className="text-xs text-red-500 mt-1">{smsResult.message}</p>
                      {smsResult._ip && <p className="text-xs text-gray-500 mt-1">Vercel IP: {smsResult._ip}</p>}
                    </>
                  )}
                </div>
                <button
                  onClick={() => { setAddOpen(false); setAddError(''); setSmsResult(null); setAddForm({ id: '', name: '', phone: '', brand: 'pyunhan', seller: '' }) }}
                  className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                >
                  확인
                </button>
              </>
            ) : (
              <>
                <h2 className="text-base font-bold text-gray-900 mb-1">고객 추가</h2>
                <p className="text-xs text-gray-400 mb-5">정보 입력 후 등록하면 SMS가 자동 발송됩니다.</p>
                <div className="space-y-3">
                  {/* 브랜드 선택 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">브랜드</label>
                    <select
                      value={addForm.brand}
                      onChange={e => setAddForm(prev => ({ ...prev, brand: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      {BRAND_OPTIONS.map(b => (
                        <option key={b.key} value={b.key}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* 판매처 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">판매처</label>
                    <input
                      type="text"
                      value={addForm.seller}
                      onChange={e => setAddForm(prev => ({ ...prev, seller: e.target.value }))}
                      placeholder="쿠팡, 네이버 등 (선택)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {[
                    { label: '주문번호', key: 'id',    placeholder: 'ORD-001' },
                    { label: '수령인 성함', key: 'name',  placeholder: '홍길동' },
                    { label: '연락처',   key: 'phone', placeholder: '01012345678' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                      <input
                        type="text"
                        value={addForm[field.key]}
                        onChange={e => setAddForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                  {addError && <p className="text-xs text-red-500">{addError}</p>}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => { setAddOpen(false); setAddError('') }}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                    취소
                  </button>
                  <button onClick={handleAddSubmit} disabled={saving}
                    className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? 'SMS 발송 중...' : '추가 + SMS 발송'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 처리완료 확인 모달 */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
          onClick={() => setConfirmOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-900 mb-2">처리완료 확인</h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              선택한 <span className="font-semibold text-indigo-600">{selectedInTab.length}건</span>을
              배대지에 접수 완료하셨습니까?<br />
              <span className="text-xs text-gray-400">확인 후 '처리완료' 탭으로 이동합니다.</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                취소
              </button>
              <button onClick={handleMarkDone} disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
