import os
import json
import re

ANALYSIS_DIR = '/Users/admin/full prototype/backend/main/analysis_results'
PLAN_DIR = '/Users/admin/full prototype/backend/main/plan_results'
SOURCE_HTML = '/Users/admin/full prototype/references/pikaanalysis - child memory.html'
OUT_HTML = '/Users/admin/full prototype/references/quality_check.html'

def main():
    # 1. Extract CSS and basic head from source HTML
    with open(SOURCE_HTML, 'r', encoding='utf-8') as f:
        src_content = f.read()
    
    style_match = re.search(r'<style>(.*?)</style>', src_content, re.DOTALL)
    styles = style_match.group(1) if style_match else ""

    # 2. Load the 5 profiles data
    profiles = []
    for fname in os.listdir(ANALYSIS_DIR):
        if not fname.endswith('.json'): continue
        pid = fname.replace('.json', '')
        
        with open(os.path.join(ANALYSIS_DIR, fname), 'r', encoding='utf-8') as f:
            analysis = json.load(f)
            
        plan_path = os.path.join(PLAN_DIR, fname)
        plan = {}
        if os.path.exists(plan_path):
            with open(plan_path, 'r', encoding='utf-8') as f:
                plan = json.load(f)
                
        profiles.append({
            "id": pid,
            "analysis": analysis.get("parsed", {}),
            "plan": plan
        })

    # 3. Build the HTML
    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pika QC - 5 Profiles</title>
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>
{styles}
.profile-selector {{
    padding: 15px 20px;
    background: #FFF;
    border-bottom: 1px solid var(--border-light);
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    gap: 10px;
    align-items: center;
}}
.profile-selector select {{
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-family: inherit;
    font-weight: 600;
    flex: 1;
}}
/* Reuse tabs logic but adjust for selector */
.tabs {{ top: 60px; }}
</style>
</head>
<body>
<div class="app">
    <div class="profile-selector">
        <label style="font-size:12px; font-weight:700; color:var(--text-tertiary)">PROFILE:</label>
        <select id="profile-select" onchange="renderProfile(this.value)">
            {"".join(f'<option value="{p["id"]}">Child {p["id"][:6]}</option>' for p in profiles)}
        </select>
    </div>

    <div class="tabs">
        <button class="tab active" onclick="switchTab('review')">Tuần qua Pika thấy gì?</button>
        <button class="tab" onclick="switchTab('plan')">Tuần tới làm gì?</button>
    </div>

    <div class="page active" id="page-review">
        <div class="page-header">
            <h1 id="review-title">Phân tích Ký ức</h1>
        </div>
        <div class="summary-card" id="persona-summary"></div>
        
        <div class="section-label">
            <div class="section-icon" style="background:var(--accent-blue-bg); color:var(--accent-blue-text)">🧠</div>
            <span>Các chiều ký ức (Clusters)</span>
        </div>
        <div id="memory-clusters"></div>
        
        <div class="section-label" style="margin-top:24px">
            <div class="section-icon" style="background:var(--accent-rose-bg); color:var(--accent-rose-text)">❤️</div>
            <span>Mối quan hệ (Relationships)</span>
        </div>
        <div id="relationships"></div>
    </div>

    <div class="page" id="page-plan">
        <div class="page-header">
            <h1 id="plan-title">Lộ trình Tuần Tới</h1>
        </div>
        <div class="summary-card" id="plan-summary"></div>
        <div id="plan-sessions"></div>
    </div>
</div>

<script>
const data = """ + json.dumps({p["id"]: p for p in profiles}, ensure_ascii=False) + """;

function renderProfile(id) {
    const p = data[id];
    if(!p) return;
    
    // --- REVIEW PAGE ---
    const ana = p.analysis || {};
    const persona = ana.persona || {};
    document.getElementById('review-title').textContent = "Phân tích Ký ức: " + id.substring(0,6);
    document.getElementById('persona-summary').innerHTML = `
        <p><strong>Loại DISC:</strong> ${persona.disc_type || '?'}</p>
        <p><strong>Nổi bật:</strong> ${persona.persona_summary || 'Chưa có thông tin'}</p>
        <p><strong>Sở thích:</strong> ${(persona.engage_preferences || []).join(', ')}</p>
    `;
    
    const clusters = ana.memory_clusters || [];
    document.getElementById('memory-clusters').innerHTML = clusters.map(c => `
        <div class="derived-item">
            <div class="derived-title">${c.name} (Cỡ: ${c.size})</div>
            <div class="derived-evidence">${(c.top_items || []).join('<br>• ')}</div>
        </div>
    `).join('');
    
    const rels = ana.relationship_graph || [];
    document.getElementById('relationships').innerHTML = rels.map(r => `
        <div class="derived-item">
            <div class="derived-title">${r.name} (${r.role})</div>
            <div class="derived-evidence">${r.details} - Nhắc đến ${r.mention_count} lần</div>
        </div>
    `).join('');
    
    // --- PLAN PAGE ---
    const plan = p.plan || {};
    document.getElementById('plan-title').textContent = "Lộ trình Tuần Tới: " + id.substring(0,6);
    const strategy = plan.week_strategy || {};
    document.getElementById('plan-summary').innerHTML = `<p>${strategy.focus || 'Chưa có strategy'}</p>`;
    
    const sessions = plan.sessions || [];
    document.getElementById('plan-sessions').innerHTML = sessions.map(s => `
        <div class="derived-item" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span class="domain-badge badge-atl">Buổi ${s.session} (Ngày ${s.day})</span>
                <span class="domain-badge badge-language">${s.activity_type}</span>
            </div>
            <div class="derived-title" style="font-size:15px">${s.title}</div>
            <p style="font-size:12px; color:var(--text-secondary); margin-top:4px;">Chủ đề: <strong>${s.topic}</strong></p>
            <div class="derived-evidence" style="margin-top:8px;">${s.rationale}</div>
            ${s.target_vocab && s.target_vocab.length > 0 ? `<p style="font-size:11px; margin-top:8px">Từ vựng: <strong>${s.target_vocab.join(', ')}</strong></p>` : ''}
        </div>
    `).join('');
}

function switchTab(tab) {{
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if (tab === 'review') {{
      document.querySelectorAll('.tab')[0].classList.add('active');
      document.getElementById('page-review').classList.add('active');
    }} else {{
      document.querySelectorAll('.tab')[1].classList.add('active');
      document.getElementById('page-plan').classList.add('active');
    }}
}}

// Init
const firstId = document.getElementById('profile-select').value;
if(firstId) renderProfile(firstId);

</script>
</body>
</html>
"""
    with open(OUT_HTML, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"Generated QC HTML at {{OUT_HTML}}")

if __name__ == '__main__':
    main()
