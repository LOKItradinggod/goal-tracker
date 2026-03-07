import { useState, useEffect } from 'react'

const SUPABASE_URL = 'https://tnjwfltejljpfavoqfxn.supabase.co'
const SUPABASE_KEY = 'sb_publishable_bFrGHgSjCh_xDT2fRGXfLA_sICNLz58'
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || ''

const db = {
  async query(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || '',
      },
      ...options,
    })
    if (!res.ok) { const err = await res.text(); throw new Error(err) }
    const text = await res.text()
    return text ? JSON.parse(text) : null
  },
  async loadGoals() {
    const goals = await this.query('goals?select=*&order=created_at.asc')
    const logs  = await this.query('logs?select=*&order=created_at.desc')
    return (goals || []).map(g => ({
      ...g, desc: g.description,
      logs: (logs || []).filter(l => l.goal_id === g.id).map(l => ({
        ...l, aiScore: l.ai_score, aiReasoning: l.ai_reasoning,
        aiVerdict: l.ai_verdict, aiNext: l.ai_next, date: l.created_at,
      }))
    }))
  },
  async addGoal(goal) {
    await this.query('goals', { method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({ id: goal.id, title: goal.title, description: goal.desc, target: goal.target, progress: goal.progress }) })
  },
  async updateGoal(id, fields) {
    await this.query(`goals?id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(fields) })
  },
  async deleteGoal(id) { await this.query(`goals?id=eq.${id}`, { method: 'DELETE' }) },
  async addLog(log, goalId) {
    await this.query('logs', { method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({ id: log.id, goal_id: goalId, text: log.text,
        ai_score: log.aiScore, ai_reasoning: log.aiReasoning, ai_verdict: log.aiVerdict, ai_next: log.aiNext }) })
  },
  async deleteLog(id) { await this.query(`logs?id=eq.${id}`, { method: 'DELETE' }) },
}

async function getAIEvaluation(goalTitle, goalDesc, logEntry) {
  if (!ANTHROPIC_KEY) throw new Error('NO_KEY')
  const prompt = `你是一个严格理性的目标评估系统，基于数据和逻辑分析，不讲废话，不给安慰分。
目标名称：${goalTitle}
目标描述：${goalDesc || '无'}
用户本次记录的进展："${logEntry}"
评估规则：
- 仅凭本次记录的具体行动打分，不考虑意图或计划
- 如果记录模糊（如"今天学习了"），最多给20分
- 如果有具体数据（时间、题目数、正确率等），可给更高分
- 单次行动最多给60分，避免虚高
返回纯JSON（不要markdown代码块，不要任何其他文字）：
{"score":<0-60的整数>,"reasoning":"<2-3句严格分析，要具体>","verdict":"<8字内评级>","next":"<一句话具体建议>"}`
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] })
  })
  if (!response.ok) throw new Error(`API error ${response.status}`)
  const data = await response.json()
  const text = data.content.map(i => i.text || '').join('')
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

function scoreColor(s) { return s >= 70 ? '#3ecf8e' : s >= 40 ? '#f0954a' : '#e05c72' }
function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// Touch-safe button component for mobile
function Btn({ onClick, style, disabled, children }) {
  const handle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) onClick && onClick()
  }
  return (
    <button
      onPointerUp={handle}
      onClick={e => e.preventDefault()}
      disabled={disabled}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', userSelect: 'none', ...style }}
    >
      {children}
    </button>
  )
}

const I = {
  Plus:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Back:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>,
  Trash:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  Edit:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Chevron: ({up}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/></svg>,
  Star:    () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
  Target:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Check:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
}

const S = {
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid #16162a', background:'#0a0a14', position:'sticky', top:0, zIndex:100 },
  logo: { fontFamily:'Georgia,serif', fontWeight:700, fontSize:18, background:'linear-gradient(120deg,#dde1f5,#7c6ff7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', WebkitTextFillColor:'transparent' },
  page: { maxWidth:680, margin:'0 auto', padding:'20px 16px 100px' },
  card: { background:'#0e0e1c', border:'1px solid #1a1a30', borderRadius:12, padding:'16px 18px', marginBottom:10, cursor:'pointer', WebkitTapHighlightColor:'transparent', touchAction:'manipulation' },
  btn: (bg='#7c6ff7', color='#fff') => ({ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 18px', borderRadius:9, border:'none', background:bg, color, cursor:'pointer', fontSize:13, fontWeight:600, WebkitTapHighlightColor:'transparent', touchAction:'manipulation', userSelect:'none', minHeight:44 }),
  btnSm: (bg='transparent', color='#8888aa') => ({ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:4, padding:'0', width:36, height:36, borderRadius:8, border:'1px solid #252540', background:bg, color, cursor:'pointer', fontSize:12, WebkitTapHighlightColor:'transparent', touchAction:'manipulation', userSelect:'none' }),
  input: { width:'100%', background:'#0a0a14', border:'1px solid #1a1a30', borderRadius:8, padding:'12px', color:'#dde1f5', fontSize:16, outline:'none', WebkitAppearance:'none' },
  textarea: { width:'100%', background:'#0a0a14', border:'1px solid #1a1a30', borderRadius:8, padding:'12px', color:'#dde1f5', fontSize:16, outline:'none', resize:'vertical', minHeight:100, lineHeight:1.7, WebkitAppearance:'none' },
  label: { fontSize:11, color:'#555570', fontFamily:'DM Mono,monospace', letterSpacing:'0.12em', marginBottom:6, display:'block' },
  mono: { fontFamily:'DM Mono,monospace' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' },
  sheet: { background:'#0e0e1c', border:'1px solid #1a1a30', borderRadius:'18px 18px 0 0', padding:'24px 20px 48px', width:'100%', maxWidth:680 },
  tag: (c) => ({ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, padding:'3px 9px', borderRadius:20, background:c+'22', color:c, fontFamily:'DM Mono,monospace' }),
}

export default function App() {
  const [goals, setGoals]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [syncStatus, setSyncStatus]   = useState('synced')
  const [view, setView]               = useState('home')
  const [activeId, setActiveId]       = useState(null)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [showAddLog, setShowAddLog]   = useState(false)
  const [editingGoal, setEditingGoal] = useState(null) // goal being edited
  const [expandedLogs, setExpandedLogs] = useState({})

  // forms
  const [gTitle, setGTitle]   = useState('')
  const [gDesc, setGDesc]     = useState('')
  const [gTarget, setGTarget] = useState(500)
  const [logText, setLogText] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [evalError, setEvalError]   = useState('')
  const [noKeyWarning, setNoKeyWarning] = useState(!ANTHROPIC_KEY)

  useEffect(() => {
    db.loadGoals().then(data => { setGoals(data); setLoading(false) })
      .catch(() => { setLoading(false); setSyncStatus('error') })
  }, [])

  const withSync = async (fn) => {
    setSyncStatus('syncing')
    try { await fn(); setSyncStatus('synced') }
    catch (e) { console.error(e); setSyncStatus('error') }
  }

  const addGoal = async () => {
    if (!gTitle.trim()) return
    const goal = { id: Date.now().toString(), title: gTitle.trim(), desc: gDesc.trim(), target: Math.max(10, parseInt(gTarget)||500), progress: 0, logs: [], created_at: new Date().toISOString() }
    setGoals(prev => [...prev, goal])
    setGTitle(''); setGDesc(''); setGTarget(500); setShowAddGoal(false)
    await withSync(() => db.addGoal(goal))
  }

  const saveEditGoal = async () => {
    if (!editingGoal) return
    const { id, title, desc } = editingGoal
    if (!title.trim()) return
    setGoals(prev => prev.map(g => g.id !== id ? g : { ...g, title: title.trim(), desc: desc.trim() }))
    setEditingGoal(null)
    await withSync(() => db.updateGoal(id, { title: title.trim(), description: desc.trim() }))
  }

  const deleteGoal = async (id) => {
    setGoals(prev => prev.filter(g => g.id !== id)); setView('home')
    await withSync(() => db.deleteGoal(id))
  }

  const addLog = async () => {
    if (!logText.trim()) return
    const goal = goals.find(g => g.id === activeId)
    if (!goal) return
    setEvaluating(true); setEvalError('')
    let ai = null
    try {
      ai = await getAIEvaluation(goal.title, goal.desc, logText)
    } catch (e) {
      if (e.message === 'NO_KEY') {
        setEvalError('⚠️ 未配置 API Key，请先在 Vercel 添加 VITE_ANTHROPIC_KEY 环境变量。')
      } else {
        setEvalError('AI评估失败，请检查网络后重试。错误：' + e.message)
      }
      setEvaluating(false)
      return
    }
    const log = { id: Date.now().toString(), text: logText.trim(), date: new Date().toISOString(), aiScore: ai.score, aiReasoning: ai.reasoning, aiVerdict: ai.verdict, aiNext: ai.next }
    const newProgress = goal.progress + ai.score
    setGoals(prev => prev.map(g => g.id !== activeId ? g : { ...g, logs: [log, ...g.logs], progress: newProgress }))
    setLogText(''); setShowAddLog(false); setEvaluating(false)
    await withSync(async () => { await db.addLog(log, activeId); await db.updateGoal(activeId, { progress: newProgress }) })
  }

  const deleteLog = async (goalId, logId) => {
    const goal = goals.find(g => g.id === goalId)
    const newLogs = goal.logs.filter(l => l.id !== logId)
    const newProgress = newLogs.reduce((a, l) => a + l.aiScore, 0)
    setGoals(prev => prev.map(g => g.id !== goalId ? g : { ...g, logs: newLogs, progress: newProgress }))
    await withSync(async () => { await db.deleteLog(logId); await db.updateGoal(goalId, { progress: newProgress }) })
  }

  const activeGoal = goals.find(g => g.id === activeId)
  const overallPct = goals.length === 0 ? 0 : Math.round(goals.reduce((a,g) => a + Math.min(100,(g.progress/g.target)*100), 0) / goals.length)
  const syncUI = { synced:{color:'#3ecf8e',text:'✓ synced'}, syncing:{color:'#f0954a',text:'↑ saving...'}, error:{color:'#e05c72',text:'✗ error'} }[syncStatus]

  const globalStyles = `
    * { box-sizing: border-box; }
    body { margin: 0; background: #080810; }
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    input, textarea, button { font-family: inherit; }
    input[type=number]::-webkit-inner-spin-button { opacity: 1; }
  `

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#080810', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{globalStyles}</style>
      <div style={{ color:'#555570', fontFamily:'DM Mono,monospace', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>◌</span> loading...
      </div>
    </div>
  )

  // ── DETAIL VIEW ──────────────────────────────────────────────
  if (view === 'detail' && activeGoal) {
    const pct = Math.min(100, Math.round((activeGoal.progress / activeGoal.target) * 100))
    const pc = scoreColor(pct)
    return (
      <div style={{ minHeight:'100vh', background:'#080810', color:'#dde1f5' }}>
        <style>{globalStyles}</style>
        <div style={S.topbar}>
          <Btn onClick={() => setView('home')} style={{ background:'none', border:'none', color:'#8888aa', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, padding:'8px 0', minHeight:44 }}>
            <I.Back /> 全部目标
          </Btn>
          <span style={S.logo}>PROOF</span>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ ...S.mono, fontSize:11, color:syncUI.color }}>{syncUI.text}</span>
            <Btn style={{ ...S.btnSm('#1a1a2e','#e05c72'), borderColor:'#2a1a1a' }}
              onClick={() => { if(confirm('确认删除这个目标及所有记录？')) deleteGoal(activeGoal.id) }}>
              <I.Trash />
            </Btn>
          </div>
        </div>

        <div style={S.page}>
          {/* Goal header */}
          <div style={{ marginBottom:20, animation:'fadeUp 0.3s ease both' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:6 }}>
              <h2 style={{ fontSize:21, fontFamily:'Georgia,serif', fontWeight:700, lineHeight:1.3, margin:0, flex:1 }}>{activeGoal.title}</h2>
              <Btn style={{ ...S.btnSm(), flexShrink:0, marginTop:2 }}
                onClick={() => setEditingGoal({ id: activeGoal.id, title: activeGoal.title, desc: activeGoal.desc || '' })}>
                <I.Edit />
              </Btn>
            </div>
            {activeGoal.desc
              ? <p style={{ color:'#8888aa', fontSize:13, lineHeight:1.8, margin:'0 0 16px' }}>{activeGoal.desc}</p>
              : <p style={{ color:'#333350', fontSize:13, fontStyle:'italic', margin:'0 0 16px' }}>暂无描述，点击 ✏️ 添加</p>
            }

            {/* Progress */}
            <div style={{ background:'#0e0e1c', border:'1px solid #1a1a30', borderRadius:14, padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:10 }}>
                <div>
                  <div style={{ ...S.label, marginBottom:2 }}>总进度</div>
                  <div style={{ fontSize:36, fontWeight:800, color:pc, ...S.mono, lineHeight:1 }}>{pct}%</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ ...S.label, marginBottom:2 }}>累计得分</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'#8888aa', ...S.mono }}>{activeGoal.progress}<span style={{ fontSize:12, color:'#333350' }}>/{activeGoal.target}</span></div>
                </div>
              </div>
              <div style={{ height:6, borderRadius:3, background:'#16162a', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:3, background:`linear-gradient(90deg,${pc}99,${pc})`, width:`${pct}%`, transition:'width 0.6s ease' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
                <span style={{ ...S.mono, fontSize:11, color:'#444460' }}>{activeGoal.logs.length} 条记录</span>
                <span style={{ ...S.mono, fontSize:11, color:'#444460' }}>目标 {activeGoal.target} 分 = 100%</span>
              </div>
            </div>
          </div>

          {/* Add log */}
          {noKeyWarning && (
            <div style={{ background:'#1a1200', border:'1px solid #f0954a44', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:12, color:'#f0954a', lineHeight:1.7 }}>
              ⚠️ <strong>AI评估未启用</strong> — 需要在 Vercel 添加环境变量 <code style={{ background:'#0a0a14', padding:'1px 6px', borderRadius:4 }}>VITE_ANTHROPIC_KEY</code>，值为你的 Anthropic API Key。
            </div>
          )}

          <Btn style={{ ...S.btn(), width:'100%', marginBottom:20 }} onClick={() => { setShowAddLog(true); setEvalError('') }}>
            <I.Plus /> 记录今天的进展
          </Btn>

          <div style={{ ...S.label, marginBottom:12 }}>进展记录 · {activeGoal.logs.length}</div>

          {activeGoal.logs.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 0', color:'#333350', ...S.mono, fontSize:13 }}>
              还没有记录。<br/>第一步往往是最难的。
            </div>
          )}

          {activeGoal.logs.map(log => {
            const c = scoreColor(log.aiScore); const exp = expandedLogs[log.id]
            return (
              <div key={log.id} style={{ background:'#0a0a14', border:'1px solid #16162a', borderRadius:11, padding:'13px 14px', marginBottom:8 }}>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, lineHeight:1.75, color:'#c8cce0', marginBottom:8, margin:'0 0 8px' }}>{log.text}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={S.tag(c)}><I.Star /> +{log.aiScore}分 · {log.aiVerdict}</span>
                      <span style={{ ...S.mono, fontSize:11, color:'#333350' }}>{formatDate(log.date)}</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                    <Btn style={S.btnSm()} onClick={() => setExpandedLogs(p => ({ ...p, [log.id]:!p[log.id] }))}><I.Chevron up={exp} /></Btn>
                    <Btn style={{ ...S.btnSm('transparent','#e05c72'), borderColor:'#2a1a1a' }} onClick={() => { if(confirm('删除这条记录？')) deleteLog(activeGoal.id, log.id) }}><I.Trash /></Btn>
                  </div>
                </div>
                {exp && (
                  <div style={{ marginTop:12, padding:'12px 14px', background:'#080810', borderRadius:8, borderLeft:`3px solid ${c}` }}>
                    <div style={{ display:'flex', alignItems:'center', marginBottom:8 }}>
                      <span style={{ ...S.mono, fontSize:10, color:'#555570', letterSpacing:'0.15em' }}>AI EVALUATION</span>
                      <span style={{ ...S.mono, fontSize:16, color:c, fontWeight:800, marginLeft:'auto' }}>{log.aiScore}<span style={{ fontSize:11, color:'#444460' }}>/60</span></span>
                    </div>
                    <p style={{ fontSize:12, color:'#8888aa', lineHeight:1.8, margin:'0 0 8px' }}>{log.aiReasoning}</p>
                    <div style={{ fontSize:12, color:'#555570' }}><span style={{ color:'#3ecf8e' }}>→ </span>{log.aiNext}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add Log Sheet */}
        {showAddLog && (
          <div style={S.overlay}>
            <div style={S.sheet}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <span style={{ fontSize:16, fontWeight:600 }}>记录进展</span>
                {!evaluating && <Btn style={{ background:'none', border:'none', color:'#555570', cursor:'pointer', fontSize:24, padding:'0', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShowAddLog(false)}>×</Btn>}
              </div>
              <label style={S.label}>你今天做了什么？写得越具体，AI评分越准确。</label>
              <textarea style={S.textarea}
                placeholder={"例如：\n完成 Exam P 第5章练习题48道，正确率83%，泊松分布错了4题，已整理错题本。耗时2.5小时。"}
                value={logText} onChange={e => setLogText(e.target.value)} disabled={evaluating} />
              {evalError && <div style={{ marginTop:10, fontSize:12, color:'#e05c72', lineHeight:1.6, padding:'8px 12px', background:'#1a0a0a', borderRadius:6 }}>{evalError}</div>}
              <Btn style={{ ...S.btn(evaluating||!logText.trim()?'#1a1a2e':'#7c6ff7'), width:'100%', marginTop:12, opacity:evaluating||!logText.trim()?0.5:1 }}
                onClick={addLog} disabled={evaluating||!logText.trim()}>
                {evaluating
                  ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>◌</span>&nbsp; AI 评估中...</>
                  : <><I.Star />&nbsp; 提交并获得 AI 评估</>
                }
              </Btn>
            </div>
          </div>
        )}

        {/* Edit Goal Sheet */}
        {editingGoal && (
          <div style={S.overlay}>
            <div style={S.sheet}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <span style={{ fontSize:16, fontWeight:600 }}>编辑目标</span>
                <Btn style={{ background:'none', border:'none', color:'#555570', cursor:'pointer', fontSize:24, padding:'0', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setEditingGoal(null)}>×</Btn>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={S.label}>目标名称</label>
                  <input style={S.input} value={editingGoal.title} onChange={e => setEditingGoal(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>详细描述（AI 评估参考）</label>
                  <textarea style={{ ...S.textarea, minHeight:80 }}
                    placeholder="写得越具体，AI评分越准确..."
                    value={editingGoal.desc} onChange={e => setEditingGoal(p => ({ ...p, desc: e.target.value }))} />
                </div>
                <Btn style={{ ...S.btn(), width:'100%' }} onClick={saveEditGoal}>
                  <I.Check /> 保存修改
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── HOME VIEW ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#080810', color:'#dde1f5' }}>
      <style>{globalStyles}</style>
      <div style={S.topbar}>
        <span style={S.logo}>PROOF</span>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ ...S.mono, fontSize:11, color:syncUI.color }}>{syncUI.text}</span>
          <Btn style={S.btn()} onClick={() => setShowAddGoal(true)}><I.Plus /> 新目标</Btn>
        </div>
      </div>

      <div style={S.page}>
        <div style={{ marginBottom:24, paddingTop:4, animation:'fadeUp 0.4s ease both' }}>
          <div style={{ ...S.mono, fontSize:10, letterSpacing:'0.22em', color:'#7c6ff7', marginBottom:8 }}>GOAL TRACKER · AI POWERED · CLOUD SYNC</div>
          <h1 style={{ fontSize:26, fontFamily:'Georgia,serif', fontWeight:700, lineHeight:1.2, background:'linear-gradient(120deg,#dde1f5 30%,#7c6ff7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:6, margin:'0 0 6px' }}>我的目标系统</h1>
          <p style={{ color:'#444460', fontSize:12, ...S.mono, margin:0 }}>每条进展由 AI 严格评分 · 云端同步</p>
        </div>

        {goals.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:22 }}>
            {[{label:'目标数',value:goals.length,color:'#7c6ff7'},{label:'平均进度',value:overallPct+'%',color:scoreColor(overallPct)},{label:'记录数',value:goals.reduce((a,g)=>a+g.logs.length,0),color:'#f0954a'}].map(s => (
              <div key={s.label} style={{ background:'#0e0e1c', border:'1px solid #1a1a30', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ ...S.mono, fontSize:22, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ ...S.mono, fontSize:10, color:'#444460', marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...S.mono, fontSize:10, letterSpacing:'0.18em', color:'#333350', marginBottom:12 }}>目标列表 · {goals.length}</div>

        {goals.length === 0 && (
          <div style={{ textAlign:'center', padding:'64px 0', color:'#222235' }}>
            <div style={{ fontSize:40, marginBottom:14 }}>🎯</div>
            <div style={{ ...S.mono, fontSize:13 }}>还没有目标</div>
            <div style={{ ...S.mono, fontSize:11, color:'#1a1a2e', marginTop:6 }}>点击右上角「新目标」开始</div>
          </div>
        )}

        {goals.map((goal, idx) => {
          const pct = Math.min(100, Math.round((goal.progress/goal.target)*100)); const c = scoreColor(pct); const last = goal.logs[0]
          return (
            <div key={goal.id}
              style={{ ...S.card, borderLeftWidth:3, borderLeftStyle:'solid', borderLeftColor:c, animation:`fadeUp 0.4s ${idx*0.04}s ease both` }}
              onPointerUp={(e) => { e.preventDefault(); setActiveId(goal.id); setView('detail') }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:15, marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{goal.title}</div>
                  {goal.desc && <div style={{ fontSize:12, color:'#555570', marginBottom:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{goal.desc}</div>}
                  <div style={{ height:4, borderRadius:2, background:'#16162a', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:2, background:c, width:`${pct}%`, transition:'width 0.6s ease' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                    <span style={{ ...S.mono, fontSize:11, color:'#333350' }}>{goal.logs.length} 条记录</span>
                    <span style={{ ...S.mono, fontSize:11, color:c, fontWeight:700 }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ ...S.mono, fontSize:26, fontWeight:900, color:c, minWidth:52, textAlign:'right', lineHeight:1 }}>{pct}%</div>
              </div>
              {last && (
                <div style={{ marginTop:10, padding:'8px 10px', background:'#080810', borderRadius:7, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, color:'#444460', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>最近：{last.text}</span>
                  <span style={S.tag(scoreColor(last.aiScore))}>+{last.aiScore}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Goal Sheet */}
      {showAddGoal && (
        <div style={S.overlay}>
          <div style={S.sheet}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <span style={{ fontSize:16, fontWeight:600 }}>新建目标</span>
              <Btn style={{ background:'none', border:'none', color:'#555570', cursor:'pointer', fontSize:24, padding:'0', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShowAddGoal(false)}>×</Btn>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={S.label}>目标名称 *</label><input style={S.input} placeholder="例如：通过 SOA Exam P" value={gTitle} onChange={e => setGTitle(e.target.value)} /></div>
              <div><label style={S.label}>详细描述（AI 评分参考）</label><textarea style={{ ...S.textarea, minHeight:70 }} placeholder="例如：2026年6月前通过考试，需完成全部题库，正确率达85%以上" value={gDesc} onChange={e => setGDesc(e.target.value)} /></div>
              <div>
                <label style={S.label}>目标总分 = {gTarget}（AI每次最多+60分）</label>
                <input style={S.input} type="number" min={50} max={2000} value={gTarget} onChange={e => setGTarget(e.target.value)} />
                <div style={{ ...S.mono, fontSize:10, color:'#333350', marginTop:6 }}>简单目标 100 · 中等 300 · 长期 500+</div>
              </div>
              <Btn style={{ ...S.btn(gTitle.trim()?'#7c6ff7':'#1a1a2e'), opacity:gTitle.trim()?1:0.5 }} onClick={addGoal} disabled={!gTitle.trim()}>
                <I.Target /> 创建目标
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

