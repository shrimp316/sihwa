// gallery-view.jsx — gallery grid inside the book UI shell.
// No Firebase in the prototype — shows SIHWA_DATA.galleryItems with SVG placeholders.

function GalleryView({ items, quarters }) {
  const [lightbox, setLightbox] = React.useState(null);

  const qSorted = [...quarters].sort((a, b) => a.order - b.order);
  const typeLabel = { illust: '시 삽화', bg: '배경 삽화', etc: '기타' };
  const typeBadge = { illust: '#e8f0e0', bg: '#e0e8f0', etc: '#f0e8e0' };
  const typeInk   = { illust: '#5a7a40', bg: '#405a7a', etc: '#7a5a40' };

  // SVG placeholder patterns — each gallery item gets a seeded soft pattern.
  const svgPlaceholder = (id, type) => {
    const hues = { illust: '130,160,80', bg: '100,140,180', etc: '180,130,100' };
    const c = hues[type] || '150,130,100';
    return `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="rgb(${c.split(',').map(v=>parseInt(v)*0.85+', ').join('').slice(0,-2)})" opacity="0.25"/>
        <circle cx="200" cy="130" r="55" fill="none" stroke="rgb(${c})" stroke-width="0.6" opacity="0.45"/>
        <circle cx="200" cy="130" r="30" fill="none" stroke="rgb(${c})" stroke-width="0.6" opacity="0.3"/>
        <text x="200" y="195" font-family="serif" font-size="12" fill="rgb(${c})" text-anchor="middle" opacity="0.55">${typeLabel[type] || ''}</text>
      </svg>`
    )}`;
  };

  return (
    <div className="gv-root">
      {qSorted.map((q, qi) => {
        const gItems = items.filter(g => g.quarterId === q.id).sort((a,b)=>a.order-b.order);
        if (!gItems.length) return null;
        return (
          <div key={q.id} className="gv-quarter">
            <div className="gv-quarter-label">
              <span className="gv-quarter-num">{qi+1}분기</span>
              {q.title}
            </div>
            <div className="gv-grid">
              {gItems.map(g => (
                <div key={g.id} className="gv-card" onClick={()=>setLightbox(g)}>
                  <div className="gv-img-wrap">
                    <img
                      src={g.imageUrl || svgPlaceholder(g.id, g.type)}
                      alt={g.title}
                      className="gv-img"
                    />
                  </div>
                  <div className="gv-card-body">
                    <span className="gv-badge"
                      style={{ background: typeBadge[g.type]||'#eee', color: typeInk[g.type]||'#666' }}>
                      {typeLabel[g.type]||'기타'}
                    </span>
                    <div className="gv-card-title">{g.title}</div>
                    {g.note && <div className="gv-card-note">{g.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <div className="gv-empty">아직 등록된 이미지가 없어요.</div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="gv-lightbox" onClick={()=>setLightbox(null)}>
          <button className="gv-lb-close" onClick={()=>setLightbox(null)}>✕</button>
          <img
            src={lightbox.imageUrl || svgPlaceholder(lightbox.id, lightbox.type)}
            alt={lightbox.title}
            className="gv-lb-img"
            onClick={e=>e.stopPropagation()}
          />
          <div className="gv-lb-title" onClick={e=>e.stopPropagation()}>{lightbox.title}</div>
          <div className="gv-lb-tag" onClick={e=>e.stopPropagation()}>
            {typeLabel[lightbox.type]||'기타'}
          </div>
          {lightbox.note && (
            <div className="gv-lb-note" onClick={e=>e.stopPropagation()}>{lightbox.note}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── COVER TAB ────────────────────────────────────────────────────────────
function CoverTab() {
  const ctx = React.useContext(window.CoverContext);
  const PRE = "'Pretendard Variable','Noto Sans KR',sans-serif";

  const COVERS = [
    { key: 'app',   label: '앱 표지',  sub: '홈 화면 배경 이미지' },
    { key: 'front', label: '앞표지',   sub: '책 첫 번째 페이지' },
    { key: 'back',  label: '뒷표지',   sub: '책 마지막 페이지' },
  ];

  const handleFile = (key) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => ctx.set(key, ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, paddingTop:4 }}>
      {COVERS.map(({ key, label, sub }) => (
        <div key={key} style={{
          border:'0.5px solid #e8e8e8', borderRadius:10, overflow:'hidden',
          background:'#fff',
        }}>
          {/* 미리보기 */}
          <div style={{
            width:'100%', aspectRatio:'3/4', background:'#f0f0f0',
            display:'flex', alignItems:'center', justifyContent:'center',
            position:'relative', overflow:'hidden',
          }}>
            {ctx[key]
              ? <img src={ctx[key]} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} alt={label} />
              : <div style={{ fontFamily:PRE, fontSize:11, color:'#bbb', letterSpacing:'0.12em' }}>이미지 없음</div>
            }
          </div>
          {/* 컨트롤 */}
          <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:PRE, fontWeight:500, fontSize:12, color:'#111', marginBottom:2 }}>{label}</div>
              <div style={{ fontFamily:PRE, fontWeight:200, fontSize:10, color:'#aaa' }}>{sub}</div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <label style={{
                fontFamily:PRE, fontSize:10, fontWeight:400,
                color:'#fff', background:'#111',
                padding:'5px 11px', borderRadius:8, cursor:'pointer',
              }}>
                {ctx[key] ? '교체' : '선택'}
                <input type="file" accept="image/*" style={{ display:'none' }}
                  onChange={handleFile(key)} />
              </label>
              {ctx[key] && (
                <button onClick={() => ctx.set(key, '')} style={{
                  fontFamily:PRE, fontSize:10, fontWeight:300,
                  color:'#c06060', background:'none',
                  border:'0.5px solid #f0d0d0',
                  padding:'5px 10px', borderRadius:8, cursor:'pointer',
                }}>제거</button>
              )}
            </div>
          </div>
        </div>
      ))}
      <div style={{ fontFamily:PRE, fontSize:9.5, color:'#bbb', letterSpacing:'0.06em', lineHeight:1.8, marginTop:4 }}>
        이미지는 기기에 저장되며 앱을 열면 자동으로 불러옵니다.
      </div>
    </div>
  );
}

// ─── EDIT PANEL (display-only, read-only mock) ─────────────────────────────
function EditView({ quarters, rounds, poems, freePoems, galleryItems }) {
  const [tab, setTab] = React.useState('quarters');
  const tabs = [
    { id:'cover',    label:'표지' },
    { id:'quarters', label:'분기' }, { id:'rounds', label:'회차' },
    { id:'poems',    label:'시' },   { id:'free',   label:'자유시' },
    { id:'gallery',  label:'갤러리' },
  ];
  const qSorted = [...quarters].sort((a,b)=>a.order-b.order);
  const rSorted = [...rounds].sort((a,b)=>a.order-b.order);
  const pSorted = [...poems].sort((a,b)=>a.order-b.order);
  const fSorted = [...freePoems].sort((a,b)=>a.order-b.order);
  const gSorted = [...galleryItems].sort((a,b)=>a.order-b.order);

  const card = (title, sub, preview) => (
    <div className="ev-card" key={title+sub}>
      <div className="ev-card-info">
        <div className="ev-card-title">{title}</div>
        <div className="ev-card-sub">{sub}</div>
        {preview && <div className="ev-card-preview">{preview}</div>}
      </div>
      <div className="ev-card-actions">
        <button className="ev-btn">수정</button>
        <button className="ev-btn ev-del">삭제</button>
      </div>
    </div>
  );

  return (
    <div className="ev-root">
      <div className="ev-notice">
        <strong>Firebase 연결</strong> — <code>.env.local</code>에 설정값을 입력하세요.
        컬렉션: <code>quarters · rounds · poems · freePoems · gallery</code>
      </div>
      <div className="ev-tabs">
        {tabs.map(t=>(
          <button key={t.id} className={`ev-tab${tab===t.id?' active':''}`}
            onClick={()=>setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="ev-body">
        {tab==='cover' && <CoverTab />}
        {tab==='quarters' && (
          <>
            <div className="ev-section-hd">
              <span className="ev-section-label">분기 목록</span>
              <button className="ev-add">+ 분기 추가</button>
            </div>
            {qSorted.map(q=>card(q.title, `순서 ${q.order}`, q.intro||''))}
          </>
        )}
        {tab==='rounds' && (
          <>
            <div className="ev-section-hd">
              <span className="ev-section-label">회차 목록</span>
              <button className="ev-add">+ 회차 추가</button>
            </div>
            {rSorted.map(r=>{
              const q=quarters.find(x=>x.id===r.quarterId);
              return card(`${r.num}회차 — ${r.title}`, `${q?.title||''} · 순서 ${r.order}`);
            })}
          </>
        )}
        {tab==='poems' && (
          <>
            <div className="ev-section-hd">
              <span className="ev-section-label">시 목록</span>
              <button className="ev-add">+ 시 추가</button>
            </div>
            {pSorted.map(p=>{
              const r=rounds.find(x=>x.id===p.roundId);
              return card(p.title, `${p.poet} · ${r?.title||''}`, p.body.slice(0,50));
            })}
          </>
        )}
        {tab==='free' && (
          <>
            <div className="ev-section-hd">
              <span className="ev-section-label">자유시 목록</span>
              <button className="ev-add">+ 자유시 추가</button>
            </div>
            {fSorted.map(f=>{
              const q=quarters.find(x=>x.id===f.quarterId);
              return card(f.title, `${f.poet} · ${q?.title||''}`, f.body.slice(0,50));
            })}
          </>
        )}
        {tab==='gallery' && (
          <>
            <div className="ev-section-hd">
              <span className="ev-section-label">갤러리</span>
              <button className="ev-add">+ 이미지 추가</button>
            </div>
            {gSorted.map(g=>{
              const q=quarters.find(x=>x.id===g.quarterId);
              const tl={illust:'시 삽화',bg:'배경 삽화',etc:'기타'};
              return card(g.title,`${tl[g.type]||'기타'} · ${q?.title||''}`,g.note?.slice(0,50)||'');
            })}
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { GalleryView, EditView });
