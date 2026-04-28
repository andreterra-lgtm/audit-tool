const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf8');

// Substituir @media print
const oldPrint = `@media print {
    body * { visibility: hidden; }
    #printable-report, #printable-report * { visibility: visible; }
    #printable-report {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0;
        padding: 0;
        background: transparent;
    }
    .no-print { display: none !important; }
}`;

const newPrint = `@media print {
    body * { display: none; }
    body, html { margin: 0; padding: 0; background: white; }
    #results-dashboard, #printable-report, #printable-report * { display: block; visibility: visible; }
    #printable-report {
        position: static;
        width: 100%;
        margin: 0;
        padding: 0;
        background: white;
    }
    .no-print { display: none !important; }
    .report-section { page-break-inside: avoid; }
}`;

css = css.replace(oldPrint, newPrint);
fs.writeFileSync('style.css', css, 'utf8');
console.log('style.css updated for print');
