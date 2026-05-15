// FLAYNET.Com broadcast.js — Broadcast Manager

// ── Helpers (harus di atas sebelum dipakai) ───────────────────
function _setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
function _setBar(id, r)  { const e = document.getElementById(id); if (e) e.style.width = Math.min(Math.max((r||0)*100, 2), 100) + '%'; }
function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

let _targetType = 'all';
let _refreshTimer = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof App !== 'undefined') App.init();
  loadStats();
  loadBroadcasts();
  loadTemplates();
  loadPackages();
  updateTargetCount();
  _refreshTimer = setInterval(() => { loadStats(); loadBroadcasts(true); }, 10000);
});

// ── Stats ─────────────────────────────────────────────────────
async function loadStats() {
  const d = await App.api('/broadcast/stats');
  if (!d?.success) return;
  const s = d.data;
  _setText('fcTotal',    s.total || 0);
  _setText('fcDone',     s.completed || 0);
  _setText('fcSent',     (s.total_sent || 0).toLocaleString('id-ID'));
  _setText('fcFailed',   (s.failed || 0) + (s.cancelled || 0));
  _setText('fcRunning',  (s.running || 0) + (s.scheduled || 0));
  _setText('fcRunningSub', (s.running ? s.running + ' running' : '') + (s.scheduled ? (s.running ? ' · ' : '') + s.scheduled + ' scheduled' : '') || 'tidak ada');
  _setBar('fcTotalBar',  (s.completed || 0) / Math.max(s.total || 1, 1));
  _setBar('fcDoneBar',   (s.completed || 0) / Math.max(s.total || 1, 1));
}

// ── Load list ─────────────────────────────────────────────────
async function loadBroadcasts(silent = false) {
  const status = document.getElementById('filterStatus')?.value || '';
  const search = document.getElementById('bcSearch')?.value || '';
  const d = await App.api('/broadcast/list?limit=30&status=' + encodeURIComponent(status));
  const tbody = document.getElementById('bcTable');
  const cards = document.getElementById('bcCards');
  const subEl = document.getElementById('bcListSub');

  if (!d?.success) {
    if (!silent) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6"><div class="tbl-empty"><p style="color:#dc2626;">Gagal memuat data</p></div></td></tr>';
      if (cards) cards.innerHTML = '<div class="tbl-empty"><p style="color:#dc2626;">Gagal memuat data</p></div>';
    }
    return;
  }

  if (subEl) subEl.textContent = (d.total || 0) + ' broadcast';

  const STATUS_LABELS = { draft:'Draft', scheduled:'Scheduled', running:'Running', completed:'Completed', cancelled:'Cancelled', failed:'Failed' };
  const TARGET_LABELS = { all:'Semua', active:'Aktif', overdue:'Overdue', by_package:'Per Paket', custom:'Manual' };

  let rows = d.data || [];
  // Client-side search filter
  if (search.trim()) rows = rows.filter(b => b.title.toLowerCase().includes(search.toLowerCase()));

  if (!rows.length) {
    const empty = '<div class="tbl-empty"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg><p>Belum ada broadcast</p></div>';
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">' + empty + '</td></tr>';
    if (cards) cards.innerHTML = empty;
    return;
  }

  // ── Desktop table rows ──
  if (tbody) {
    tbody.innerHTML = rows.map(bc => {
      const pct = bc.total_targets > 0 ? Math.round(bc.total_sent / bc.total_targets * 100) : 0;
      const sched = bc.scheduled_at ? new Date(bc.scheduled_at).toLocaleString('id-ID', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '–';
      let acts = '';
      if (['draft','scheduled'].includes(bc.status)) {
        acts = '<button class="act-btn act-send" onclick="sendNow(' + bc.id + ')">▶ Kirim</button> <button class="act-btn act-stop" onclick="cancelBc(' + bc.id + ')">Batal</button>';
      } else if (bc.status === 'running') {
        acts = '<button class="act-btn act-stop" onclick="cancelBc(' + bc.id + ')">Stop</button>';
      } else {
        acts = '<button class="act-btn act-del" onclick="deleteBc(' + bc.id + ')">Hapus</button>';
      }
      return '<tr>' +
        '<td><div style="font-size:12.5px;font-weight:600;color:#0d1b3e;">' + _esc(bc.title) + '</div>' +
             '<div style="font-size:10.5px;color:#94a3b8;">' + (TARGET_LABELS[bc.target_type]||bc.target_type) + ' · ' + (bc.created_by_name||'–') + '</div></td>' +
        '<td><div style="font-size:12px;">' + bc.total_sent + '<span style="color:#94a3b8;">/' + bc.total_targets + '</span>' +
             (bc.total_failed > 0 ? ' <span style="color:#dc2626;font-size:10px;">(' + bc.total_failed + ' gagal)</span>' : '') + '</div>' +
             '<div class="prog-bar" style="margin-top:4px;"><div class="prog-fill" style="width:' + pct + '%;"></div></div></td>' +
        '<td style="font-size:12px;color:#6b7fa8;">' + bc.send_interval + 's</td>' +
        '<td style="font-size:11.5px;color:#6b7fa8;">' + sched + '</td>' +
        '<td><span class="st st-' + bc.status + '">' + (STATUS_LABELS[bc.status]||bc.status) + '</span>' +
             (bc.status === 'running' ? '<div style="font-size:10px;color:#2563eb;margin-top:2px;">⟳ running...</div>' : '') + '</td>' +
        '<td><div style="display:flex;gap:4px;">' + acts + '</div></td>' +
      '</tr>';
    }).join('');
  }

  // ── Mobile cards ──
  if (cards) {
    cards.innerHTML = rows.map(bc => {
      const pct = bc.total_targets > 0 ? Math.round(bc.total_sent / bc.total_targets * 100) : 0;
      let acts = '';
      if (['draft','scheduled'].includes(bc.status)) {
        acts = '<button class="act-btn act-send" onclick="sendNow(' + bc.id + ')">▶ Kirim</button> <button class="act-btn act-stop" onclick="cancelBc(' + bc.id + ')">Batal</button>';
      } else if (bc.status === 'running') {
        acts = '<button class="act-btn act-stop" onclick="cancelBc(' + bc.id + ')">Stop</button>';
      } else {
        acts = '<button class="act-btn act-del" onclick="deleteBc(' + bc.id + ')">Hapus</button>';
      }
      return '<div class="bc-item">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:7px;">' +
          '<div><div style="font-size:13px;font-weight:700;color:#0d1b3e;">' + _esc(bc.title) + '</div>' +
          '<div style="font-size:11px;color:#94a3b8;">' + (TARGET_LABELS[bc.target_type]||bc.target_type) + ' · ' + bc.send_interval + 's</div></div>' +
          '<span class="st st-' + bc.status + '">' + (STATUS_LABELS[bc.status]||bc.status) + '</span>' +
        '</div>' +
        '<div style="margin-bottom:7px;">' +
          '<div class="prog-bar"><div class="prog-fill" style="width:' + pct + '%;"></div></div>' +
          '<div style="font-size:11px;color:#6b7fa8;margin-top:3px;">' + bc.total_sent + '/' + bc.total_targets + ' terkirim</div>' +
        '</div>' +
        '<div style="display:flex;gap:5px;">' + acts + '</div>' +
      '</div>';
    }).join('');
  }
}

// ── Templates & Packages ──────────────────────────────────────
async function loadTemplates() {
  const d = await App.api('/wa/templates');
  if (!d?.success) return;
  const sel = document.getElementById('bcTemplate');
  if (!sel) return;
  const CAT_LABELS = { reminder_before:'Reminder Sebelum JT', reminder_due:'Reminder JT', reminder_overdue:'Reminder Overdue', broadcast:'Broadcast', payment_confirm:'Konfirmasi Bayar', custom:'Custom' };
  const tpls = (d.data || []).filter(t => t.is_active);
  sel.innerHTML = '<option value="">— Pilih template (opsional) —</option>' +
    tpls.map(t => '<option value="' + t.id + '" data-content="' + _esc(t.content || t.message || '') + '">[' + (CAT_LABELS[t.category]||t.category) + '] ' + _esc(t.name) + '</option>').join('');
}

async function loadPackages() {
  const d = await App.api('/packages');
  if (!d?.success) return;
  const sel = document.getElementById('bcPackage');
  if (!sel) return;
  sel.innerHTML = '<option value="">Pilih paket</option>' +
    (d.data || []).map(p => '<option value="' + p.id + '">' + _esc(p.name) + ' — Rp ' + Number(p.price || 0).toLocaleString('id-ID') + '</option>').join('');
}

// ── Target type ───────────────────────────────────────────────
window.setTarget = function(type, btn) {
  _targetType = type;
  document.querySelectorAll('.ttab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('bcTargetType').value = type;
  document.getElementById('pkgPanel').style.display    = type === 'by_package' ? 'block' : 'none';
  document.getElementById('manualPanel').style.display = type === 'custom'     ? 'block' : 'none';
  updateTargetCount();
};

window.updateTargetCount = async function() {
  const type  = _targetType;
  const pkgId = document.getElementById('bcPackage')?.value || '';
  let url = '/broadcast/count-targets?target_type=' + type;
  if (type === 'by_package' && pkgId) url += '&package_id=' + pkgId;
  const d = await App.api(url);
  const wrap = document.getElementById('targetCountWrap');
  const num  = document.getElementById('targetCountNum');
  const badge= document.getElementById('targetCountBadge');
  if (wrap) wrap.style.display = 'block';
  if (num)  num.textContent = d?.count || 0;
  if (badge) badge.style.color = (d?.count || 0) > 0 ? '#1a6ef5' : '#dc2626';
};

window.countManual = function() {
  const val  = document.getElementById('bcManual')?.value || '';
  const nums = val.split(/[\n,;]+/).filter(p => p.trim().replace(/[^0-9]/g,'').length >= 9);
  _setText('manualCount', nums.length + ' nomor valid');
};

window.onTplChange = function(tplId) {
  if (!tplId) return;
  const opt = document.querySelector('#bcTemplate option[value="' + tplId + '"]');
  const content = opt?.dataset?.content || '';
  if (content) {
    document.getElementById('bcMessage').value = content;
    window.updateMsgCount();
  }
};

window.updateMsgCount = function() {
  _setText('msgCount', (document.getElementById('bcMessage')?.value?.length || 0) + ' karakter');
};

// ── Create broadcast ──────────────────────────────────────────
window.createBroadcast = async function(mode) {
  const title    = document.getElementById('bcTitle')?.value?.trim();
  const message  = document.getElementById('bcMessage')?.value?.trim();
  const tplId    = document.getElementById('bcTemplate')?.value || '';
  const interval = parseInt(document.getElementById('bcInterval')?.value) || 10;
  const scheduled= document.getElementById('bcScheduled')?.value || '';

  if (!title)   { App.showToast('Judul wajib diisi', 'error'); return; }
  if (!message) { App.showToast('Pesan wajib diisi', 'error'); return; }
  if (interval < 8) { App.showToast('Interval minimal 8 detik (anti-block)', 'error'); return; }
  if (mode === 'schedule' && !scheduled) { App.showToast('Pilih tanggal/jam untuk dijadwalkan', 'error'); return; }

  const body = {
    title, message,
    template_id:   tplId || null,
    target_type:   _targetType,
    send_interval: interval,
    scheduled_at:  (mode === 'schedule' && scheduled) ? scheduled.replace('T', ' ') : null
  };
  if (_targetType === 'by_package') {
    const pkgId = document.getElementById('bcPackage')?.value;
    if (pkgId) body.target_filter = { package_id: parseInt(pkgId) };
  }
  if (_targetType === 'custom') {
    body.manual_numbers = document.getElementById('bcManual')?.value || '';
  }

  const btnId = mode === 'now' ? 'btnSendNow' : 'btnSchedule';
  const btn   = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

  const d = await App.api('/broadcast', { method: 'POST', body: JSON.stringify(body) });

  if (d?.success) {
    if (mode === 'now') {
      const d2 = await App.api('/broadcast/' + d.data.id + '/send-now', { method: 'POST', body: '{}' });
      App.showToast(d2?.message || 'Broadcast mulai dikirim!', 'success');
    } else {
      App.showToast('Broadcast dijadwalkan untuk ' + scheduled, 'success');
    }
    resetForm();
    loadStats();
    loadBroadcasts();
  } else {
    App.showToast(d?.message || 'Gagal membuat broadcast', 'error');
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = mode === 'now'
      ? '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg> Kirim Sekarang'
      : '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Jadwalkan';
  }
};

function resetForm() {
  document.getElementById('bcTitle').value   = '';
  document.getElementById('bcMessage').value = '';
  document.getElementById('bcTemplate').selectedIndex = 0;
  document.getElementById('bcManual').value  = '';
  document.getElementById('bcScheduled').value = '';
  document.getElementById('bcInterval').value  = '10';
  _targetType = 'all';
  document.querySelectorAll('.ttab').forEach((b,i) => b.classList.toggle('active', i===0));
  document.getElementById('pkgPanel').style.display   = 'none';
  document.getElementById('manualPanel').style.display = 'none';
  _setText('msgCount', '0 karakter');
  _setText('manualCount', '0 nomor valid');
  updateTargetCount();
}

// ── Row actions ───────────────────────────────────────────────
window.sendNow = async function(id) {
  if (!confirm('Kirim broadcast ini sekarang?')) return;
  const d = await App.api('/broadcast/' + id + '/send-now', { method: 'POST', body: '{}' });
  App.showToast(d?.message || (d?.success ? 'Berhasil' : 'Gagal'), d?.success ? 'success' : 'error');
  if (d?.success) { loadBroadcasts(); loadStats(); }
};

window.cancelBc = async function(id) {
  if (!confirm('Batalkan / hentikan broadcast ini?')) return;
  const d = await App.api('/broadcast/' + id + '/cancel', { method: 'POST', body: '{}' });
  App.showToast(d?.message || (d?.success ? 'Dibatalkan' : 'Gagal'), d?.success ? 'success' : 'error');
  if (d?.success) { loadBroadcasts(); loadStats(); }
};

window.deleteBc = async function(id) {
  if (!confirm('Hapus broadcast ini?')) return;
  const d = await App.api('/broadcast/' + id, { method: 'DELETE' });
  App.showToast(d?.message || (d?.success ? 'Dihapus' : 'Gagal'), d?.success ? 'success' : 'error');
  if (d?.success) { loadBroadcasts(); loadStats(); }
};

// ── Search (debounced) ────────────────────────────────────────
window.onSearch = _debounce(() => loadBroadcasts(), 350);

// expose for filter dropdown
window.loadBroadcasts = loadBroadcasts;