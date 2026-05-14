// Landscape phone bezel — a 90° rotated iPhone-like shell. Used to host the
// two-page spread mode. Built from scratch (not via IOSDevice's transform)
// so children render in landscape coordinates directly.

function LandscapeFrame({ width = 874, height = 402, dark = false, children }) {
  return (
    <div style={{
      width, height, borderRadius: 48, overflow: 'hidden',
      position: 'relative', background: dark ? '#000' : '#F2F2F7',
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
    }}>
      {/* dynamic island — rotated to the LEFT short edge (where the front
          camera sits when phone is landscape, home button on right) */}
      <div style={{
        position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
        width: 37, height: 126, borderRadius: 24, background: '#000', zIndex: 50,
      }} />

      {/* status bar (landscape, top edge) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 32px 0 60px', zIndex: 20, pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: '-apple-system, "SF Pro", system-ui', fontWeight: 600,
          fontSize: 13, color: dark ? '#fff' : '#000',
        }}>9:41</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <svg width="15" height="10" viewBox="0 0 19 12">
            <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={dark ? '#fff' : '#000'}/>
            <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={dark ? '#fff' : '#000'}/>
            <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={dark ? '#fff' : '#000'}/>
            <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={dark ? '#fff' : '#000'}/>
          </svg>
          <svg width="22" height="11" viewBox="0 0 27 13">
            <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={dark ? '#fff' : '#000'} strokeOpacity="0.35" fill="none"/>
            <rect x="2" y="2" width="20" height="9" rx="2" fill={dark ? '#fff' : '#000'}/>
            <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={dark ? '#fff' : '#000'} fillOpacity="0.4"/>
          </svg>
        </div>
      </div>

      {/* content area — leave gutter for dynamic island on the left,
          status bar on top */}
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 60, right: 0,
        overflow: 'hidden',
      }}>
        {children}
      </div>

      {/* home indicator — bottom edge, narrower */}
      <div style={{
        position: 'absolute', bottom: 8, left: 60, right: 0, height: 6,
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        pointerEvents: 'none', zIndex: 60,
      }}>
        <div style={{
          width: 110, height: 4, borderRadius: 100,
          background: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.25)',
        }} />
      </div>
    </div>
  );
}

Object.assign(window, { LandscapeFrame });
