// wa-reminder.js — Automation Reminder Settings

let _reminders = [];
let _templates  = [];

document.addEventListener('DOMContentLoaded', () => {
  if (typeof App !== 'undefined') App.init();
  loadReminders();
});

async function loadReminders() {
  const el = document.getElementById('reminderGrid');

  const d = await App.api('/wa/reminders');

  if (!d?.success) {
    // Tampilkan error + tombol seed langsung
    if (el) el.innerHTML =
      '<div style="text-align:center;padding:40px 20px;">' +
        '<div style="font-size:22px;margin-bottom:10px;">⚙️</div>' +
        '<div style="font-size:14px;font-weight:700;color:#0d1b3e;margin-bottom:6px;">Belum ada konfigurasi reminder</div>' +
        '<div style="font-size:12.5px;color:#6b7fa8;margin-bottom:18px;">Klik tombol di bawah untuk membuat 5 setting reminder default<br>(H-3, H-1, Hari H, H+1, H+3)</div>' +
        '<button onclick="seedReminders()" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#1a6ef5,#0047cc);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✨ Buat Data Default</button>' +
        (d?.message ? '<div style="font-size:11px;color:#dc2626;margin-top:10px;">Error: ' + d.message + '</div>' : '') +
      '</div>';
    return;
  }

  _reminders = d.data || [];
  _templates  = d.templates || [];
  renderStats();
  renderGrid();
}

function renderStats() {
  const total    = _reminders.length;
  const active   = _reminders.filter(r => r.is_active).length;
  const withTpl  = _reminders.filter(r => r.template_id).length;
  const before   = _reminders.filter(r => r.type === 'before').length;

  _setText('fcTotal',    total);
  _setText('fcTotalSub', active + ' aktif · ' + (total - active) + ' nonaktif');
  _setText('fcWithTpl',  withTpl);
  _setText('fcBefore',   before);
  _setBar('fcTotalBar',    active / Math.max(total, 1));
  _setBar('fcWithTplBar',  withTpl / Math.max(total, 1));
}

function renderGrid() {
  const el = document.getElementById('reminderGrid');
  if (!el) return;
  if (!_reminders.length) {
    el.innerHTML =
      '<div style="text-align:center;padding:40px 20px;">' +
        '<div style="font-size:22px;margin-bottom:10px;">⚙️</div>' +
        '<div style="font-size:14px;font-weight:700;color:#0d1b3e;margin-bottom:6px;">Belum ada konfigurasi reminder</div>' +
        '<div style="font-size:12.5px;color:#6b7fa8;margin-bottom:18px;">Klik tombol di bawah untuk membuat 5 setting reminder default<br>(H-3, H-1, Hari H, H+1, H+3)</div>' +
        '<button onclick="seedReminders()" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#1a6ef5,#0047cc);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✨ Buat Data Default</button>' +
      '</div>';
    return;
  }

  const groups = { before: [], due: [], overdue: [] };
  _reminders.forEach(r => { (groups[r.type] = groups[r.type] || []).push(r); });

  const grpMeta = {
    before:  { label: 'Sebelum Jatuh Tempo', color: '#fb8c00', bg: '#fff8e6' },
    due:     { label: 'Tepat Jatuh Tempo',   color: '#1a6ef5', bg: '#eef3ff' },
    overdue: { label: 'Setelah Jatuh Tempo', color: '#dc2626', bg: '#fff0f2' }
  };

  const tplOptions = '<option value="">— Pilih template —</option>' +
    _templates.map(t => '<option value="' + t.id + '">' + _esc(t.name) + '</option>').join('');

  let html = '';
  ['before','due','overdue'].forEach(gk => {
    const items = groups[gk] || [];
    if (!items.length) return;
    const meta = grpMeta[gk];
    html += '<div style="margin-top:18px;">';
    html += '<div class="grp-header">';
    html += '<div style="width:8px;height:8px;border-radius:50%;background:' + meta.color + ';"></div>';
    html += '<span style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:' + meta.color + '">' + meta.label + '</span>';
    html += '<span style="margin-left:auto;font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;background:' + meta.bg + ';color:' + meta.color + '">' + items.length + ' item</span>';
    html += '</div>';
    // Column headers
    html += '<div class="grp-col-hdr">';
    html += '<div class="pf-label" style="margin:0;">Hari</div><div class="pf-label" style="margin:0;">Template</div>';
    html += '<div class="pf-label rm-time-col" style="margin:0;">Jam Kirim</div><div class="pf-label rm-toggle-col" style="margin:0;">Status</div>';
    html += '</div>';
    items.forEach(r => {
      const dayLabel = gk === 'before' ? 'H-' + Math.abs(r.days_offset) : gk === 'due' ? 'Hari H' : 'H+' + r.days_offset;
      const selOpts = tplOptions.replace('value="' + r.template_id + '"', 'value="' + r.template_id + '" selected');
      const timeVal = (r.send_time || '08:00:00').substring(0, 5);
      html += '<div class="rm-row" data-id="' + r.id + '">';
      html += '<div><span class="day-badge" style="background:' + meta.bg + ';color:' + meta.color + '">' + dayLabel + '</span></div>';
      html += '<div><select class="pf-select rm-tpl" style="font-size:12px;">' + selOpts + '</select></div>';
      html += '<div class="rm-time-col"><input type="time" class="pf-input rm-time" value="' + timeVal + '" style="font-size:12px;"></div>';
      html += '<div class="rm-toggle-col"><label style="display:flex;align-items:center;gap:7px;cursor:pointer;">';
      html += '<input type="checkbox" class="rm-active" ' + (r.is_active ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#1a6ef5;cursor:pointer;">';
      html += '<span style="font-size:12px;font-weight:700;color:' + (r.is_active ? '#00a07a' : '#94a3b8') + '">' + (r.is_active ? 'Aktif' : 'Nonaktif') + '</span>';
      html += '</label></div></div>';
    });
    html += '</div>';
  });
  el.innerHTML = html;

  // Update label warna saat toggle
  el.querySelectorAll('.rm-active').forEach(chk => {
    chk.addEventListener('change', function() {
      const lbl = this.closest('label').querySelector('span');
      if (lbl) { lbl.textContent = this.checked ? 'Aktif' : 'Nonaktif'; lbl.style.color = this.checked ? '#00a07a' : '#94a3b8'; }
    });
  });
}

window.saveReminders = async function() {
  const rows = document.querySelectorAll('.rm-row[data-id]');
  const reminders = Array.from(rows).map(row => ({
    id:          parseInt(row.dataset.id),
    template_id: parseInt(row.querySelector('.rm-tpl')?.value) || null,
    send_time:   (row.querySelector('.rm-time')?.value || '08:00') + ':00',
    is_active:   row.querySelector('.rm-active')?.checked ? 1 : 0
  }));
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  const d = await App.api('/wa/reminders/save', { method: 'POST', body: JSON.stringify({ reminders }) });
  if (d?.success) { App.showToast(d.message, 'success'); loadReminders(); }
  else App.showToast(d?.message || 'Gagal', 'error');
  btn.disabled = false;
  btn.innerHTML = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Simpan Pengaturan';
};

window.runReminderNow = async function() {
  if (!confirm('Jalankan reminder sekarang? Sistem akan mengirim WA ke pelanggan yang sesuai kondisi jatuh tempo.')) return;
  const btn = document.getElementById('btnRunNow');
  btn.disabled = true; btn.textContent = '⏳ Memproses...';
  const d = await App.api('/wa/reminders/run-now', { method: 'POST', body: '{}' });
  const res = document.getElementById('runResult');
  if (d?.success) {
    const txt = d.message + (d.sent !== undefined ? ' (✓ ' + d.sent + ' terkirim' + (d.failed ? ', ✗ ' + d.failed + ' gagal' : '') + ')' : '');
    if (res) res.innerHTML = '<span style="color:#16a34a;font-weight:600;">✅ ' + txt + '</span><div style="font-size:11px;color:#94a3b8;margin-top:3px;">' + new Date().toLocaleString('id-ID') + '</div>';
    App.showToast(d.message, 'success');
  } else {
    if (res) res.innerHTML = '<span style="color:#dc2626;">⚠ ' + (d?.message || 'Gagal') + '</span>';
    App.showToast(d?.message || 'Gagal menjalankan reminder', 'error');
  }
  btn.disabled = false;
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Jalankan Sekarang';
};

// Seed 5 setting reminder default (H-3, H-1, Hari H, H+1, H+3) ke tabel reminder_settings.
// Endpoint backend: POST /api/wa/reminders/seed
window.seedReminders = async function() {
  const btn = event && event.target ? event.target : null;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Membuat...'; }
  try {
    const d = await App.api('/wa/reminders/seed', { method: 'POST', body: '{}' });
    if (d?.success) {
      App.showToast(d.message || '5 reminder default berhasil dibuat', 'success');
      await loadReminders();
    } else {
      App.showToast(d?.message || 'Gagal membuat data default', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '✨ Buat Data Default'; }
    }
  } catch (e) {
    App.showToast('Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '✨ Buat Data Default'; }
  }
};

// ── TEST SEND MODAL ──────────────────────────────────────────────
window.openTestModal = function() {
  // Build dropdown reminder yang punya template
  const sel = document.getElementById('testReminder');
  if (!sel) return;
  const labelMap = { before: 'Sebelum JT', due: 'Tepat JT', overdue: 'Setelah JT' };
  const options = ['<option value="">— Pilih reminder dengan template —</option>'];
  _reminders.forEach(r => {
    if (!r.template_id) return; // skip yang belum ada template
    const tplName = (r.template && r.template.name) || ('Template #' + r.template_id);
    const dayLabel = r.type === 'due' ? 'Hari H'
      : (r.type === 'before' ? 'H-' + Math.abs(r.days_offset) : 'H+' + Math.abs(r.days_offset));
    options.push('<option value="' + r.id + '">' + dayLabel + ' (' + labelMap[r.type] + ') — ' + _esc(tplName) + '</option>');
  });
  sel.innerHTML = options.join('');
  if (options.length === 1) {
    App.showToast('Belum ada reminder dengan template. Pilih template di setiap reminder dulu.', 'error', 5000);
    return;
  }
  document.getElementById('testPhone').value = '';
  document.getElementById('testResult').style.display = 'none';
  document.getElementById('testModal').style.display = 'flex';
  setTimeout(() => document.getElementById('testPhone').focus(), 100);
};

window.closeTestModal = function() {
  document.getElementById('testModal').style.display = 'none';
};

window.submitTestSend = async function() {
  const phone = (document.getElementById('testPhone').value || '').trim();
  const reminderId = document.getElementById('testReminder').value;
  const resultBox = document.getElementById('testResult');
  const btn = document.getElementById('btnTestSubmit');

  if (!phone) { App.showToast('Nomor HP wajib diisi', 'error'); return; }
  if (!reminderId) { App.showToast('Pilih reminder terlebih dulu', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" opacity=".25"/><path d="M22 12a10 10 0 0 1-10 10"/></svg> Mengirim...';
  resultBox.style.display = 'none';

  try {
    const d = await App.api('/wa/reminders/test-send', {
      method: 'POST',
      body: JSON.stringify({ phone, reminder_id: parseInt(reminderId) })
    });
    if (d?.success) {
      resultBox.style.display = 'block';
      resultBox.style.background = '#ecfdf5';
      resultBox.style.border = '1px solid #a7f3d0';
      resultBox.style.color = '#065f46';
      resultBox.innerHTML =
        '<div style="font-weight:700;margin-bottom:4px;">✅ ' + _esc(d.message) + '</div>' +
        '<div style="font-size:11px;opacity:.8;">Template: <b>' + _esc(d.template_used || '-') + '</b></div>' +
        '<div style="font-size:11px;opacity:.8;">Sumber data: ' + _esc(d.data_source || '-') + '</div>' +
        (d.preview ? '<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:11px;font-weight:600;">Lihat preview pesan</summary><pre style="margin:6px 0 0;padding:8px;background:#fff;border-radius:6px;font-size:11px;font-family:\'DM Mono\',monospace;white-space:pre-wrap;line-height:1.5;border:1px solid #d1fae5;">' + _esc(d.preview) + '</pre></details>' : '');
      App.showToast('Test pesan terkirim', 'success');
    } else {
      resultBox.style.display = 'block';
      resultBox.style.background = '#fef2f2';
      resultBox.style.border = '1px solid #fecaca';
      resultBox.style.color = '#991b1b';
      resultBox.innerHTML = '<div style="font-weight:700;">⚠ Gagal: ' + _esc(d?.message || 'Unknown error') + '</div>';
    }
  } catch (e) {
    resultBox.style.display = 'block';
    resultBox.style.background = '#fef2f2';
    resultBox.style.border = '1px solid #fecaca';
    resultBox.style.color = '#991b1b';
    resultBox.innerHTML = '<div style="font-weight:700;">⚠ Error: ' + _esc(e.message) + '</div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg> Kirim Test';
  }
};

function _setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function _setBar(id, ratio) { const el = document.getElementById(id); if (el) el.style.width = Math.min(Math.max((ratio||0)*100, 2), 100) + '%'; }
function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }