const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf-8');

const immersiveDockCSS = `
/* Immersive Avatar Stage Overrides */
.immersive-avatar-stage .judy-dock {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.immersive-avatar-stage .judy-dock-avatar {
  flex: 1; /* Take up all the stage space */
  border: none;
  background: transparent;
}

.immersive-avatar-stage .judy-glb-avatar {
  width: 100%;
  height: 100%;
}

.immersive-avatar-stage .judy-chat-inline {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 800px;
  background: rgba(30, 30, 30, 0.4);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  margin-bottom: 40px; /* Float above the bottom edge */
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
}

.immersive-avatar-stage .judy-chat-messages {
  max-height: 200px; /* Keep chat small when floating over avatar */
  overflow-y: auto;
}

/* Ensure speech captions are centered and large in immersive mode */
.immersive-avatar-stage .judy-speech-caption-docked {
  position: absolute;
  bottom: 120px; /* Above the chat */
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.5rem;
  padding: 1rem 2rem;
  border-radius: 99px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  white-space: nowrap;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}

.immersive-avatar-stage .judy-quick-actions {
  position: absolute;
  top: 1rem;
  right: 1rem;
  flex-direction: column;
  z-index: 60;
}
`;

css += "\n" + immersiveDockCSS;
fs.writeFileSync('src/app/globals.css', css);
console.log("Added immersive dock styles to globals.css");
