// sihwa-full.jsx — wraps the book + gallery + edit into a single cohesive
// mobile prototype with the same top-bar navigation as the live app.

const { useState: useSF, useMemo: useSFMemo, useCallback: useSFCB } = React;

// ─── Top Navigation Bar ───────────────────────────────────────────────────
function SihwaTopBar({ active, onNav }) {
  const tabs = [
  { id: 'toc', label: '차례' },
  { id: 'book', label: '읽기' },
  { id: 'gallery', label: '갤러리' },
  { id: 'edit', label: '편집' }];

  return (
    <div className="stb-root">
      <div className="stb-title">시화 詩和</div>
      <div className="stb-nav">
        {tabs.map((t) =>
        <button
          key={t.id}
          className={`stb-btn${active === t.id ? ' active' : ''}`}
          onClick={() => onNav(t.id)}>
          {t.label}</button>
        )}
      </div>
    </div>);

}

// ─── Full App ─────────────────────────────────────────────────────────────
function SihwaFull({ pagesSingle, pagesSpread, mode = 'single' }) {
  const data = SIHWA_DATA;
  const pages = mode === 'spread' ? pagesSpread : pagesSingle;

  // Unified nav state.
  const [view, useSFSetView] = useSF('cover'); // cover|toc|book|gallery|edit
  const [bookIdx, setBookIdx] = useSF(() =>
  indexOfFirst(pagesSingle, 'front-cover')
  );

  // Password gate for edit.
  const [pwInput, setPwInput] = useSF('');
  const [pwErr, setPwErr] = useSF(false);
  const [showPw, setShowPw] = useSF(false);

  // Cover image URLs — persisted to localStorage.
  const [covers, setCovers] = useSF(() => ({
    app:   localStorage.getItem('sihwa_cover_app')   || '',
    front: localStorage.getItem('sihwa_cover_front') || '',
    back:  localStorage.getItem('sihwa_cover_back')  || '',
  }));
  const updateCover = useSFCB((key, url) => {
    localStorage.setItem(`sihwa_cover_${key}`, url);
    setCovers(c => ({ ...c, [key]: url }));
  }, []);

  const setView = useSFCB((v) => {
    if (v === 'edit') {setShowPw(true);return;}
    useSFSetView(v);
    if (v === 'toc') setBookIdx(indexOfFirst(pagesSingle, 'toc-title'));
    if (v === 'book') {/* keep current reading position */}
  }, [pagesSingle]);

  const checkPw = () => {
    if (pwInput === 'tlghk2026') {
      setShowPw(false);useSFSetView('edit');
    } else {
      setPwErr(true);
    }
  };

  // Jump from TOC item → reading position.
  const jumpToPoem = useSFCB((poemId) => {
    const idx = pagesSingle.findIndex((p) =>
    (p.poem?.id === poemId || p.freePoem?.id === poemId) && (p.chunkIdx ?? 0) === 0
    );
    if (idx >= 0) {setBookIdx(idx);useSFSetView('book');}
  }, [pagesSingle]);

  const isBookView = view === 'toc' || view === 'book' || view === 'cover';

  return (
    <window.CoverContext.Provider value={{ ...covers, set: updateCover }}>
    <div className="sf-root">
      {/* Status bar spacer — IOSDevice already handles the real one when
                   this is rendered inside IOSDevice. Outside it, we add a tiny spacer. */}
      <SihwaTopBar active={view} onNav={setView} />

      <div className="sf-body">
        {/* COVER */}
        {view === 'cover' && (
          <div style={{ flex:1, position:'relative', overflow:'hidden', minHeight:0 }}>
            {/* 이미지가 있으면 보여주고, 없으면 image-slot 플레이스홀더 */}
            {covers.app
              ? <img src={covers.app} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }} alt="표지" />
              : <image-slot
                  id="app-cover-photo"
                  placeholder="시화 표지 이미지 — 드래그하거나 클릭"
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block' }}
                />
            }
            <div style={{
              position:'absolute', bottom:0, left:0, right:0, height:'45%',
              background:'linear-gradient(to top, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0) 100%)',
              pointerEvents:'none',
            }} />
            <div style={{
              position:'absolute', bottom:0, left:0, right:0,
              padding:'0 24px 28px',
              display:'flex', flexDirection:'column', alignItems:'center', gap:14,
            }}>
              <div style={{
                fontFamily:"'Pretendard Variable','Noto Sans KR',sans-serif",
                fontWeight:200, fontSize:10, letterSpacing:'0.56em',
                color:'rgba(255,255,255,0.65)', textTransform:'uppercase',
              }}>시화 詩和 · 글빛을 모아 담다</div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setView('toc')} style={{
                  fontFamily:"'Pretendard Variable','Noto Sans KR',sans-serif",
                  fontWeight:300, fontSize:11, letterSpacing:'0.1em',
                  color:'#fff', background:'rgba(255,255,255,0.14)',
                  border:'0.5px solid rgba(255,255,255,0.38)',
                  padding:'9px 20px', borderRadius:'20px',
                  cursor:'pointer', backdropFilter:'blur(10px)',
                  WebkitBackdropFilter:'blur(10px)',
                }}>차례 보기</button>
                <button onClick={() => { setView('book'); setBookIdx(indexOfFirst(pagesSingle, 'quarter-divider')); }} style={{
                  fontFamily:"'Pretendard Variable','Noto Sans KR',sans-serif",
                  fontWeight:300, fontSize:11, letterSpacing:'0.1em',
                  color:'rgba(255,255,255,0.7)', background:'transparent',
                  border:'0.5px solid rgba(255,255,255,0.22)',
                  padding:'9px 20px', borderRadius:'20px',
                  cursor:'pointer',
                }}>바로 읽기</button>
              </div>
            </div>
          </div>
        )}

        {/* BOOK (toc + reading share the same book) */}
        {isBookView && view !== 'cover' &&
        <Book
          pages={pages}
          mode={mode}
          initialIdx={bookIdx}
          forcedIdx={bookIdx}
          onIdxChange={setBookIdx}
          showBookmark />

        }

        {/* GALLERY */}
        {view === 'gallery' &&
        <div className="sf-scroll">
            <GalleryView
            items={data.galleryItems}
            quarters={data.quarters} />
          
          </div>
        }

        {/* EDIT */}
        {view === 'edit' &&
        <div className="sf-scroll sf-scroll-dark">
            <EditView
            quarters={data.quarters}
            rounds={data.rounds}
            poems={data.poems}
            freePoems={data.freePoems}
            galleryItems={data.galleryItems} />
          
          </div>
        }
      </div>

      {/* Password modal */}
      {showPw &&
      <div className="sf-pw-backdrop" onClick={() => {setShowPw(false);setPwErr(false);}}>
          <div className="sf-pw-box" onClick={(e) => e.stopPropagation()}>
            <div className="sf-pw-title">편집 모드</div>
            <input
            className="sf-pw-input"
            type="password"
            placeholder="비밀번호"
            value={pwInput}
            onChange={(e) => {setPwInput(e.target.value);setPwErr(false);}}
            onKeyDown={(e) => e.key === 'Enter' && checkPw()}
            autoFocus />
          
            {pwErr && <div className="sf-pw-err">비밀번호가 맞지 않아요</div>}
            <div className="sf-pw-actions">
              <button className="sf-pw-btn cancel"
            onClick={() => {setShowPw(false);setPwErr(false);}}>취소</button>
              <button className="sf-pw-btn confirm" onClick={checkPw}>확인</button>
            </div>
          </div>
        </div>
      }
    </div>
    </window.CoverContext.Provider>
  );
}

// Helper — also used in app.jsx for landing index.
function indexOfFirst(pages, type) {
  for (let i = 0; i < pages.length; i++) if (pages[i].type === type) return i;
  return 0;
}

Object.assign(window, { SihwaFull, SihwaTopBar, indexOfFirst });