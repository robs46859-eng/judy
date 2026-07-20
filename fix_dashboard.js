const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// Find the JudyDock column and remove it, then close the section.
const endRegex = /\{\/\* Persistent Judy Dock[\s\S]*?<\/aside>\n\s*<\/div>\n\s*<\/div>/g;

content = content.replace(endRegex, `      </section>\n    </div>`);

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log("Fixed Dashboard.tsx");
