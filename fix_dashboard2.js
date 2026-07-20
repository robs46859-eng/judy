const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

content = content.replace('      </section>\n    </div>\n\n      {/* Modals */}', '      </section>\n\n      {/* Modals */}');

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log("Fixed Dashboard.tsx 2");
