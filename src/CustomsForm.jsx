import { useState, useEffect } from 'react'
import DaumPostcode from 'react-daum-postcode'
import { supabase } from './supabaseClient'

// 브랜드 설정 (brand URL 파라미터로 선택)
const BRANDS = {
  pyunhan: {
    name: '편한인생연구소',
    tag: '통관번호 수정센터',
    kakao: 'http://pf.kakao.com/_bCylb/chat',
    primary: '#1e5aab',   // 블루
    secondary: '#2d7bd5',
    light: '#e0edff',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)"/>
        <path d="M20 10c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10S25.5 10 20 10zm0 3c1.7 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.3-3 3-3zm0 14.2c-2.5 0-4.7-1.3-6-3.2.03-2 4-3.1 6-3.1s5.97 1.1 6 3.1c-1.3 1.9-3.5 3.2-6 3.2z" fill="white"/>
      </svg>
    ),
  },
  cool: {
    name: '쿨한인생연구소',
    tag: '통관번호 수정센터',
    kakao: 'http://pf.kakao.com/_bCylb/chat',
    primary: '#0077b6',   // 쿨 블루
    secondary: '#0096c7',
    light: '#caf0f8',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)"/>
        <path d="M20 8l2.4 6.4 6.8.6-5.1 4.5 1.6 6.7L20 22.8l-5.7 3.4 1.6-6.7-5.1-4.5 6.8-.6z" fill="white"/>
      </svg>
    ),
  },
  bbunhan: {
    name: '뻔한인생연구소',
    tag: '통관번호 수정센터',
    kakao: 'http://pf.kakao.com/_bCylb/chat',
    primary: '#6d28d9',   // 퍼플
    secondary: '#7c3aed',
    light: '#ede9fe',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)"/>
        <path d="M20 11l2 6h6l-5 3.6 1.9 5.9L20 23l-4.9 3.5L17 20.6 12 17h6z" fill="white"/>
        <circle cx="20" cy="20" r="3" fill="rgba(255,255,255,0.4)"/>
      </svg>
    ),
  },
  fun: {
    name: 'FUN한인생연구소',
    tag: '통관번호 수정센터',
    kakao: 'http://pf.kakao.com/_bCylb/chat',
    primary: '#d97706',   // 앰버
    secondary: '#f59e0b',
    light: '#fef3c7',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)"/>
        <text x="20" y="26" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">F</text>
      </svg>
    ),
  },
}

const DEFAULT_BRAND = {
  name: '통관번호 수정센터',
  tag: '개인통관고유부호 정정 신청',
  kakao: 'http://pf.kakao.com/_bCylb/chat',
  primary: '#1352a2',
  secondary: '#1a6bc7',
  light: '#e8f0fe',
  icon: null,
}

export default function CustomsForm() {
  const [urlError, setUrlError]         = useState(null)
  const [orderId, setOrderId]           = useState('')
  const [brand, setBrand]               = useState(DEFAULT_BRAND)
  const [seller, setSeller]             = useState('')
  const [name, setName]                 = useState('')
  const [phone, setPhone]               = useState('')
  const [pccc, setPccc]                 = useState('')
  const [zipcode, setZipcode]           = useState('')
  const [address, setAddress]           = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState('idle') // idle|loading|success|fail|error
  const [verifyError, setVerifyError]   = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitDone, setSubmitDone]     = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oid   = params.get('orderId')
    const token = params.get('token')
    const b     = params.get('brand')
    const s     = params.get('seller')
    if (b && BRANDS[b]) setBrand(BRANDS[b])
    if (s) setSeller(decodeURIComponent(s))
    if (!oid || !token) {
      setUrlError('유효하지 않은 접근입니다. 발송된 알림톡 링크를 통해 다시 접속해 주세요.')
      return
    }
    setOrderId(oid)
  }, [])

  const isPcccValid = pccc.length === 13 && pccc.startsWith('P')

  // 현재 단계 계산
  const currentStep = submitDone ? 3 : verifyStatus === 'success' ? 2 : 1

  const handlePcccChange = (e) => {
    setPccc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 13))
    setVerifyStatus('idle'); setVerifyError('')
  }

  const handlePostcodeSelect = (data) => {
    setZipcode(data.zonecode)
    setAddress(data.roadAddress || data.address)
    setAddressDetail('')
    setIsPostcodeOpen(false)
    setVerifyStatus('idle'); setVerifyError('')
  }

  /* ── UNI-PASS 검증 (NCloud API Gateway → CF KR-2) ── */
  const UNIPASS_KEY = 'z230e206b063c187w050l050y6'
  const NCLOUD_ENDPOINT = 'https://0sc3br4scq.apigw.ntruss.com/unipass/prod/'

  const verifyPCCC = async () => {
    if (!isPcccValid || !zipcode || !name.trim() || !phone) return
    setVerifyStatus('loading')
    setVerifyError('')
    try {
      const params = new URLSearchParams({
        crkyCn: UNIPASS_KEY,
        persEcm: pccc,
        pltxNm: name.trim(),
        cralTelno: phone.replace(/[^0-9]/g, ''),
        custPsno: zipcode,
      })
      const res = await fetch(`${NCLOUD_ENDPOINT}?${params}`)
      const data = await res.json()
      if (data.rsltCd === '00') {
        setVerifyStatus('success')
      } else {
        setVerifyStatus('fail')
        const fieldErrors = {
          persEcm: '개인통관고유부호가 유효하지 않습니다. 번호를 다시 확인해 주세요.',
          pltxNm: '성함이 관세청 등록 정보와 일치하지 않습니다.',
          cralTelno: '연락처가 관세청 등록 정보와 일치하지 않습니다.',
          custPsno: '우편번호가 관세청 등록 정보와 일치하지 않습니다.',
        }
        setVerifyError(fieldErrors[data.field] || '입력하신 정보가 관세청 등록 정보와 일치하지 않습니다.')
      }
    } catch {
      setVerifyStatus('error')
      setVerifyError('검증 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  /* ── 최종 제출 ── */
  const handleSubmit = async () => {
    if (verifyStatus !== 'success' || isSubmitting || submitDone) return
    setIsSubmitting(true)
    const d = new Date()
    const updatedAt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    const { error } = await supabase.from('orders').upsert({
      id: orderId || `ORD-${Date.now()}`,
      name: name.trim(),
      phone: phone.replace(/[^0-9]/g, ''),
      pccc,
      zipcode,
      address: `${address} ${addressDetail}`.trim(),
      updated_at: updatedAt,
      status: 'pending_resubmit',
    })
    setIsSubmitting(false)
    if (error) {
      console.error('Supabase 저장 오류:', error)
      alert('저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setSubmitDone(true)
  }

  /* ────────────────── RENDER ────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">

      {/* ── 브랜드 헤더 ── */}
      <div className="w-full" style={{ background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})` }}>
        <div className="px-5 pt-8 pb-6 max-w-lg mx-auto">
          <div className="flex items-center gap-3.5 mb-1">
            {brand.icon}
            <div>
              <p className="text-white font-bold text-xl tracking-tight">{brand.name}</p>
              <p className="text-white/50 text-xs mt-0.5 font-medium">{brand.tag}</p>
            </div>
          </div>
        </div>
        <div className="h-5 rounded-t-3xl bg-gradient-to-b from-gray-50 to-gray-50" />
      </div>

      <div className="px-5 -mt-1 max-w-lg mx-auto pb-8">

        {/* ── URL 오류 화면 ── */}
        {urlError ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-red-400" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              </div>
              <p className="text-base font-bold text-gray-800 mb-1">접근할 수 없습니다</p>
              <p className="text-sm text-gray-500 leading-relaxed">{urlError}</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── 접수 정보 카드 ── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
              <div className="px-5 py-4 space-y-2.5">
                {[
                  { label: '업체명', value: brand.name },
                  ...(seller ? [{ label: '판매처', value: seller }] : []),
                  { label: '주문번호', value: orderId || '확인 중', mono: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{item.label}</span>
                    <span className={`text-sm font-semibold text-gray-800 ${item.mono ? 'font-mono text-xs' : ''}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
              {/* 단계 표시 */}
              <div className="px-5 py-3.5 border-t border-gray-100/80 flex items-center justify-center gap-2">
                {[
                  { n: 1, label: '정보확인' },
                  { n: 2, label: '제출' },
                  { n: 3, label: '완료' },
                ].map((s, i) => (
                  <div key={s.n} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                      currentStep === s.n
                        ? 'text-white'
                        : currentStep > s.n
                        ? 'text-green-600 bg-green-50'
                        : 'text-gray-300 bg-gray-50'
                    }`}
                    style={currentStep === s.n ? {
                      background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`,
                      boxShadow: `0 2px 8px ${brand.primary}40`
                    } : {}}>
                      {currentStep > s.n ? (
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      ) : (
                        <span>{s.n}</span>
                      )}
                      <span>{s.label}</span>
                    </div>
                    {i < 2 && (
                      <svg className={`w-3 h-3 ${currentStep > s.n + 1 ? 'text-green-300' : 'text-gray-200'}`} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── 완료 화면 ── */}
            {submitDone ? (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-8 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                       style={{
                         background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                         boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)'
                       }}>
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-emerald-600" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">신청이 접수되었습니다</h2>
                  <p className="text-sm text-gray-400 mb-6">
                    주문번호 <span className="font-mono font-semibold text-gray-600">{orderId}</span>
                  </p>
                  <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-3">
                    {[
                      '정정된 통관 정보가 시스템에 반영됩니다.',
                      '처리 완료 후 배송이 재개됩니다.',
                    ].map((text, i) => (
                      <p key={i} className="text-sm text-gray-500 flex gap-2.5 items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 mt-1.5" />
                        {text}
                      </p>
                    ))}
                  </div>
                  {brand.kakao && (
                    <a
                      href={brand.kakao}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                      style={{ background: '#FEE500', color: '#3C1E1E' }}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#3C1E1E">
                        <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.86 5.22 4.66 6.6l-.96 3.56c-.08.3.26.54.52.37l4.23-2.82c.5.05 1.02.09 1.55.09 5.52 0 10-3.58 10-7.9S17.52 3 12 3z"/>
                      </svg>
                      카카오톡 문의하기
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* ── 안내 박스 ── */}
                <div className="mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 pt-4 pb-1">
                    <p className="text-sm font-bold text-gray-800 leading-snug">
                      고객님의 빠른 상품 수령을 위한 안내
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      관세청 통관 기준 강화로 인해 확인이 필요합니다
                    </p>
                  </div>
                  <div className="px-5 py-3 space-y-3" style={{ wordBreak: 'keep-all' }}>
                    {[
                      '최근 관세청 정책 변경으로, 이름, 연락처, 통관부호와 함께 \'발급 시 등록한 우편번호\'까지 4가지가 모두 일치해야만 통관이 가능합니다.',
                      '현재 입력된 정보의 불일치로 배송이 잠시 대기 중입니다. 올바른 우편번호로 수정해 주시면 즉시 출항 절차가 재개됩니다.',
                      '고객님의 소중한 개인정보는 철저한 보안 속에 오직 세관 통관 재접수 목적으로만 안전하게 사용됩니다.',
                    ].map((text, i) => (
                      <div key={i} className="flex gap-2.5 items-start">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                             style={{ background: brand.light }}>
                          <span className="text-[10px] font-bold" style={{ color: brand.primary }}>{i + 1}</span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 입력 폼 ── */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 pt-5 pb-1">
                    <p className="text-base font-bold text-gray-800">통관 정보 입력</p>
                    <p className="text-xs text-gray-400 mt-0.5">아래 정보를 정확하게 입력해 주세요</p>
                  </div>

                  <div className="space-y-1 px-5 py-3">

                    {/* 수령인 성함 */}
                    <div className="py-2.5">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide">
                        수령인 성함 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => { setName(e.target.value); setVerifyStatus('idle') }}
                        placeholder="성함을 입력해 주세요"
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200/80 rounded-xl text-[15px]
                                   placeholder:text-gray-300
                                   focus:outline-none focus:bg-white focus:border-transparent focus:ring-2 transition-all duration-200"
                        style={{ '--tw-ring-color': brand.primary + '60' }}
                      />
                      <p className="text-xs text-gray-400 mt-2 pl-1">개인통관고유부호에 등록된 성명과 동일하게 입력해 주세요</p>
                    </div>

                    {/* 연락처 */}
                    <div className="py-2.5">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide">
                        휴대전화번호 <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setVerifyStatus('idle') }}
                        placeholder="010-0000-0000"
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200/80 rounded-xl text-[15px]
                                   placeholder:text-gray-300
                                   focus:outline-none focus:bg-white focus:border-transparent focus:ring-2 transition-all duration-200"
                        style={{ '--tw-ring-color': brand.primary + '60' }}
                      />
                      <p className="text-xs text-gray-400 mt-2 pl-1">개인통관고유부호에 등록된 휴대전화번호를 입력해 주세요</p>
                    </div>

                    {/* 개인통관고유부호 */}
                    <div className="py-2.5">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide">
                        개인통관고유부호 (PCCC) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={pccc}
                        onChange={handlePcccChange}
                        placeholder="P000000000000"
                        maxLength={13}
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200/80 rounded-xl text-[15px] font-mono
                                   tracking-widest placeholder:text-gray-300
                                   focus:outline-none focus:bg-white focus:border-transparent focus:ring-2 transition-all duration-200"
                        style={{ '--tw-ring-color': brand.primary + '60' }}
                      />
                      <div className="mt-2 pl-1">
                        {pccc && !isPcccValid && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z"/>
                            </svg>
                            P로 시작하는 13자리를 입력해 주세요 ({pccc.length}/13)
                          </p>
                        )}
                        {isPcccValid && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                            형식이 올바릅니다
                          </p>
                        )}
                        {!pccc && (
                          <p className="text-xs text-gray-400">P로 시작하는 13자리 부호</p>
                        )}
                      </div>
                    </div>

                    {/* 배송지 우편번호 */}
                    <div className="py-2.5">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide">
                        배송지 우편번호 <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-2.5">
                        <input
                          type="text"
                          value={zipcode}
                          readOnly
                          placeholder="우편번호 5자리"
                          className="flex-1 px-4 py-3.5 bg-gray-100 border border-gray-200/60 rounded-xl text-[15px] font-mono
                                     tracking-wider text-gray-600 cursor-not-allowed placeholder:text-gray-300"
                        />
                        <button
                          type="button"
                          onClick={() => setIsPostcodeOpen(true)}
                          className="px-5 py-3.5 text-white text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap
                                     active:scale-95 shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`,
                            boxShadow: `0 2px 8px ${brand.primary}30`
                          }}
                        >
                          주소 검색
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 pl-1">
                        '주소 검색' 버튼을 통해 정확한 우편번호를 선택해 주세요
                      </p>

                      {/* 도로명주소 (자동) */}
                      {address && (
                        <input
                          type="text"
                          value={address}
                          readOnly
                          className="w-full mt-2.5 px-4 py-3.5 bg-gray-100 border border-gray-200/60 rounded-xl text-[15px]
                                     text-gray-600 cursor-not-allowed"
                        />
                      )}

                      {/* 상세주소 (수동 입력) */}
                      {address && (
                        <input
                          type="text"
                          value={addressDetail}
                          onChange={(e) => setAddressDetail(e.target.value)}
                          placeholder="상세주소 입력 (동, 호수 등)"
                          className="w-full mt-2.5 px-4 py-3.5 bg-gray-50 border border-gray-200/60 rounded-xl text-[15px]
                                     placeholder:text-gray-300 focus:outline-none focus:ring-2 transition-all duration-200"
                          style={{ focusRingColor: brand.primary }}
                          onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px ${brand.primary}40`}
                          onBlur={(e) => e.target.style.boxShadow = 'none'}
                        />
                      )}
                    </div>
                  </div>

                  {/* ── 검증 버튼 영역 ── */}
                  <div className="px-5 py-5">
                    <button
                      type="button"
                      onClick={verifyPCCC}
                      disabled={!isPcccValid || !zipcode || !name.trim() || !phone || verifyStatus === 'loading'}
                      className="w-full py-4 text-white font-bold text-[15px] rounded-2xl transition-all duration-200
                                 flex items-center justify-center gap-2
                                 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
                                 active:scale-[0.98]"
                      style={{
                        background: verifyStatus === 'success'
                          ? 'linear-gradient(135deg, #059669, #10b981)'
                          : `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`,
                        boxShadow: verifyStatus === 'success'
                          ? '0 4px 14px rgba(5, 150, 105, 0.3)'
                          : `0 4px 14px ${brand.primary}30`
                      }}
                    >
                      {verifyStatus === 'loading' ? (
                        <>
                          <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          통관 정보 검증 중...
                        </>
                      ) : verifyStatus === 'success' ? (
                        <>
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                          검증 완료 — 다시 확인하기
                        </>
                      ) : (
                        '통관 정보 검증하기'
                      )}
                    </button>

                    {/* 검증 결과 */}
                    {verifyStatus === 'success' && (
                      <div className="mt-4 rounded-2xl p-4 flex gap-3 bg-emerald-50 border border-emerald-100">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" fill="currentColor">
                          <path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                        </svg>
                        <div>
                          <p className="text-sm font-bold text-emerald-700">관세청 검증 완료</p>
                          <p className="text-sm mt-0.5 text-emerald-600">
                            통관 정보가 확인되었습니다. 아래 버튼을 눌러 신청을 완료해 주세요.
                          </p>
                        </div>
                      </div>
                    )}
                    {(verifyStatus === 'fail' || verifyStatus === 'error') && (
                      <div className="mt-4 rounded-2xl p-4 flex gap-3 bg-red-50 border border-red-100">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 mt-0.5 text-red-400" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        <div>
                          <p className="text-sm font-bold text-red-500">
                            {verifyStatus === 'fail' ? '검증 실패' : '연결 오류'}
                          </p>
                          <p className="text-sm mt-0.5 text-gray-600">{verifyError}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── 최종 제출 버튼 ── */}
                  <div className="px-5 pt-2 pb-5">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={verifyStatus !== 'success' || isSubmitting || submitDone}
                      className="w-full py-4 text-white font-bold text-[15px] rounded-2xl transition-all duration-200
                                 disabled:opacity-20 disabled:cursor-not-allowed disabled:shadow-none
                                 active:scale-[0.98] flex items-center justify-center gap-2"
                      style={{
                        background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`,
                        boxShadow: verifyStatus === 'success' ? `0 4px 14px ${brand.primary}30` : 'none'
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          신청서 제출 중...
                        </>
                      ) : (
                        '정정 신청서 최종 제출'
                      )}
                    </button>
                    <p className="text-center text-xs text-gray-300 mt-3">
                      정보 확인 완료 후 제출 버튼이 활성화됩니다
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ── 푸터 ── */}
            <div className="mt-8 pb-10">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-300 mb-3">
                <span className="flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4z"/></svg>
                  SSL 보안 암호화
                </span>
                <span className="text-gray-200">|</span>
                <span>개인정보보호법 준수</span>
              </div>
              <p className="text-center text-xs text-gray-300 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                본 페이지는 <strong className="text-gray-400">{brand.name}</strong>에서 제공하는 서비스입니다.<br/>
                입력하신 정보는 통관 정정 목적으로만 안전하게 사용됩니다.
              </p>
            </div>

          </>
        )}
      </div>

      {/* ── 우편번호 검색 모달 (모바일: 하단 시트) ── */}
      {isPostcodeOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={() => setIsPostcodeOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg overflow-hidden rounded-t-3xl shadow-2xl"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'fade-in-up 0.25s ease-out' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="font-bold text-gray-800 text-base">배송지 우편번호 검색</span>
              <button
                onClick={() => setIsPostcodeOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <DaumPostcode
              onComplete={handlePostcodeSelect}
              style={{ height: '460px' }}
              autoClose={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
