const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

const immersiveCSS = `
/* ═══════════════════════════════════════════
   IMMERSIVE AVATAR-CENTRIC LAYOUT
   ═══════════════════════════════════════════ */
.judy-immersive-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: relative;
  background: var(--bg);
}

.immersive-top-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  z-index: 50;
  background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%);
  pointer-events: none; /* Let clicks pass through empty areas */
}

.immersive-top-header > * {
  pointer-events: auto; /* Re-enable clicks on header items */
}

.immersive-nav-bar {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.5rem 1.5rem;
  border-radius: 99px;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
}

.immersive-nav-bar .nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
  background: transparent;
  border: none;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 99px;
  transition: all 0.2s ease;
}

.immersive-nav-bar .nav-item:hover, .immersive-nav-bar .nav-item.active {
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
}

.immersive-avatar-stage {
  flex: 0 0 65vh; /* Top 65% is the avatar */
  position: relative;
  z-index: 10;
  overflow: hidden;
}

.immersive-dashboard-content {
  flex: 1;
  position: relative;
  z-index: 20;
  background: var(--panel-bg);
  backdrop-filter: blur(24px);
  border-top: 1px solid var(--panel-border);
  box-shadow: 0 -20px 40px rgba(0,0,0,0.2);
  border-radius: 32px 32px 0 0;
  margin-top: -32px; /* Overlap the avatar stage slightly */
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center; /* Center the dashboard cards */
}

.immersive-dashboard-content .content-area {
  width: 100%;
  max-width: 1200px; /* Keep dashboard cards readable */
}

@media (max-width: 1024px) {
  .immersive-top-header {
    flex-wrap: wrap;
    height: auto;
    padding: 1rem;
    gap: 1rem;
    background: var(--panel-bg);
    border-bottom: 1px solid var(--panel-border);
  }
  .immersive-nav-bar {
    width: 100%;
    overflow-x: auto;
    padding: 0.5rem;
  }
  .immersive-avatar-stage {
    flex: 0 0 50vh; /* Smaller on mobile */
  }
  .immersive-dashboard-content {
    border-radius: 24px 24px 0 0;
    margin-top: -24px;
    padding: 1.5rem;
  }
}
`;

// Append to the end of the file since it's cleaner than regex replacing old CSS which might have other rules intertwined.
css += "\n" + immersiveCSS;
fs.writeFileSync('src/app/globals.css', css);
console.log("Added layout styles to globals.css");
