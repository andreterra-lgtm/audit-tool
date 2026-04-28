const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// 1. Replace fetch API
appJs = appJs.replace(`fetch('/api/questions')`, `fetch('questions.json')`);

// 2. Remove history logic and modify submitAudit
// Find where submitAudit starts
const submitAuditIndex = appJs.indexOf('submitAudit: async function () {');
if (submitAuditIndex !== -1) {
    // Keep everything before submitAudit
    const beforeSubmit = appJs.substring(0, submitAuditIndex);
    
    const newEnd = `submitAudit: function () {
        const total = parseFloat(document.getElementById('final-score').innerText);
        const summary = document.getElementById('final_diagnosis').value || "Sem resumo";
        
        const reportDiv = document.getElementById('printable-report');
        
        let html = \`<div class="no-print" style="margin-bottom: 20px; text-align: center;">
            <button class="btn-submit" style="display:inline-block; width:auto; margin:0;" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
            <button class="btn-outline" style="display:inline-block; width:auto; margin:0; margin-left: 10px;" onclick="location.reload()">Nova Auditoria</button>
        </div>\`;
        
        html += \`<div class="report-header">
            <h2>Relatório de Auditoria - \${this.metadata.unitName}</h2>
            <p>Gerado pelo sistema Trilhas de Alta Performance</p>
        </div>\`;
        
        html += \`<div class="report-meta">
            <p><strong>Unidade:</strong> \${this.metadata.unitName}</p>
            <p><strong>Cidade:</strong> \${this.metadata.city}</p>
            <p><strong>Consultor:</strong> \${this.metadata.inspector}</p>
            <p><strong>Data:</strong> \${this.metadata.date}</p>
        </div>\`;
        
        html += \`<div class="report-score">Nota Final: \${total.toFixed(1)}</div>\`;
        
        if (this.questions && this.questions.pillars) {
            this.questions.pillars.forEach(pillar => {
                html += \`<div class="report-section"><h3>\${pillar.name}</h3>\`;
                pillar.blocks.forEach(block => {
                    let blockSum = 0; let qCount = 0;
                    block.questions.forEach(q => {
                        if(this.responses[q.id] !== undefined) {
                            blockSum += parseFloat(this.responses[q.id]);
                            qCount++;
                        }
                    });
                    let blockScore = 0;
                    if(qCount > 0) blockScore = ((blockSum / qCount) / 5) * 10;
                    
                    html += \`<div class="report-item">
                        <span>\${block.name}</span>
                        <span class="grade">\${blockScore.toFixed(1)} / 10</span>
                    </div>\`;
                });
                html += \`</div>\`;
            });
        }
        
        if (this.questions && this.questions.pillars_section2) {
            this.questions.pillars_section2.forEach(pillar => {
                html += \`<div class="report-section"><h3>\${pillar.name}</h3>\`;
                pillar.blocks.forEach(block => {
                    let blockSum = 0; let qCount = 0;
                    block.questions.forEach(q => {
                        if(this.responses[q.id] !== undefined) {
                            blockSum += parseFloat(this.responses[q.id]);
                            qCount++;
                        }
                    });
                    let blockScore = 0;
                    if(qCount > 0) blockScore = ((blockSum / qCount) / 5) * 10;
                    
                    html += \`<div class="report-item">
                        <span>\${block.name}</span>
                        <span class="grade">\${blockScore.toFixed(1)} / 10</span>
                    </div>\`;
                });
                html += \`</div>\`;
            });
        }
        
        if (summary) {
            html += \`<div class="report-section">
                <h3>Resumo Executivo</h3>
                <p style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">\${summary}</p>
            </div>\`;
        }

        reportDiv.innerHTML = html;
        document.getElementById('step-final').classList.add('hidden');
        document.getElementById('audit-form-container').innerHTML = '';
        document.getElementById('step-0').classList.add('hidden');
        document.getElementById('results-dashboard').classList.remove('hidden');
        document.getElementById('results-dashboard').classList.add('active');
        window.scrollTo(0, 0);
    }
};

window.onload = () => app.init();
`;
    fs.writeFileSync('app.js', beforeSubmit + newEnd, 'utf8');
}
