const app = {
    questions: null,
    responses: {},
    topicResponses: {},
    blockDiagnoses: {},
    metadata: {},
    _pdf: null,
    _logoBase64: null,
    _questionBlockMap: null,

    // ── Persistence ──────────────────────────────────────────────────────────
    saveProgress: function () {
        try {
            localStorage.setItem('audit_progress', JSON.stringify({
                responses: this.responses,
                topicResponses: this.topicResponses,
                blockDiagnoses: this.blockDiagnoses,
                metadata: this.metadata,
                savedAt: new Date().toISOString()
            }));
        } catch (_) {}
    },

    loadProgress: function () {
        try {
            const raw = localStorage.getItem('audit_progress');
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    },

    clearProgress: function () {
        localStorage.removeItem('audit_progress');
        this.responses = {};
        this.topicResponses = {};
        this.blockDiagnoses = {};
        this.metadata = {};
        const banner = document.getElementById('resume-banner');
        if (banner) banner.classList.add('hidden');
    },

    resumeAudit: function () {
        const saved = this.loadProgress();
        if (!saved) return;
        this.responses      = saved.responses      || {};
        this.topicResponses = saved.topicResponses || {};
        this.blockDiagnoses = saved.blockDiagnoses || {};
        this.metadata       = saved.metadata       || {};

        const fields = { unit_name: 'unitName', city: 'city', licensee_name: 'licensee', inspector_name: 'inspector', visit_date: 'date' };
        for (const [id, key] of Object.entries(fields)) {
            if (this.metadata[key]) document.getElementById(id).value = this.metadata[key];
        }
        document.getElementById('resume-banner').classList.add('hidden');
        document.getElementById('step-0').classList.remove('active');
        document.getElementById('step-0').classList.add('hidden');
        this.renderForm();
    },

    // ── Init ─────────────────────────────────────────────────────────────────
    init: async function () {
        try {
            const res = await fetch('questions.json');
            this.questions = await res.json();
        } catch (_) {
            this.showToast('Erro ao carregar perguntas. Verifique o servidor.', 'error');
            return;
        }

        // Pre-fetch logo as base64 — makes exportPDF() fully synchronous (iOS fix)
        try {
            const r = await fetch('logo.png');
            const b = await r.blob();
            this._logoBase64 = await new Promise(res => {
                const fr = new FileReader();
                fr.onloadend = () => res(fr.result);
                fr.readAsDataURL(b);
            });
        } catch (_) {}

        const saved = this.loadProgress();
        if (saved?.metadata?.unitName) {
            const d = new Date(saved.savedAt).toLocaleString('pt-BR');
            document.getElementById('resume-info').innerText =
                `${saved.metadata.unitName} — ${saved.metadata.date} (salvo em ${d})`;
            document.getElementById('resume-banner').classList.remove('hidden');
        }

        document.getElementById('visit_date').value = new Date().toISOString().split('T')[0];
    },

    showToast: function (msg, type = 'info') {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.style.display = 'block';
        t.style.background = type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(10,20,40,0.95)';
        t.style.borderColor = type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(0,255,136,0.3)';
        t.style.color = type === 'error' ? '#fff' : '#e2e8f0';
        setTimeout(() => t.style.display = 'none', 3500);
    },

    // ── Start Audit ───────────────────────────────────────────────────────────
    startAudit: function () {
        const unitName  = document.getElementById('unit_name').value.trim();
        const city      = document.getElementById('city').value.trim();
        const licensee  = document.getElementById('licensee_name').value.trim();
        const inspector = document.getElementById('inspector_name').value.trim();
        const date      = document.getElementById('visit_date').value;

        if (!unitName || !city || !licensee || !inspector || !date) {
            this.showToast('Preencha todos os campos de identificação.');
            return;
        }

        this.metadata = { unitName, city, licensee, inspector, date };
        this.saveProgress();
        document.getElementById('step-0').classList.remove('active');
        document.getElementById('step-0').classList.add('hidden');
        this.renderForm();
    },

    // ── Render Form ───────────────────────────────────────────────────────────
    renderForm: function () {
        this._questionBlockMap = {};
        const container = document.getElementById('audit-form-container');
        container.innerHTML = '';

        this.questions.sections.forEach(section => {
            if (!section.questions.length) return;
            const sDiv = document.createElement('section');
            sDiv.className = 'card active section-group';
            sDiv.innerHTML = `<h2>${section.name}</h2>`;
            section.questions.forEach(q => {
                let inputHtml = '';
                if (q.type === 'multiple_choice') {
                    inputHtml = `<div class="options-container" id="opts-${q.id}">
                        ${(q.options || []).map(opt =>
                            `<div class="choice-chip" onclick="app.setValue('${q.id}','${opt.replace(/'/g,"\\'")}')">${opt}</div>`
                        ).join('')}
                    </div>`;
                } else if (q.type === 'paragraph') {
                    inputHtml = `<textarea oninput="app.setValue('${q.id}',this.value)" rows="3" placeholder="Sua resposta..."></textarea>`;
                } else if (q.type === 'date') {
                    inputHtml = `<input type="date" oninput="app.setValue('${q.id}',this.value)">`;
                } else {
                    inputHtml = `<input type="text" oninput="app.setValue('${q.id}',this.value)" placeholder="Resposta curta...">`;
                }
                const qDiv = document.createElement('div');
                qDiv.className = 'form-group question-row';
                qDiv.innerHTML = `<label>${q.text}</label>${inputHtml}`;
                sDiv.appendChild(qDiv);
            });
            container.appendChild(sDiv);
        });

        if (this.questions.pillars?.length) {
            container.appendChild(this._sectionHeading('PRIMEIRA SEÇÃO — INSPEÇÃO DA UNIDADE'));
            this.questions.pillars.forEach(p => container.appendChild(this._renderPillar(p, true)));
        }

        if (this.questions.pillars_section2?.length) {
            container.appendChild(this._sectionHeading('SEGUNDA SEÇÃO — GESTÃO'));
            this.questions.pillars_section2.forEach(p => container.appendChild(this._renderPillar(p, false)));
        }

        document.getElementById('step-final').classList.remove('hidden');
        document.getElementById('step-final').classList.add('active');
        this.restoreUIState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    _sectionHeading: function (text) {
        const h = document.createElement('h2');
        h.className = 'section-title';
        h.innerText = text;
        return h;
    },

    _renderPillar: function (pillar, showWeight) {
        const pDiv = document.createElement('section');
        pDiv.className = 'pillar-section card active';

        if (pillar.description) {
            const p = document.createElement('p');
            p.className = 'section-description';
            p.innerText = pillar.description;
            pDiv.appendChild(p);
        }

        pillar.blocks.forEach(block => {
            // Register all questions in the map for progress tracking
            block.questions.forEach(q => { this._questionBlockMap[q.id] = block; });

            const bDiv = document.createElement('div');
            bDiv.className = 'block-card';

            const wtag = (showWeight && block.weight) ? `<span class="weight-tag">${block.weight}%</span>` : '';
            const totalQ = block.questions.length;
            bDiv.innerHTML = `
                <h3 class="block-title">
                    <span>${block.name}${wtag}</span>
                    <span class="block-progress" id="progress-${block.id}">0/${totalQ}</span>
                </h3>`;

            block.questions.forEach(q => {
                const qRow = document.createElement('div');
                qRow.className = 'question-row performance-q';

                if (q.topics?.length) {
                    const topicsHtml = q.topics.map((topic, i) => `
                        <div class="topic-row custom-topic-row">
                            <div class="topic-title">${topic}</div>
                            <div class="topic-options">
                                <label class="topic-radio conforme-radio" id="label-conforme-${q.id}-${i}">
                                    <input type="radio" name="topic-${q.id}-${i}" value="conforme"
                                        onchange="app.setTopicScore('${q.id}',${i},'conforme',${q.topics.length})">
                                    <span>Conforme</span>
                                </label>
                                <label class="topic-radio nconforme-radio" id="label-nconforme-${q.id}-${i}">
                                    <input type="radio" name="topic-${q.id}-${i}" value="naoconforme"
                                        onchange="app.setTopicScore('${q.id}',${i},'naoconforme',${q.topics.length})">
                                    <span>Não Conforme</span>
                                </label>
                            </div>
                        </div>`).join('');
                    qRow.innerHTML = `
                        <div class="question-text">${q.text}</div>
                        <div class="topics-container" id="opts-${q.id}">${topicsHtml}</div>
                        <div class="question-score-line">
                            Nota: <span id="score-${q.id}">0.0</span> / 5.0
                        </div>`;
                } else {
                    qRow.innerHTML = `
                        <div class="question-text">${q.text}</div>
                        <div class="simple-star-radio" id="opts-${q.id}">
                            ${[1,2,3,4,5].map(s => `
                                <label class="radio-label">
                                    <input type="radio" name="rating-${q.id}" value="${s}"
                                        onchange="app.setScore('${q.id}',${s})">
                                    <span class="stars-text">${'★'.repeat(s)}</span>
                                </label>`).join('')}
                        </div>`;
                }
                bDiv.appendChild(qRow);
            });

            const diagDiv = document.createElement('div');
            diagDiv.className = 'block-diagnosis-field';
            diagDiv.innerHTML = `
                <label class="diagnosis-label">Diagnóstico do Bloco (opcional)</label>
                <textarea id="diag-${block.id}" maxlength="300" rows="2"
                    placeholder="Observações do auditor para este bloco..."
                    oninput="app.setBlockDiagnosis('${block.id}',this.value)"></textarea>
                <span class="char-counter" id="counter-${block.id}">0/300</span>`;
            bDiv.appendChild(diagDiv);
            pDiv.appendChild(bDiv);
        });

        return pDiv;
    },

    // ── Restore UI after Resume ───────────────────────────────────────────────
    restoreUIState: function () {
        for (const [qId, value] of Object.entries(this.responses)) {
            document.querySelectorAll(`#opts-${qId} .choice-chip`).forEach(c =>
                c.classList.toggle('active', c.innerText === value));
            const radio = document.querySelector(`input[name="rating-${qId}"][value="${value}"]`);
            if (radio) radio.checked = true;
            const scoreEl = document.getElementById('score-' + qId);
            if (scoreEl && typeof value === 'number') scoreEl.innerText = value.toFixed(1);
        }
        for (const [qId, topics] of Object.entries(this.topicResponses)) {
            for (const [i, value] of Object.entries(topics)) {
                const r = document.querySelector(`input[name="topic-${qId}-${i}"][value="${value}"]`);
                if (r) r.checked = true;
                document.getElementById(`label-conforme-${qId}-${i}`)?.classList.toggle('selected', value === 'conforme');
                document.getElementById(`label-nconforme-${qId}-${i}`)?.classList.toggle('selected', value === 'naoconforme');
            }
        }
        for (const [blockId, value] of Object.entries(this.blockDiagnoses)) {
            const ta = document.getElementById('diag-' + blockId);
            if (ta) ta.value = value;
            const counter = document.getElementById('counter-' + blockId);
            if (counter) counter.innerText = value.length + '/300';
        }

        // Restore block progress counters
        const allBlocks = [
            ...(this.questions.pillars?.flatMap(p => p.blocks) || []),
            ...(this.questions.pillars_section2?.flatMap(p => p.blocks) || [])
        ];
        allBlocks.forEach(b => this._updateBlockProgress(b));

        this.calculateTotal();
    },

    // ── Value Setters ─────────────────────────────────────────────────────────
    setValue: function (qId, value) {
        this.responses[qId] = value;
        document.querySelectorAll(`#opts-${qId} .choice-chip`).forEach(c =>
            c.classList.toggle('active', c.innerText === value));
        this.saveProgress();
    },

    setScore: function (qId, score) {
        this.responses[qId] = score;
        if (this._questionBlockMap?.[qId]) this._updateBlockProgress(this._questionBlockMap[qId]);
        this.calculateTotal();
        this.saveProgress();
    },

    setTopicScore: function (qId, index, value, totalTopics) {
        if (!this.topicResponses[qId]) this.topicResponses[qId] = {};
        this.topicResponses[qId][index] = value;

        let conformes = 0;
        for (const v of Object.values(this.topicResponses[qId])) {
            if (v === 'conforme') conformes++;
        }
        const score = (conformes / totalTopics) * 5;
        this.responses[qId] = score;

        const scoreSpan = document.getElementById('score-' + qId);
        if (scoreSpan) scoreSpan.innerText = score.toFixed(1);

        document.getElementById(`label-conforme-${qId}-${index}`)?.classList.toggle('selected', value === 'conforme');
        document.getElementById(`label-nconforme-${qId}-${index}`)?.classList.toggle('selected', value === 'naoconforme');

        if (this._questionBlockMap?.[qId]) this._updateBlockProgress(this._questionBlockMap[qId]);
        this.calculateTotal();
        this.saveProgress();
    },

    setBlockDiagnosis: function (blockId, value) {
        this.blockDiagnoses[blockId] = value.slice(0, 300);
        const counter = document.getElementById('counter-' + blockId);
        if (counter) counter.innerText = Math.min(value.length, 300) + '/300';
        this.saveProgress();
    },

    // ── Progress Tracking ─────────────────────────────────────────────────────
    _updateBlockProgress: function (block) {
        const el = document.getElementById('progress-' + block.id);
        if (!el) return;
        const answered = block.questions.filter(q => this.responses[q.id] !== undefined).length;
        const total = block.questions.length;
        el.innerText = `${answered}/${total}`;
        el.classList.toggle('complete', answered === total && total > 0);
    },

    _updateAuditProgress: function () {
        const fill = document.getElementById('audit-progress-fill');
        if (!fill || !this.questions) return;
        const allBlocks = [
            ...(this.questions.pillars?.flatMap(p => p.blocks) || []),
            ...(this.questions.pillars_section2?.flatMap(p => p.blocks) || [])
        ];
        const totalQ    = allBlocks.reduce((s, b) => s + b.questions.length, 0);
        const answeredQ = allBlocks.reduce((s, b) =>
            s + b.questions.filter(q => this.responses[q.id] !== undefined).length, 0);
        if (totalQ > 0) fill.style.width = ((answeredQ / totalQ) * 100).toFixed(1) + '%';
    },

    // ── Score Calculation ─────────────────────────────────────────────────────
    _blockScore: function (block) {
        const total = block.questions.length;
        if (total === 0) return 0;
        let sum = 0;
        block.questions.forEach(q => {
            sum += (this.responses[q.id] !== undefined) ? parseFloat(this.responses[q.id]) : 0;
        });
        return (sum / total / 5) * 10;
    },

    _sectionScore: function (pillars) {
        let weightedSum = 0, totalWeight = 0;
        pillars.forEach(pillar => {
            pillar.blocks.forEach(block => {
                const w = block.weight || 1;
                weightedSum += this._blockScore(block) * w;
                totalWeight += w;
            });
        });
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    },

    calculateTotal: function () {
        const sec1 = this._sectionScore(this.questions.pillars);
        const sec2 = this.questions.pillars_section2?.length
            ? this._sectionScore(this.questions.pillars_section2)
            : null;

        const final = sec2 !== null ? (sec1 + sec2) / 2 : sec1;

        const scoreEl = document.getElementById('final-score');
        const badge   = document.getElementById('total-score-badge');
        scoreEl.innerText = final.toFixed(1);

        const { color, label } = this._gradeOf(final);
        badge.style.borderColor = color;
        scoreEl.style.color     = color;
        document.querySelector('.score-badge .label').innerText = label;

        this._updateAuditProgress();
    },

    _gradeOf: function (score) {
        if (score < 6)  return { color: '#ef4444', label: 'CRÍTICA'         };
        if (score < 7)  return { color: '#f97316', label: 'ATENÇÃO'         };
        if (score < 8)  return { color: '#eab308', label: 'REGULAR'         };
        if (score < 9)  return { color: '#22c55e', label: 'BOA'             };
        return          { color: '#3b82f6',         label: 'ALTA PERFORMANCE' };
    },

    // ── Validation ────────────────────────────────────────────────────────────
    _emptyBlocks: function () {
        const empty = [];
        const check = (pillars) => pillars.forEach(p =>
            p.blocks.forEach(b => {
                if (!b.questions.some(q => this.responses[q.id] !== undefined))
                    empty.push(b.name);
            }));
        if (this.questions.pillars)          check(this.questions.pillars);
        if (this.questions.pillars_section2) check(this.questions.pillars_section2);
        return empty;
    },

    // ── Loading Overlay ───────────────────────────────────────────────────────
    _playLoadingSound: function () {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            // Pentatonic ascending: C5 E5 G5 A5 C6
            [523.25, 659.25, 783.99, 880, 1046.50].forEach((freq, i) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.value = freq;
                const t = ctx.currentTime + i * 0.18;
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.22, t + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
                osc.start(t);
                osc.stop(t + 0.5);
            });
            // Closing C-major chord
            [523.25, 659.25, 783.99].forEach(freq => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                const t = ctx.currentTime + 5 * 0.18 + 0.06;
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.09, t + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
                osc.start(t);
                osc.stop(t + 1.0);
            });
        } catch (_) {}
    },

    showLoading: function () {
        const el = document.getElementById('loading-overlay');
        el.classList.remove('hidden', 'fade-out');
        this._playLoadingSound();
    },

    hideLoading: function (cb) {
        const el = document.getElementById('loading-overlay');
        el.classList.add('fade-out');
        setTimeout(() => {
            el.classList.add('hidden');
            el.classList.remove('fade-out');
            if (cb) cb();
        }, 420);
    },

    // ── Submit & Report ───────────────────────────────────────────────────────
    submitAudit: function () {
        const empty = this._emptyBlocks();
        if (empty.length > 0) {
            const list = empty.map(n => `• ${n}`).join('\n');
            if (!confirm(`Os seguintes blocos estão sem resposta:\n\n${list}\n\nQuestões não respondidas serão contabilizadas com nota 0.\nDeseja finalizar mesmo assim?`)) return;
        }

        this.showLoading();

        setTimeout(() => {
            const sec1  = this._sectionScore(this.questions.pillars);
            const sec2  = this.questions.pillars_section2?.length
                ? this._sectionScore(this.questions.pillars_section2)
                : null;
            const total = sec2 !== null ? (sec1 + sec2) / 2 : sec1;

            const summary = document.getElementById('final_diagnosis').value.trim();
            const { unitName, city, inspector, date } = this.metadata;
            const { color, label } = this._gradeOf(total);

            const logoSrc    = this._logoBase64 || 'logo.png';
            const reportHTML = this._buildReportHTML({ sec1, sec2, total, color, label, unitName, city, inspector, date, summary });
            const pdfBody    = this._buildReportHTML({ sec1, sec2, total, color, label, unitName, city, inspector, date, summary }, true)
                                  .replace(/src="logo\.png"/g, `src="${logoSrc}"`);

            const filename = `Auditoria_${(unitName || 'relatorio').replace(/[^a-zA-Z0-9]/g,'_')}_${(date || '').replace(/-/g,'')}`;

            this._pdf = {
                fullHTML: this._buildPDFDocument(pdfBody, filename),
                filename
            };

            document.getElementById('printable-report').innerHTML = reportHTML;
            document.getElementById('step-final').classList.add('hidden');
            document.getElementById('audit-form-container').innerHTML = '';
            document.getElementById('step-0').classList.add('hidden');
            document.getElementById('results-dashboard').classList.remove('hidden');
            document.getElementById('results-dashboard').classList.add('active');

            const fill = document.getElementById('audit-progress-fill');
            if (fill) fill.style.width = '100%';

            this.clearProgress();
            this.hideLoading(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        }, 2600);
    },

    // ── PDF Document Builder ──────────────────────────────────────────────────
    _buildPDFDocument: function (bodyHTML, filename) {
        const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#1e293b;padding:22px 26px;font-size:10.5pt;line-height:1.5}
h2{font-size:15pt;color:#0f172a;margin:8px 0}
.report-header{text-align:center;border-bottom:2px solid #e2e8f0;padding-bottom:14px;margin-bottom:14px}
.report-header img{max-width:110px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto}
.report-header p{color:#64748b;font-size:8.5pt;margin:2px 0}
.report-meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:16px;background:#f8fafc;padding:12px 16px;border-radius:6px;border:1px solid #e2e8f0;font-size:9pt}
.report-meta p{margin:0}.report-meta strong{color:#0f172a}
.report-score{text-align:center;font-size:22pt;font-weight:800;margin:14px 0;line-height:1.2}
.report-section-scores{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin:0 0 16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
.section-score-box{display:flex;flex-direction:column;align-items:center;min-width:95px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px}
.section-score-box.section-score-final{border-color:#0ea5e9;background:#f0f9ff}
.ssb-label{font-size:6.5pt;color:#64748b;text-transform:uppercase;letter-spacing:.3px;text-align:center;margin-bottom:2px}
.ssb-value{font-size:17pt;font-weight:700;line-height:1}.ssb-sub{font-size:6.5pt;color:#94a3b8;margin-top:2px}
.section-score-divider{font-size:13pt;font-weight:700;color:#94a3b8}
.report-section{margin-bottom:14px;page-break-inside:avoid}
.report-section-title{background:#0ea5e9;color:#fff;padding:8px 13px;border-radius:5px;margin-bottom:5px;font-size:8.5pt;text-transform:uppercase;letter-spacing:.4px;display:flex;justify-content:space-between;align-items:center}
.section-title-score{font-size:8.5pt;font-weight:700;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px;white-space:nowrap}
.report-section h3:not(.report-section-title){background:#f1f5f9;padding:7px 12px;border-left:4px solid #0ea5e9;margin-bottom:5px;font-size:9pt}
.report-item{display:flex;justify-content:space-between;align-items:center;padding:6px 13px;border-bottom:1px solid #e2e8f0;font-size:9pt;page-break-inside:avoid}
.report-item .grade{font-weight:700;min-width:58px;text-align:right;font-size:9pt}
.report-block-diag{font-size:8pt;color:#475569;background:#fffbeb;border-left:3px solid #fbbf24;padding:5px 12px 6px;margin:0 0 3px;word-break:break-word;white-space:pre-wrap;line-height:1.4;page-break-inside:avoid}
.report-executive-summary{padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;font-size:9pt;line-height:1.5;color:#334155;white-space:pre-wrap;word-break:break-word}
.report-footer{margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0;text-align:center;font-size:7pt;color:#94a3b8}
@media print{body{padding:12px 16px}.report-section{page-break-inside:avoid}.report-item{page-break-inside:avoid}.report-block-diag{page-break-inside:avoid}}`;

        return `<!DOCTYPE html>
<html lang="pt-br"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${filename}</title>
<style>${CSS}</style>
</head><body>
${bodyHTML}
<script>window.onload=function(){setTimeout(function(){window.print();},400)};<\/script>
</body></html>`;
    },

    // ── Report HTML Builder ───────────────────────────────────────────────────
    _buildReportHTML: function ({ sec1, sec2, total, color, label, unitName, city, inspector, date, summary }, forPrint = false) {
        const fmt = n => n.toFixed(1);

        const blockRow = (block) => {
            const bs = this._blockScore(block);
            const { color: bc } = this._gradeOf(bs);
            const diag = this.blockDiagnoses[block.id];
            return `
            <div class="report-item">
                <span>${block.name}</span>
                <span class="grade" style="color:${bc};">${fmt(bs)} / 10</span>
            </div>
            ${diag?.trim() ? `<div class="report-block-diag"><strong>Diagnóstico:</strong> ${diag}</div>` : ''}`;
        };

        const sectionBlock = (pillars, title, sectionScore) => `
            <div class="report-section">
                <h3 class="report-section-title">${title}
                    <span class="section-title-score">${fmt(sectionScore)} / 10</span>
                </h3>
                ${pillars.flatMap(p => p.blocks.map(b => blockRow(b))).join('')}
            </div>`;

        const buttons = forPrint ? '' : `
            <div class="no-print" style="margin-bottom:24px;text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="btn-submit" style="display:inline-block;width:auto;margin:0;" onclick="app.exportPDF()">Baixar PDF</button>
                <button class="btn-outline" style="display:inline-block;width:auto;margin:0;" onclick="window.print()">Imprimir</button>
                <button class="btn-outline" style="display:inline-block;width:auto;margin:0;" onclick="location.reload()">Nova Auditoria</button>
            </div>`;

        const decomposition = sec2 !== null ? `
            <div class="report-section-scores">
                <div class="section-score-box">
                    <span class="ssb-label">Seção 1 – Inspeção</span>
                    <span class="ssb-value" style="color:${this._gradeOf(sec1).color};">${fmt(sec1)}</span>
                    <span class="ssb-sub">peso 50%</span>
                </div>
                <div class="section-score-divider">+</div>
                <div class="section-score-box">
                    <span class="ssb-label">Seção 2 – Gestão</span>
                    <span class="ssb-value" style="color:${this._gradeOf(sec2).color};">${fmt(sec2)}</span>
                    <span class="ssb-sub">peso 50%</span>
                </div>
                <div class="section-score-divider">÷ 2 =</div>
                <div class="section-score-box section-score-final">
                    <span class="ssb-label">Nota Final</span>
                    <span class="ssb-value" style="color:${color};">${fmt(total)}</span>
                    <span class="ssb-sub">&nbsp;</span>
                </div>
            </div>` : '';

        return `
        ${buttons}
        <div class="report-header">
            <img src="logo.png" alt="Frutos de Goiás" style="max-width:130px;margin-bottom:12px;">
            <h2>Relatório de Auditoria</h2>
            <p>Trilhas de Alta Performance</p>
        </div>
        <div class="report-meta">
            <p><strong>Unidade:</strong> ${unitName}</p>
            <p><strong>Cidade:</strong> ${city}</p>
            <p><strong>Consultor:</strong> ${inspector}</p>
            <p><strong>Data:</strong> ${date}</p>
        </div>
        <div class="report-score" style="color:${color};">
            ${fmt(total)}
            <div style="font-size:1rem;margin-top:6px;font-weight:600;">${label}</div>
        </div>
        ${decomposition}
        ${this.questions.pillars ? sectionBlock(this.questions.pillars, 'SEÇÃO 1 – INSPEÇÃO DA UNIDADE', sec1) : ''}
        ${(sec2 !== null && this.questions.pillars_section2) ? sectionBlock(this.questions.pillars_section2, 'SEÇÃO 2 – GESTÃO', sec2) : ''}
        ${summary ? `<div class="report-section"><h3>Resumo Executivo</h3><p class="report-executive-summary">${summary}</p></div>` : ''}
        <div class="report-footer">Gerado em ${new Date().toLocaleString('pt-BR')} · Sistema Trilhas de Alta Performance</div>`;
    },

    // ── PDF Export — Fully synchronous (iOS Safari compatible) ───────────────
    // Logo is pre-fetched as base64 at init(), so no await is needed here.
    // window.open() called synchronously from user gesture → iOS popup blocker won't fire.
    exportPDF: function () {
        if (!this._pdf) {
            this.showToast('Finalize a auditoria antes de exportar o PDF.', 'error');
            return;
        }

        const blob = new Blob([this._pdf.fullHTML], { type: 'text/html;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const w    = window.open(url, '_blank');

        if (!w || w.closed) {
            // Fallback: navigate current tab (iOS Share → Print → Salvar em PDF)
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        setTimeout(() => URL.revokeObjectURL(url), 120000);
    }
};

window.onload = () => app.init();
