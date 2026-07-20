const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// 1. Rename outer container
content = content.replace('<div className="dashboard-container">', '<div className="judy-immersive-layout">');

// 2. We'll reconstruct the layout.
// Find everything from {/* Top Panel */} down to {/* Content Area... */}
const topToMainRegex = /\{\/\* Top Panel \*\/\}[\s\S]*?(?=\{\/\* Content Area — main content with Judy dock alongside \*\/\})/g;

const newHeaderNav = `
      {/* Floating Top Nav Header */}
      <header className="immersive-top-header">
        <div className="logo-section">
          <Image
            src="/brand/judy-logo.png"
            alt="Judy"
            width={78}
            height={52}
            className="judy-logo"
            priority
          />
        </div>

        <nav className="immersive-nav-bar">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={\`nav-item \${activeTab === item.key ? "active" : ""}\`}
              aria-current={activeTab === item.key ? "page" : undefined}
              onClick={() => {
                if (item.key === "contact") {
                  setContactOpen(true);
                } else {
                  setActiveTab(item.key);
                }
              }}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="top-actions">
          {avatarAdmin && (
            <a className="icon-button" href="/admin/avatar" title="Avatar Manager">
              <Upload size={20} aria-hidden="true" />
            </a>
          )}
          <button className="icon-button" onClick={() => setProfileOpen(true)} title="Profile">
            <User size={20} aria-hidden="true" />
          </button>
          <button className="icon-button" onClick={toggleTheme} title="Toggle Theme">
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="icon-button" onClick={() => signOut({ callbackUrl: "/login" })} title="Sign Out">
            <LogOut size={20} />
          </button>
          <div className="dropdown-container">
            <button
              className="affiliate-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <Compass size={18} /> Affiliate Links <ChevronDown size={14} />
            </button>
            {dropdownOpen && (
              <div className="dropdown-menu affiliate-menu">
                {affiliates.map((aff, i) => (
                  <a key={i} href={aff.url} className="dropdown-item" target="_blank" rel="noreferrer">
                    {aff.icon}
                    <span>{aff.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Avatar Stage */}
      <section className="immersive-avatar-stage">
        <JudyDock
          tripContext={trip}
          userName={userName}
          userEmail={userEmail}
          avatarModelUrl={avatarModelUrl}
        />
      </section>

      {/* Scrollable Content Pane */}
      <section className="immersive-dashboard-content">
`;

content = content.replace(topToMainRegex, newHeaderNav);

// 3. Remove the old `<div className="content-with-dock">` line
content = content.replace('<div className="content-with-dock">', '');

// 4. Find the old JudyDock block and the closing tags and replace them with the new closing tags
const endRegex = /\{\/\* Persistent Judy Dock[^\}]*\}\n\s*<aside className="judy-dock-column"[^\}]*\}\n\s*\/>\n\s*<\/aside>\n\s*<\/div>\n\s*<\/div>/g;

content = content.replace(endRegex, `      </section>\n    </div>`);

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log("Dashboard.tsx updated");
