const app = {
    questions: null,
    responses: {}, // qId -> value
    topicResponses: {}, // qId -> { index: value }
    metadata: {},
    historyData: [],

    setTopicScore: function (qId, index, value, totalTopics) {
        if (!this.topicResponses[qId]) this.topicResponses[qId] = {};
        this.topicResponses[qId][index] = value;
        
        let conformes = 0;
        for (let k in this.topicResponses[qId]) {
            if (this.topicResponses[qId][k] === 'conforme') conformes++;
        }
        
        let score = (conformes / totalTopics) * 5;
        this.responses[qId] = score;
        
        const scoreSpan = document.getElementById('score-' + qId);
        if (scoreSpan) scoreSpan.innerText = score.toFixed(1);
        
        // Update visual selection
        const lblConforme = document.getElementById(`label-conforme-${qId}-${index}`);
        const lblNConforme = document.getElementById(`label-nconforme-${qId}-${index}`);
        if(lblConforme && lblNConforme) {
            lblConforme.classList.remove('selected');
            lblNConforme.classList.remove('selected');
            if (value === 'conforme') lblConforme.classList.add('selected');
            else lblNConforme.classList.add('selected');
        }

        this.calculateTotal();
    },

    init: async function () {
        try {
            const response = await fetch('questions.json');
            this.questions = await response.json();
            console.log('Questions loaded:', this.questions);

            // Check if questions are empty
            if (!this.questions || (!this.questions.sections.length && !this.questions.pillars.length)) {
                this.showToast('Erro: Banco de questões vazio ou mal formatado.', 'error');
            }
        } catch (err) {
            console.error('Failed to load questions:', err);
            this.showToast('Erro ao carregar perguntas. Verifique o servidor.', 'error');
        }
    },

    showToast: function (msg, type = 'info') {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.style.display = 'block';
        toast.style.background = type === 'error' ? '#ef4444' : '#00ff88';
        setTimeout(() => toast.style.display = 'none', 3000);
    },

    startAudit: function () {
        const unitName = document.getElementById('unit_name').value;
        const city = document.getElementById('city').value;
        const inspector = document.getElementById('inspector_name').value;
        const date = document.getElementById('visit_date').value;

        const licensee = document.getElementById('licensee_name').value;
        if (!unitName || !city || !licensee || !inspector || !date) {
            this.showToast('Por favor, preencha todos os campos de identificação.');
            return;
        }

        this.metadata = { unitName, city, licensee, inspector, date };

        // Populate Responses with Metadata
        this.responses['S0_Q1'] = unitName;
        this.responses['S0_Q2'] = city;
        this.responses['S0_Q3'] = licensee; // Licenciado
        this.responses['S0_Q4'] = inspector;
        this.responses['S0_Q5'] = date;

        document.getElementById('step-0').classList.remove('active');
        document.getElementById('step-0').classList.add('hidden');

        this.renderForm();
    },

    renderForm: function () {
        const container = document.getElementById('audit-form-container');
        container.innerHTML = '';

        // 1. Render Sections (Identification, Visit Type, Pre-visit)
        this.questions.sections.forEach(section => {
            if (section.questions.length === 0) return;

            const sDiv = document.createElement('section');
            sDiv.className = 'card active section-group';
            sDiv.innerHTML = `<h2>${section.name}</h2>`;

            section.questions.forEach(q => {
                const qDiv = document.createElement('div');
                qDiv.className = 'form-group question-row';

                let inputHtml = '';
                if (q.type === 'multiple_choice') {
                    inputHtml = `
                        <div class="options-container" id="opts-${q.id}">
                            ${q.options ? q.options.map(opt => `
                                <div class="choice-chip" onclick="app.setValue('${q.id}', '${opt.replace(/'/g, "\\'")}')">${opt}</div>
                            `).join('') : '<p>Sem opções definidas</p>'}
                        </div>
                    `;
                } else if (q.type === 'paragraph') {
                    inputHtml = `<textarea onchange="app.setValue('${q.id}', this.value)" rows="3" placeholder="Sua resposta..."></textarea>`;
                } else if (q.type === 'date') {
                    inputHtml = `<input type="date" onchange="app.setValue('${q.id}', this.value)">`;
                } else {
                    inputHtml = `<input type="text" onchange="app.setValue('${q.id}', this.value)" placeholder="Resposta curta...">`;
                }

                qDiv.innerHTML = `
                    <label>${q.text}</label>
                    ${inputHtml}
                `;
                sDiv.appendChild(qDiv);
            });
            container.appendChild(sDiv);
        });

        // 2. Render Pillars (Weighted Audit)
        if (this.questions.pillars && this.questions.pillars.length > 0) {
            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.innerText = 'PRIMEIRA SEÇÃO: INSPEÇÃO DA UNIDADE E SEU FUNCIONAMENTO';
            Object.assign(h2.style, { marginTop: '30px', marginBottom: '20px', color: 'var(--primary-color)', textAlign: 'center', fontSize: '1.5rem', fontWeight: '700' });
            container.appendChild(h2);
        }

        this.questions.pillars.forEach(pillar => {
            const pDiv = document.createElement('section');
            pDiv.className = 'pillar-section card active';
            pDiv.innerHTML = ``; // Removido o título do Pilar (Ex: Pilar 1 50%)

            if (pillar.description) {
                const descP = document.createElement('p');
                descP.className = 'section-description';
                descP.innerText = pillar.description;
                Object.assign(descP.style, { marginBottom: '20px', color: '#a1a1aa', fontStyle: 'italic', fontSize: '0.95rem', lineHeight: '1.5' });
                pDiv.appendChild(descP);
            }

            pillar.blocks.forEach(block => {
                const bDiv = document.createElement('div');
                bDiv.className = 'block-card';
                bDiv.innerHTML = `<h3 class="block-title">${block.name} <span class="weight-tag">${block.weight}%</span></h3>`;

                block.questions.forEach(q => {
                    const qRow = document.createElement('div');
                    qRow.className = 'question-row performance-q';
                    
                    if (q.topics && q.topics.length > 0) {
                        let topicsHtml = q.topics.map((topic, index) => `
                            <div class="topic-row custom-topic-row">
                                <div class="topic-title">${topic}</div>
                                <div class="topic-options">
                                    <label class="topic-radio conforme-radio" id="label-conforme-${q.id}-${index}">
                                        <input type="radio" name="topic-${q.id}-${index}" value="conforme" onchange="app.setTopicScore('${q.id}', ${index}, 'conforme', ${q.topics.length})" />
                                        <span>Conforme</span>
                                    </label>
                                    <label class="topic-radio nconforme-radio" id="label-nconforme-${q.id}-${index}">
                                        <input type="radio" name="topic-${q.id}-${index}" value="naoconforme" onchange="app.setTopicScore('${q.id}', ${index}, 'naoconforme', ${q.topics.length})" />
                                        <span>Não Conforme</span>
                                    </label>
                                </div>
                            </div>
                        `).join('');

                        qRow.innerHTML = `
                            <div class="question-text">${q.text}</div>
                            <div class="topics-container" id="opts-${q.id}">
                                ${topicsHtml}
                            </div>
                            <div style="margin-top: 10px; font-weight: bold; color: var(--primary-color);">
                                Nota atual desta questão: <span id="score-${q.id}">0.0</span> / 5.0
                            </div>
                        `;
                    } else {
                        qRow.innerHTML = `
                            <div class="question-text">${q.text}</div>
                            <div class="simple-star-radio" id="opts-${q.id}">
                                ${[1, 2, 3, 4, 5].map(s => `
                                    <label class="radio-label">
                                        <input type="radio" name="rating-${q.id}" value="${s}" onchange="app.setScore('${q.id}', ${s})" />
                                        <span class="stars-text">${'★'.repeat(s)}</span>
                                    </label>
                                `).join('')}
                            </div>
                        `;
                    }
                    bDiv.appendChild(qRow);
                });
                pDiv.appendChild(bDiv);
            });
            container.appendChild(pDiv);
        });

        // 3. Render Section 2 (Gestão)
        if (this.questions.pillars_section2) {
            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.innerText = 'SEGUNDA SEÇÃO: GESTÃO';
            Object.assign(h2.style, { marginTop: '30px', marginBottom: '20px', color: 'var(--primary-color)', textAlign: 'center', fontSize: '1.5rem', fontWeight: '700' });
            container.appendChild(h2);

            this.questions.pillars_section2.forEach(pillar => {
                const pDiv = document.createElement('section');
                pDiv.className = 'pillar-section card active';
                pDiv.innerHTML = ``; // Removido o título do Pilar

                if (pillar.description) {
                    const descP = document.createElement('p');
                    descP.className = 'section-description';
                    descP.innerText = pillar.description;
                    Object.assign(descP.style, { marginBottom: '20px', color: '#a1a1aa', fontStyle: 'italic', fontSize: '0.95rem', lineHeight: '1.5' });
                    pDiv.appendChild(descP);
                }

                pillar.blocks.forEach(block => {
                    const bDiv = document.createElement('div');
                    bDiv.className = 'block-card';
                    bDiv.innerHTML = `<h3 class="block-title">${block.name}</h3>`; // Sem peso visível, divisão igual

                    block.questions.forEach(q => {
                        const qRow = document.createElement('div');
                        qRow.className = 'question-row performance-q';
                        
                        if (q.topics && q.topics.length > 0) {
                            let topicsHtml = q.topics.map((topic, index) => `
                                <div class="topic-row custom-topic-row">
                                    <div class="topic-title">${topic}</div>
                                    <div class="topic-options">
                                        <label class="topic-radio conforme-radio" id="label-conforme-${q.id}-${index}">
                                            <input type="radio" name="topic-${q.id}-${index}" value="conforme" onchange="app.setTopicScore('${q.id}', ${index}, 'conforme', ${q.topics.length})" />
                                            <span>Conforme</span>
                                        </label>
                                        <label class="topic-radio nconforme-radio" id="label-nconforme-${q.id}-${index}">
                                            <input type="radio" name="topic-${q.id}-${index}" value="naoconforme" onchange="app.setTopicScore('${q.id}', ${index}, 'naoconforme', ${q.topics.length})" />
                                            <span>Não Conforme</span>
                                        </label>
                                    </div>
                                </div>
                            `).join('');

                            qRow.innerHTML = `
                                <div class="question-text">${q.text}</div>
                                <div class="topics-container" id="opts-${q.id}">
                                    ${topicsHtml}
                                </div>
                                <div style="margin-top: 10px; font-weight: bold; color: var(--primary-color);">
                                    Nota atual desta questão: <span id="score-${q.id}">0.0</span> / 5.0
                                </div>
                            `;
                        } else {
                            qRow.innerHTML = `
                                <div class="question-text">${q.text}</div>
                                <div class="simple-star-radio" id="opts-${q.id}">
                                    ${[1, 2, 3, 4, 5].map(s => `
                                        <label class="radio-label">
                                            <input type="radio" name="rating-${q.id}" value="${s}" onchange="app.setScore('${q.id}', ${s})" />
                                            <span class="stars-text">${'★'.repeat(s)}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            `;
                        }
                        bDiv.appendChild(qRow);
                    });
                    pDiv.appendChild(bDiv);
                });
                container.appendChild(pDiv);
            });
        }

        document.getElementById('step-final').classList.remove('hidden');
        document.getElementById('step-final').classList.add('active');
        window.scrollTo(0, 0);
    },

    setValue: function (qId, value) {
        this.responses[qId] = value;
        // Visual feedback for chips
        const chips = document.querySelectorAll(`#opts-${qId} .choice-chip`);
        chips.forEach(c => {
            if (c.innerText === value) c.classList.add('active');
            else c.classList.remove('active');
        });
    },

    setScore: function (qId, score) {
        this.responses[qId] = score;
        this.calculateTotal();
    },

    showHelp: function (qId) {
        const helpDiv = document.getElementById(`help-${qId}`);
        helpDiv.classList.toggle('hidden');
    },

    calculateTotal: function () {
        let finalScoreObj = 0;
        let totalPillarWeightsUsed = 0;

        this.questions.pillars.forEach(pillar => {
            let pillarWeightedAvg = 0;
            let totalBlockWeights = 0;

            pillar.blocks.forEach(block => {
                let blockSum = 0;
                let qCount = 0;
                block.questions.forEach(q => {
                    if (this.responses[q.id] !== undefined) {
                        blockSum += parseFloat(this.responses[q.id]);
                        qCount++;
                    }
                });

                if (qCount > 0) {
                    const blockAvgStars = blockSum / qCount;
                    // Proporçao direta: 5 estrelas = 10, 1 estrela = 2.0
                    const blockScore = (blockAvgStars / 5) * 10;
                    pillarWeightedAvg += (blockScore * (block.weight / 100));
                    totalBlockWeights += block.weight;
                }
            });

            // Normalize block weights inside the pillar
            if (totalBlockWeights > 0) {
                const normPillarScore = pillarWeightedAvg / (totalBlockWeights / 100);
                finalScoreObj += (normPillarScore * (pillar.weight / 100));
                totalPillarWeightsUsed += pillar.weight;
            }
        });

        // Global normalization across pillars:
        let finalScore1 = 0;
        if (totalPillarWeightsUsed > 0) {
            finalScore1 = finalScoreObj / (totalPillarWeightsUsed / 100);
        }

        // Section 2 Calculation (Gestão)
        let finalScore2 = 0;
        let isSec2Used = false;
        if (this.questions.pillars_section2) {
            let s2Pillar = this.questions.pillars_section2[0];
            let blocksScoreSum = 0;
            let blocksCount = 0;

            s2Pillar.blocks.forEach(block => {
                let blockSum = 0;
                let qCount = 0;
                block.questions.forEach(q => {
                    if (this.responses[q.id] !== undefined) {
                        blockSum += parseFloat(this.responses[q.id]);
                        qCount++;
                    }
                });

                if (qCount > 0) {
                    const blockAvgStars = blockSum / qCount;
                    const blockScore = (blockAvgStars / 5) * 10;
                    blocksScoreSum += blockScore;
                    blocksCount++;
                }
            });

            if (blocksCount > 0) {
                finalScore2 = blocksScoreSum / blocksCount; // Blocos divididos igualmente
                isSec2Used = true;
            }
        }

        // Combinação das notas (Média simples garantindo peso 50%/50% entre Seção 1 e 2)
        let finalScore = 0;
        if (isSec2Used && totalPillarWeightsUsed > 0) {
            finalScore = (finalScore1 + finalScore2) / 2;
        } else if (isSec2Used) {
            finalScore = finalScore2;
        } else {
            finalScore = finalScore1;
        }

        const scoreEl = document.getElementById('final-score');
        const badge = document.getElementById('total-score-badge');
        scoreEl.innerText = finalScore.toFixed(1);

        // Grade labeling and colors
        if (finalScore < 6) { badge.style.borderColor = '#ef4444'; scoreEl.style.color = '#ef4444'; document.querySelector('.score-badge .label').innerText = '🔴 CRÍTICA'; }
        else if (finalScore < 7) { badge.style.borderColor = '#f97316'; scoreEl.style.color = '#f97316'; document.querySelector('.score-badge .label').innerText = '🟠 ATENÇÃO'; }
        else if (finalScore < 8) { badge.style.borderColor = '#eab308'; scoreEl.style.color = '#eab308'; document.querySelector('.score-badge .label').innerText = '🟡 REGULAR'; }
        else if (finalScore < 9) { badge.style.borderColor = '#22c55e'; scoreEl.style.color = '#22c55e'; document.querySelector('.score-badge .label').innerText = '🟢 BOA'; }
        else { badge.style.borderColor = '#3b82f6'; scoreEl.style.color = '#3b82f6'; document.querySelector('.score-badge .label').innerText = '🔵 ALTA PERFORMANCE'; }

        // Critical alerts checking
        let criticalIssues = [];
        for (const [qId, score] of Object.entries(this.responses)) {
            // Check for conformity issues (P1_B8_I2_Q...)
            if (qId.startsWith('P1_B8_I2') && typeof score === 'number' && score <= 6) {
                const qNameElement = document.querySelector(`#opts-${qId}`)?.parentElement?.querySelector('.question-title');
                const title = qNameElement ? qNameElement.innerText : qId;
                criticalIssues.push(`Desvio Crítico detectado em: ${title} (Nota: ${score})`);
            }
        }

        const alertBox = document.getElementById('critical-alerts');
        if (criticalIssues.length > 0) {
            alertBox.innerHTML = `
                <h3 style="color:#ef4444; margin-bottom:10px;">🚨 AÇÃO IMEDIATA / NOTIFICAÇÃO</h3>
                <ul style="margin-left: 20px; color:#f87171;">
                    ${criticalIssues.map(iss => `<li>${iss}</li>`).join('')}
                </ul>
            `;
            alertBox.classList.remove('hidden');
        } else {
            alertBox.innerHTML = '';
            alertBox.classList.add('hidden');
        }
    },

    submitAudit: function () {
        const total = parseFloat(document.getElementById('final-score').innerText);
        const summary = document.getElementById('final_diagnosis').value || "Sem resumo";
        
        const reportDiv = document.getElementById('printable-report');
        
        let html = `<div class="no-print" style="margin-bottom: 20px; text-align: center;">
            <button class="btn-submit" style="display:inline-block; width:auto; margin:0;" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
            <button class="btn-outline" style="display:inline-block; width:auto; margin:0; margin-left: 10px;" onclick="location.reload()">Nova Auditoria</button>
        </div>`;
        
        html += `<div class="report-header">
            <h2>Relatório de Auditoria - ${this.metadata.unitName}</h2>
            <p>Gerado pelo sistema Trilhas de Alta Performance</p>
        </div>`;
        
        html += `<div class="report-meta">
            <p><strong>Unidade:</strong> ${this.metadata.unitName}</p>
            <p><strong>Cidade:</strong> ${this.metadata.city}</p>
            <p><strong>Consultor:</strong> ${this.metadata.inspector}</p>
            <p><strong>Data:</strong> ${this.metadata.date}</p>
        </div>`;
        
        html += `<div class="report-score">Nota Final: ${total.toFixed(1)}</div>`;
        
        if (this.questions && this.questions.pillars) {
            this.questions.pillars.forEach(pillar => {
                html += `<div class="report-section"><h3>${pillar.name}</h3>`;
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
                    
                    html += `<div class="report-item">
                        <span>${block.name}</span>
                        <span class="grade">${blockScore.toFixed(1)} / 10</span>
                    </div>`;
                });
                html += `</div>`;
            });
        }
        
        if (this.questions && this.questions.pillars_section2) {
            this.questions.pillars_section2.forEach(pillar => {
                html += `<div class="report-section"><h3>${pillar.name}</h3>`;
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
                    
                    html += `<div class="report-item">
                        <span>${block.name}</span>
                        <span class="grade">${blockScore.toFixed(1)} / 10</span>
                    </div>`;
                });
                html += `</div>`;
            });
        }
        
        if (summary) {
            html += `<div class="report-section">
                <h3>Resumo Executivo</h3>
                <p style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">${summary}</p>
            </div>`;
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
