// wa-report.js — Automation Report

let _period   = 'this_month';
let _sections = { summary: true, rate: true, method: false, top: false, due: false };
let _phones   = [];
let _schedules= {};

const PERIOD_LABELS = { this_month:'Bulan Ini', last_month:'Bulan Lalu', this_week:'Minggu Ini', last_week:'Minggu Lalu' };
const FREQ_LABELS   = { daily:'Harian', weekly:'Mingguan', monthly:'Bulanan' };
const DAY_LABELS    = ['','Sen','Sel','Rab','Kam','Jum','Sab','Min'];

document.addEventListener('DOMContentLoaded', () => {
  if (typeof App !== 'undefined') App.init();
  loadSettings().then(() => previewReport());
});

async function loadSettings() {
  loadReportTemplate();
  const d = await App.api('/wa/report/settings');
  if (!d?.success) return;
  const cfg = d.data || {};

  // Phones
  _phones = JSON.parse(cfg.admin_notify_phones || '[]');
  renderPhonePills();
  const textarea = document.getElementById('phoneInput');
  if (textarea) textarea.value = _phones.join('\n');

  // Sections
  const savedSec = JSON.parse(cfg.report_sections || '{}');
  if (Object.keys(savedSec).length) _sections = savedSec;
  // Sync checkboxes
  Object.keys(_sections).forEach(k => {
    const lbl = document.getElementById('sec-' + k);
    if (!lbl) return;
    const chk = lbl.querySelector('input');
    if (chk) chk.checked = _sections[k] !== false;
    lbl.classList.toggle('checked', _sections[k] !== false);
  });

  // Period
  _period = cfg.report_range || 'this_month';
  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  // Find active tab by text
  document.querySelectorAll('.period-tab').forEach(btn => {
    if (btn.textContent.trim() === PERIOD_LABELS[_period]) btn.classList.add('active');
  });

  // Schedules
  _schedules = JSON.parse(cfg.report_schedules || '{}');
  renderSchedules();

  // Last sent
  if (cfg.report_last_sent) {
    _setText('lastSentInfo', 'Terakhir dikirim: ' + new Date(cfg.report_last_sent).toLocaleString('id-ID'));
  }
}

function renderPhonePills() {
  const el = document.getElementById('phonePills');
  if (!el) return;
  el.innerHTML = _phones.length
    ? _phones.map(p => '<span class="ph-pill">' + _esc(p) + '</span>').join('')
    : '<span style="font-size:12px;color:#94a3b8;">Belum ada nomor admin</span>';
}

function renderSchedules() {
  const el = document.getElementById('schedGrid');
  if (!el) return;
  const periods = ['this_month','last_month','this_week','last_week'];
  el.innerHTML = periods.map(pk => {
    const s = _schedules[pk] || { enabled: false, freq: 'daily', time: '08:00', day: 1 };
    const isOn = !!s.enabled;
    return '<div class="sched-card ' + (isOn ? 'active' : '') + '" id="scard-' + pk + '">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (isOn ? '10px' : '0') + ';">' +
        '<div>' +
          '<div style="font-size:13px;font-weight:700;color:#0d1b3e;">' + PERIOD_LABELS[pk] + '</div>' +
          '<div style="font-size:11px;color:#94a3b8;">' + (isOn ? 'Otomatis: ' + FREQ_LABELS[s.freq || 'daily'] + ' · ' + s.time : 'Nonaktif') + '</div>' +
        '</div>' +
        '<div class="tog-wrap ' + (isOn ? 'on' : '') + '" onclick="toggleSched(\'' + pk + '\')" id="tog-' + pk + '">' +
          '<div class="tog-thumb"></div>' +
        '</div>' +
      '</div>' +
      (isOn ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        '<div><label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7fa8;display:block;margin-bottom:4px;">Frekuensi</label>' +
        '<select class="pf-select" id="sfreq-' + pk + '" style="font-size:12px;padding:7px 10px;" onchange="updateSchedDisplay(\'' + pk + '\')">' +
          ['daily','weekly','monthly'].map(f => '<option value="' + f + '"' + (s.freq===f?' selected':'') + '>' + FREQ_LABELS[f] + '</option>').join('') +
        '</select></div>' +
        '<div><label style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7fa8;display:block;margin-bottom:4px;">Jam Kirim</label>' +
        '<input type="time" class="pf-input" id="stime-' + pk + '" value="' + (s.time||'08:00') + '" style="font-size:12px;padding:7px 10px;"></div>' +
      '</div>' : '') +
    '</div>';
  }).join('');
}

window.toggleSched = function(pk) {
  if (!_schedules[pk]) _schedules[pk] = { enabled: false, freq: 'daily', time: '08:00', day: 1 };
  _schedules[pk].enabled = !_schedules[pk].enabled;
  renderSchedules();
};

window.updateSchedDisplay = function(pk) {
  // keep data in sync when selects change
  const freq = document.getElementById('sfreq-' + pk)?.value;
  const time = document.getElementById('stime-' + pk)?.value;
  if (!_schedules[pk]) _schedules[pk] = {};
  if (freq) _schedules[pk].freq = freq;
  if (time) _schedules[pk].time = time;
};

window.saveSchedules = async function() {
  // Collect current form values
  ['this_month','last_month','this_week','last_week'].forEach(pk => {
    if (!_schedules[pk]) return;
    const freq = document.getElementById('sfreq-' + pk)?.value;
    const time = document.getElementById('stime-' + pk)?.value;
    if (freq) _schedules[pk].freq = freq;
    if (time) _schedules[pk].time = time;
  });
  const d = await App.api('/wa/report/settings', {
    method: 'POST',
    body: JSON.stringify({ schedules: _schedules, sections: _sections, range: _period })
  });
  if (d?.success) App.showToast('Jadwal disimpan', 'success');
  else App.showToast(d?.message || 'Gagal', 'error');
};

window.savePhones = async function() {
  const raw = document.getElementById('phoneInput')?.value || '';
  const lines = raw.split(/[\n,]+/).map(p => {
    p = p.replace(/[^0-9]/g, '');
    if (!p) return null;
    if (p.startsWith('0')) p = '62' + p.slice(1);
    if (!p.startsWith('62')) p = '62' + p;
    return p.length >= 10 ? p : null;
  }).filter(Boolean);
  _phones = [...new Set(lines)];
  const d = await App.api('/wa/report/settings', { method: 'POST', body: JSON.stringify({ phones: _phones }) });
  if (d?.success) { renderPhonePills(); App.showToast(_phones.length + ' nomor disimpan', 'success'); }
  else App.showToast(d?.message || 'Gagal', 'error');
};

window.setPeriod = function(period, btn) {
  _period = period;
  document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  previewReport();
};

window.toggleSec = function(key, chk) {
  _sections[key] = chk.checked;
  const lbl = document.getElementById('sec-' + key);
  if (lbl) lbl.classList.toggle('checked', chk.checked);
  previewReport();
};

window.previewReport = async function() {
  const btn = document.getElementById('btnPreview');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memuat...'; }
  const params = new URLSearchParams({ range: _period, sections: JSON.stringify(_sections) });
  const d = await App.api('/wa/report/preview?' + params);
  if (d?.success) {
    // Update stat cards
    const data = d.data || {};
    // Fix: aktif & bayar sekarang langsung object (bukan array)
    const aktif = data.aktif || {};
    const bayar = data.bayar || {};
    _setText('scTotal',   'Rp ' + _fmtNum(aktif.total_harga || 0));
    _setText('scTotalSub', (aktif.cnt || 0) + ' pelanggan aktif');
    _setText('scBayar',   'Rp ' + _fmtNum(bayar.total || 0));
    _setText('scBayarSub', (bayar.cnt || 0) + ' pembayaran · ' + (d.label||''));
    _setText('scBelum',   'Rp ' + _fmtNum(data.unpaidTotal || 0));
    _setText('scBelumSub', (data.unpaidCnt || 0) + ' invoice belum bayar');
    _setText('scRate',    (data.rate || 0) + '%');
    _setBar('scBayarBar',  (data.rate || 0));
    _setBar('scBelumBar',  100 - (data.rate || 0));
    _setBar('scRateBar',   data.rate || 0);
    // Preview WA
    _setText('waPreviewText', d.message);
    _setText('waPreviewTime', new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    _setText('previewLabel', d.label);
    _setText('rpHeaderSub', 'Laporan ' + d.label + ' · ' + (bayar.cnt || 0) + ' transaksi');
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> Preview'; }
};

window.sendReportNow = async function() {
  if (!_phones.length) { App.showToast('Tambahkan nomor admin penerima terlebih dahulu', 'error'); return; }
  if (!confirm('Kirim laporan ' + PERIOD_LABELS[_period] + ' ke ' + _phones.length + ' nomor?')) return;
  const btn = document.getElementById('btnSendNow');
  btn.disabled = true; btn.textContent = '⏳ Mengirim...';
  const d = await App.api('/wa/report/send-now', {
    method: 'POST',
    body: JSON.stringify({ range: _period, sections: _sections, phones: _phones })
  });
  if (d?.success) {
    App.showToast(d.message, 'success');
    _setText('lastSentInfo', '✅ ' + d.message + ' · ' + new Date().toLocaleString('id-ID'));
  } else App.showToast(d?.message || 'Gagal kirim laporan', 'error');
  btn.disabled = false;
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Kirim Sekarang';
};

function _setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function _setBar(id, pct) { const el = document.getElementById(id); if (el) el.style.width = Math.min(Math.max(pct||0, 2), 100) + '%'; }
function _fmtNum(n) { n = parseFloat(n)||0; return n >= 1000000 ? (n/1000000).toFixed(1).replace('.0','')+'jt' : n >= 1000 ? Math.round(n/1000)+'rb' : n; }
function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Report Template Editor ────────────────────────────────────
const DEFAULT_REPORT_TEMPLATE = `📊 *{label}*
*{app_name}*
Periode : *{period}*
{sep}

📋 *RINGKASAN TAGIHAN*
Total Pelanggan Aktif : *{aktif_cnt} pelanggan*
Total Tagihan Periode : *{aktif_total}*

💵 *Pembayaran Diterima*
Transaksi  : *{bayar_cnt} pembayaran*
Diterima   : *{bayar_total}*

❌ *Belum Dibayar*
Invoice    : *{unpaid_cnt} invoice*
Estimasi   : *{unpaid_total}*

{sep}
📈 *Collection Rate*
{rate}% tagihan sudah dibayar

{sep}
✅ *Sudah Bayar*
{paid_list}

{sep}
🔴 *Belum Bayar*
{unpaid_list}

{sep}
⏰ *Jatuh Tempo Hari Ini*
{due_today_list}

{sep}
🔔 *Jatuh Tempo 3 Hari ke Depan*
{due_list}

{sep}
_Dikirim otomatis oleh {app_name}_
_{now}_`;

async function loadReportTemplate() {
  const el = document.getElementById('reportTemplate');
  if (!el) return;
  const d = await App.api('/wa/report/template');
  const saved = d?.template || '';
  // Jika template lama tidak punya variabel baru, pakai default
  if (!saved || (!saved.includes('{paid_list}') && !saved.includes('{due_today_list}'))) {
    el.value = DEFAULT_REPORT_TEMPLATE;
  } else {
    el.value = saved;
  }
}

window.saveReportTemplate = async function() {
  const el = document.getElementById('reportTemplate');
  if (!el) return;
  const d = await App.api('/wa/report/template', { method: 'POST', body: JSON.stringify({ template: el.value }) });
  if (d?.success) {
    App.showToast('Template disimpan! Preview diperbarui.', 'success');
    previewReport();
  } else {
    App.showToast(d?.message || 'Gagal menyimpan', 'error');
  }
};

window.resetReportTemplate = function() {
  const el = document.getElementById('reportTemplate');
  if (!el) return;
  if (!confirm('Reset ke template default?')) return;
  el.value = DEFAULT_REPORT_TEMPLATE;
  App.showToast('Template direset. Klik Simpan untuk menyimpan.', 'info');
};

window.insertVar = function(varStr) {
  const el = document.getElementById('reportTemplate');
  if (!el) return;
  const pos = el.selectionStart;
  el.value = el.value.slice(0, pos) + varStr + el.value.slice(el.selectionEnd);
  el.selectionStart = el.selectionEnd = pos + varStr.length;
  el.focus();
};

window.livePreviewTemplate = function() {
  // Debounce preview update when editing template
  clearTimeout(window._tplDebounce);
  window._tplDebounce = setTimeout(() => previewReport(), 800);
};

