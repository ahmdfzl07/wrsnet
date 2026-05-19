// customers.js — Customer Management (redesign)

let _custPage   = 1;
let _custEditId = null;
let _nextAutoId = '';
// Flag: true kalau user sudah mengetik manual di field PPPoE Username,
// supaya auto-generate dari nama TIDAK menimpa input manual.
// Direset ke false setiap kali openAddCustomer() / _clearForm() dipanggil.
let _pppoeManuallyEdited = false;
// Saat editCustomer() load data, simpan pppoe_username asli di sini.
// Dipakai oleh saveCustomer() untuk deteksi apakah user mengubah username
// → kalau berubah, tampilkan modal konfirmasi sync ke router.
// Direset ke '' setiap kali openAddCustomer() (tidak relevan di tambah baru).
let _originalPppoeUsername = '';
const AVATAR_BG = ['#2563eb','#0891b2','#059669','#d97706','#dc2626','#0284c7','#16a34a','#ea580c','#0369a1','#0d9488'];

// ── PPPoE Username slugify ────────────────────────────────────
// Bersihkan NAMA CUSTOMER jadi username PPPoE untuk AUTO-GENERATE.
// Hasil-nya bersih dan predictable — hanya huruf+angka:
//   - normalisasi diakritik (é → e, ñ → n, dll)
//   - lowercase
//   - hanya huruf a-z dan angka 0-9 (semua karakter lain di-drop, termasuk spasi)
//   - max 32 char (cukup lega untuk MikroTik secret)
//
// CATATAN: function ini HANYA dipakai untuk auto-generate dari Nama.
// Untuk input MANUAL user di field PPPoE (boleh pakai @, ., -, _),
// JANGAN sanitize via slugify — biarkan user ketik bebas. Format
// realm-style seperti "avinda@net.id" valid dan didukung MikroTik.
//
// Contoh: "Budi Santoso"      → "budisantoso"
//         "Ahmad Yáñez 2"     → "ahmadyanez2"
//         "PT. Maju Jaya"     → "ptmajujaya"
function _slugifyForPppoe(name) {
  if (!name) return '';
  let s = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return s.slice(0, 32);
}

// ── PPPoE Username slot mover ─────────────────────────────────
// Field #custPPPoE punya dua "rumah" di EJS:
//   - #custPPPoEAddSlot: di dalam pppoeFormBox (default position, untuk mode tambah baru)
//   - #custPPPoEEditSlot: di grid atas (untuk mode edit, supaya tetap terlihat saat pppoeCreateBox hidden)
//
// Ada SATU element <input id="custPPPoE">. Helper di bawah ini memindahkan
// element itu antar dua slot sesuai mode. Karena cuma satu element, tidak
// perlu sync value antara dua field.
function _movePppoeToEditSlot() {
  const input = document.getElementById('custPPPoE');
  const editSlot = document.getElementById('custPPPoEEditSlot');
  const addSlot = document.getElementById('custPPPoEAddSlot');
  if (!input || !editSlot) return;
  // Tampilkan edit slot, append element input ke sana (kalau belum)
  editSlot.style.display = '';
  if (input.parentElement !== editSlot) {
    editSlot.appendChild(input);
  }
  if (addSlot) addSlot.style.display = 'none';
}

function _movePppoeToAddSlot() {
  const input = document.getElementById('custPPPoE');
  const editSlot = document.getElementById('custPPPoEEditSlot');
  const addSlot = document.getElementById('custPPPoEAddSlot');
  if (!input || !addSlot) return;
  // Kembalikan element input ke posisi default-nya di pppoeFormBox
  addSlot.style.display = '';
  if (input.parentElement !== addSlot) {
    addSlot.appendChild(input);
  }
  if (editSlot) editSlot.style.display = 'none';
}

// ── EXPOSE ────────────────────────────────────────────────────
window.openAddCustomer = async function () {
  _custEditId = null;
  _pppoeManuallyEdited = false; // reset flag → auto-fill PPPoE dari nama aktif
  _originalPppoeUsername = '';   // tidak relevan di tambah baru
  _setText('customerModalTitle', 'Tambah Customer');
  // Pindahkan field PPPoE ke posisi mode Tambah (di dalam pppoeFormBox)
  _movePppoeToAddSlot();
  _clearForm();
  // Set default aktivasi = hari ini
  const today = new Date().toISOString().slice(0, 10);
  _setVal('custInstallDate', today);
  _setVal('custStatus', 'active');
  // Show checkbox WA welcome (default ON)
  const waBox = document.getElementById('waWelcomeBox');
  if (waBox) waBox.style.display = '';
  const waChk = document.getElementById('custSendWaWelcome');
  if (waChk) waChk.checked = true;
  // Show panel PPPoE create (hanya untuk tambah baru, default OFF)
  const ppBox = document.getElementById('pppoeCreateBox');
  if (ppBox) ppBox.style.display = '';
  document.getElementById('customerModal').classList.add('active');
  await loadPackages();
  const idField = document.getElementById('custId');
  if (idField) { idField.readOnly = false; idField.placeholder = 'Kosongkan untuk otomatis...'; }
  const d = await App.api('/customers/next-id');
  if (d?.success) {
    _nextAutoId = d.customer_id;
    const el = document.getElementById('custId');
    if (el) el.placeholder = 'Kosongkan → otomatis: ' + d.customer_id;
    setIdStatus('hint', d.customer_id);
  }
};

window.closeModal = function () {
  document.getElementById('customerModal').classList.remove('active');
  // Reset panel portal supaya tidak bocor antar edit
  const ppBox = document.getElementById('portalPanelBox');
  if (ppBox) ppBox.style.display = 'none';
  const cidInput = document.getElementById('ppCid');
  if (cidInput) { cidInput.value=''; cidInput.readOnly=true; cidInput.style.background='#eef2f7'; cidInput.style.cursor='not-allowed'; }
  const cidBtn = document.getElementById('ppCidToggle');
  if (cidBtn) { cidBtn.textContent='Ubah'; cidBtn.style.color='#1a6ef5'; cidBtn.style.borderColor='#e4ecf7'; }
  const pwInput = document.getElementById('ppPw');
  if (pwInput) { pwInput.value=''; pwInput.type='password'; }
};

window.editCustomer = async function (id) {
  const data = await App.api('/customers/' + id);
  if (!data?.success) { App.showToast('Gagal memuat data', 'error'); return; }
  const c = data.data;
  _custEditId = c.id;
  // Di mode edit: anggap PPPoE username sudah "manual" supaya auto-generate
  // dari nama TIDAK menimpa username yang sudah ada di customer ini.
  _pppoeManuallyEdited = true;
  _setText('customerModalTitle', 'Edit Customer');
  // Hide checkbox WA welcome di mode edit (hanya relevan untuk customer baru)
  const waBox = document.getElementById('waWelcomeBox');
  if (waBox) waBox.style.display = 'none';
  // Hide panel PPPoE create di mode edit (PPPoE secret existing dikelola via halaman PPPoE Manager)
  const ppBox = document.getElementById('pppoeCreateBox');
  if (ppBox) ppBox.style.display = 'none';
  const cbPppoe = document.getElementById('custCreatePppoe');
  if (cbPppoe) cbPppoe.checked = false;
  const ppForm = document.getElementById('pppoeFormBox');
  if (ppForm) ppForm.style.display = 'none';
  // Pindahkan field PPPoE Username ke slot atas (di grid utama) supaya tetap
  // bisa di-edit user — karena pppoeCreateBox tertutup di mode edit.
  _movePppoeToEditSlot();

  _setVal('custName',        c.name            || '');
  _setVal('custPhone',       c.phone           || '');
  _setVal('custEmail',       c.email           || '');
  _setVal('custAddress',     c.address         || '');
  _setVal('custPackage',     c.package_id      || '');
  _setVal('custDueDate',     c.due_date        || '');
  _setVal('custInstallDate', c.installation_date || '');
  _setVal('custPPPoE',       c.pppoe_username  || '');
  // Simpan value asli untuk deteksi perubahan di saveCustomer()
  _originalPppoeUsername = String(c.pppoe_username || '').trim();
  _setVal('custOntSn',       c.ont_sn          || '');
  _setVal('custStaticIP',    c.static_ip        || '');
  // Set mikrotik dropdown
  const mkSel = document.getElementById('custMikrotikId');
  if (mkSel) mkSel.value = c.mikrotik_id || '';
  _setVal('custStatus',      c.status          || 'active');
  _setVal('custId',          c.customer_id     || '');
  setIdStatus('existing', c.customer_id);
  const idField = document.getElementById('custId');
  if (idField) idField.readOnly = true;
  await loadPackages();
  _setVal('custPackage', c.package_id || '');

  // Tampilkan panel akses portal & load creds (hanya di mode edit)
  const portalBox = document.getElementById('portalPanelBox');
  if (portalBox) portalBox.style.display = 'block';
  ppLoadCredentials(c.id);

  document.getElementById('customerModal').classList.add('active');
};

window.toggleIsolate = async function (id, action) {
  const label = action === 'isolate' ? 'Isolir' : 'Aktifkan';
  if (!confirm(label + ' customer ini?')) return;
  const data = await App.api('/customers/' + id, { method:'PUT', body:JSON.stringify({ status: action === 'isolate' ? 'isolated' : 'active' }) });
  if (data?.success) { loadCustomers(); loadCustomerStats(); App.showToast('Customer ' + label.toLowerCase() + 'd', 'success'); }
  else App.showToast(data?.message || 'Gagal', 'error');
};

// ─────────────────────────────────────────────────────────────────────
// Modal konfirmasi hapus customer dengan opsi sync ke router MikroTik.
//
// Dipanggil oleh deleteCustomer(). Return Promise<'sync' | 'db_only' | 'cancel'>:
//   - 'sync'    : hapus customer di FLAYNET + hapus secret PPPoE di router
//   - 'db_only' : hapus customer di FLAYNET saja (secret router tidak disentuh)
//   - 'cancel'  : batalkan, tidak menghapus apa-apa
//
// Param `customer` adalah object minimal { id, name, pppoe_username, mikrotik_id, mikrotik_name }.
// Kalau customer tidak punya pppoe_username + mikrotik_id, tombol "sync" di-disable.
// ─────────────────────────────────────────────────────────────────────
function _confirmCustomerDelete(customer) {
  return new Promise((resolve) => {
    const hasPppoe = !!(customer.pppoe_username && String(customer.pppoe_username).trim());
    const hasRouter = !!customer.mikrotik_id;
    const canSync = hasPppoe && hasRouter;

    // Build reason kalau tidak bisa sync
    let syncDisabledReason = '';
    if (!hasPppoe && !hasRouter) syncDisabledReason = 'Customer tidak punya PPPoE username & router';
    else if (!hasPppoe)          syncDisabledReason = 'Customer tidak punya PPPoE username';
    else if (!hasRouter)         syncDisabledReason = 'Customer tidak punya router MikroTik terhubung';

    const overlay = document.createElement('div');
    overlay.id = '__custDeleteModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:14px;max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;';
    box.innerHTML = `
      <div style="padding:18px 22px 14px;border-bottom:1px solid #f1f5f9;">
        <div style="display:flex;align-items:center;gap:10px;">
          <svg width="22" height="22" fill="none" stroke="#dc2626" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          <div style="font-size:15px;font-weight:700;color:#0f172a;">Hapus Customer</div>
        </div>
      </div>
      <div style="padding:18px 22px;font-size:13px;color:#334155;line-height:1.6;">
        <div style="margin-bottom:10px;">Anda akan menghapus customer:</div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:14px;">
          <div style="font-weight:600;color:#0f172a;font-size:13.5px;">${_esc(customer.name)}</div>
          ${hasPppoe ? `<div style="font-size:12px;color:#64748b;font-family:'DM Mono',monospace;margin-top:3px;">PPPoE: ${_esc(customer.pppoe_username)}</div>` : ''}
          ${hasRouter ? `<div style="font-size:11.5px;color:#64748b;margin-top:2px;">Router: ${customer.mikrotik_name ? _esc(customer.mikrotik_name) : `<span style="color:#94a3b8;">ID #${_esc(customer.mikrotik_id)}</span>`}</div>` : ''}
        </div>
        ${canSync ? `
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e;line-height:1.5;margin-bottom:6px;">
            <strong>Apa yang ingin Anda lakukan?</strong><br>
            Tanpa hapus secret di router, customer mungkin masih bisa login PPPoE meski sudah dihapus di FLAYNET.
          </div>` : `
          <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;font-size:12px;color:#475569;line-height:1.5;margin-bottom:6px;">
            ${syncDisabledReason}, jadi tidak ada secret di router yang perlu dihapus.
          </div>`}
      </div>
      <div style="padding:14px 22px;background:#fafbfc;border-top:1px solid #f1f5f9;display:flex;flex-direction:column;gap:8px;">
        <button id="__custDelSync" ${canSync ? '' : 'disabled'}
          style="background:${canSync ? '#dc2626' : '#cbd5e1'};color:#fff;border:none;border-radius:8px;padding:11px 14px;font-size:13px;font-weight:600;cursor:${canSync ? 'pointer' : 'not-allowed'};text-align:left;line-height:1.4;opacity:${canSync ? 1 : 0.6};">
          <div>✗ Hapus customer &amp; secret di router MikroTik</div>
          <div style="font-size:11px;font-weight:400;opacity:.9;margin-top:2px;">${canSync ? 'Sync penuh. Customer langsung disconnect, tidak bisa login lagi.' : syncDisabledReason}</div>
        </button>
        <button id="__custDelDbOnly" style="background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:8px;padding:11px 14px;font-size:13px;font-weight:600;cursor:pointer;text-align:left;line-height:1.4;">
          <div>Hapus dari database saja (tanpa sentuh router)</div>
          <div style="font-size:11px;font-weight:400;color:#64748b;margin-top:2px;">${hasPppoe ? 'Pilih ini kalau Anda sudah hapus secret manual via Winbox.' : 'Hanya hapus record di database FLAYNET.'}</div>
        </button>
        <button id="__custDelCancel" style="background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:8px;padding:9px 14px;font-size:12.5px;font-weight:500;cursor:pointer;margin-top:2px;">
          Batal
        </button>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const cleanup = () => { try { document.body.removeChild(overlay); } catch (e) {} };
    const syncBtn = document.getElementById('__custDelSync');
    if (canSync) syncBtn.onclick = () => { cleanup(); resolve('sync'); };
    document.getElementById('__custDelDbOnly').onclick = () => { cleanup(); resolve('db_only'); };
    document.getElementById('__custDelCancel').onclick = () => { cleanup(); resolve('cancel'); };
    const escHandler = (e) => {
      if (e.key === 'Escape') { cleanup(); document.removeEventListener('keydown', escHandler); resolve('cancel'); }
    };
    document.addEventListener('keydown', escHandler);
  });
}

window.deleteCustomer = async function (id, name) {
  // Fetch detail customer dulu untuk dapat pppoe_username + mikrotik_id
  // (info ini dipakai modal untuk putuskan apakah opsi sync available)
  let detail = { id, name, pppoe_username: null, mikrotik_id: null, mikrotik_name: null };
  try {
    const res = await App.api('/customers/' + id);
    if (res?.success && res.data) {
      const c = res.data;
      detail = {
        id,
        name: c.name || name,
        pppoe_username: c.pppoe_username || null,
        mikrotik_id: c.mikrotik_id || null,
        // Coba ambil nama dari embedded mikrotik object (kalau backend show() versi
        // terbaru di-deploy). Fallback: null → akan di-fetch via /devices/:id di bawah.
        mikrotik_name: c.mikrotik?.name || c.mikrotik?.host || null,
      };

      // FALLBACK: kalau customer punya mikrotik_id tapi nama router tidak ada
      // di response (backend versi lama, atau Device sudah dihapus), coba fetch
      // langsung via endpoint /devices/:id. Ini bikin display tetap ramah user
      // meski deployment belum sinkron.
      if (detail.mikrotik_id && !detail.mikrotik_name) {
        try {
          const dres = await App.api('/devices/' + detail.mikrotik_id);
          if (dres?.success && dres.data) {
            detail.mikrotik_name = dres.data.name || dres.data.host || null;
          }
        } catch (e2) {
          console.warn('[deleteCustomer] Gagal fetch device detail:', e2.message);
        }
      }
    }
  } catch (e) {
    console.warn('[deleteCustomer] Gagal fetch detail:', e.message, '— lanjut dengan info minimal');
  }

  // Tampilkan modal konfirmasi
  const choice = await _confirmCustomerDelete(detail);
  if (choice === 'cancel') return;

  // Panggil DELETE endpoint dengan flag sesuai pilihan
  const url = '/customers/' + id;
  const data = await App.api(url, {
    method: 'DELETE',
    body: JSON.stringify({ delete_router_secret: (choice === 'sync') })
  });

  if (data && data.success) {
    loadCustomers();
    loadCustomerStats();
    // Toast informatif tergantung status router
    let toastMsg = 'Customer dihapus';
    let toastType = 'success';
    if (choice === 'sync') {
      if (data.router_status === 'deleted')   toastMsg = `Customer & secret di router dihapus (${detail.pppoe_username})`;
      else if (data.router_status === 'not_found') {
        toastMsg = `Customer dihapus. Secret di router sudah tidak ada (mungkin sudah dihapus manual sebelumnya).`;
        toastType = 'info';
      }
    } else {
      toastMsg = 'Customer dihapus dari database (router tidak disentuh)';
      toastType = 'info';
    }
    App.showToast(toastMsg, toastType);
  } else {
    App.showToast((data && data.message) || 'Gagal menghapus', 'error');
  }
};

window.syncDueDates = async function() {
  // Konfirmasi generate invoice bulan ini
  const now   = new Date();
  const bulan = now.toLocaleString('id-ID', { month: 'long' });
  const tahun = now.getFullYear();

  showConfirmModal(
    'Generate Invoice Bulanan',
    'Generate invoice untuk semua pelanggan aktif periode <strong>' + bulan + ' ' + tahun + '</strong>?<br><small style="color:#64748b">Invoice yang sudah ada akan dilewati (skip).</small>',
    'calendar',
    '#1a6ef5',
    async function() {
      const btn = document.getElementById('btnSyncDue');
      if (btn) { btn.disabled = true; btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="animation:spin .7s linear infinite"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Memproses...'; }
      const res = await App.api('/billing/generate', { method: 'POST', body: JSON.stringify({ month: now.getMonth()+1, year: tahun }) });
      // Sinkronisasi due_date invoice dari customer.due_date
      await App.api('/billing/sync-due-dates', { method: 'POST' }).catch(function(){});
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg><span>Auto Due Date</span>'; }
      if (res && res.success) {
        var d = res.data || {};
        App.showToast('✓ Invoice dibuat: ' + (d.created||0) + ', dilewati: ' + (d.skipped||0) + ' · Due date tersinkron', 'success');
        loadCustomers(); loadCustomerStats();
      } else {
        App.showToast('Gagal: ' + ((res && res.message) || 'Error'), 'error');
      }
    }
  );
};

/* ── Confirm Modal ──────────────────────────────────────────── */
function showConfirmModal(title, body, iconType, accentColor, onConfirm) {
  // Remove existing
  var existing = document.getElementById('_confirmModal');
  if (existing) existing.remove();

  var iconSvg = iconType === 'trash'
    ? '<svg width="22" height="22" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg>'
    : '<svg width="22" height="22" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  var btnLabel  = iconType === 'trash' ? 'Hapus' : 'Generate';
  var btnColor  = accentColor || '#ef4444';

  var el = document.createElement('div');
  el.id  = '_confirmModal';
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(13,27,62,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .15s ease';

  el.innerHTML = '<div style="background:#fff;border-radius:20px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 24px 80px rgba(13,27,62,.25);animation:slideUp .2s ease">'
    + '<div style="background:'+btnColor+';padding:20px 22px 16px;display:flex;align-items:center;gap:12px;">'
      + '<div style="width:42px;height:42px;background:rgba(255,255,255,.2);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+iconSvg+'</div>'
      + '<div style="font-size:15px;font-weight:800;color:#fff">'+title+'</div>'
    + '</div>'
    + '<div style="padding:20px 22px;font-size:13.5px;color:#374151;line-height:1.6">'+body+'</div>'
    + '<div style="display:flex;gap:10px;padding:0 22px 20px;justify-content:flex-end">'
      + '<button id="_confirmCancel" style="padding:9px 20px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;color:#64748b;font-weight:700;cursor:pointer;font-size:13px;font-family:inherit">Batal</button>'
      + '<button id="_confirmOk" style="padding:9px 20px;border:none;border-radius:10px;background:'+btnColor+';color:#fff;font-weight:700;cursor:pointer;font-size:13px;font-family:inherit;box-shadow:0 3px 10px '+btnColor+'44">'+btnLabel+'</button>'
    + '</div>'
  + '</div>';

  // CSS animations
  if (!document.getElementById('_confirmStyles')) {
    var s = document.createElement('style');
    s.id  = '_confirmStyles';
    s.textContent = '@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }

  document.body.appendChild(el);

  document.getElementById('_confirmCancel').onclick = function() { el.remove(); };
  document.getElementById('_confirmOk').onclick = function() {
    el.remove();
    onConfirm();
  };
  el.addEventListener('click', function(e){ if(e.target===el) el.remove(); });
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadMikrotikDevices();
  if (typeof App !== 'undefined') App.init();
  loadCustomerStats();
  loadCustomers();
  setupSearch();
});

window.applyFilter = function(status) {
  const sel = document.getElementById('filterStatus');
  if (sel) sel.value = status;
  _custPage = 1;
  loadCustomers();
};

function setupSearch() {
  const s  = document.getElementById('searchCustomer');
  const f  = document.getElementById('filterStatus');
  const fd = document.getElementById('filterDue');
  if (s)  s.addEventListener('input', _debounce(() => { _custPage = 1; loadCustomers(); }, 350));
  if (f)  f.addEventListener('change', () => { _custPage = 1; loadCustomers(); });
  if (fd) fd.addEventListener('change', () => { _custPage = 1; loadCustomers(); });
}

// ── STATS ─────────────────────────────────────────────────────
async function loadCustomerStats() {
  const d = await App.api('/customers/stats');
  if (!d?.success) return;
  const s        = d.data;
  const total    = s.total    || 0;
  const active   = s.active   || 0;
  const overdue  = s.overdue  || 0;
  const dueSoon  = s.due_soon || 0;
  const inactive = (s.inactive || 0) + (s.suspended || 0);
  const isolated = s.isolated || 0;

  _setText('scTotal',      total);
  _setText('scTotalSub',   active + ' aktif · ' + inactive + ' nonaktif');
  _setBar ('scTotalBar',   total > 0 ? 0.99 : 0);
  _setText('scTotalPct',   active + ' aktif · ' + isolated + ' isolir');

  _setText('scOverdue',    overdue);
  _setBar ('scOverdueBar', overdue / Math.max(total, 1));
  _setText('scOverduePct', overdue > 0
    ? Math.round(overdue / Math.max(active, 1) * 100) + '% dari pelanggan aktif'
    : 'Tidak ada overdue');

  _setText('scDueSoon',    dueSoon);
  _setBar ('scDueSoonBar', dueSoon / Math.max(active, 1));
  _setText('scDueSoonPct', dueSoon > 0
    ? dueSoon + ' akan jatuh tempo dalam 3 hari'
    : 'Tidak ada mendekati jatuh tempo');

  // Card 4: Revenue
  const rev = s.monthly_revenue || 0;
  let revFmt = 'Rp 0';
  if (rev >= 1000000)  revFmt = 'Rp ' + (rev/1000000).toFixed(1).replace('.0','') + 'jt';
  else if (rev >= 1000) revFmt = 'Rp ' + Math.round(rev/1000) + 'rb';
  else if (rev > 0)    revFmt = 'Rp ' + Math.round(rev).toLocaleString('id-ID');
  _setText('scRevenue',    revFmt);
  _setBar ('scRevenueBar', active > 0 ? Math.min((rev / (active * 200000)), 1) : 0);
  _setText('scRevenuePct', rev > 0
    ? 'Estimasi dari ' + active + ' pelanggan aktif'
    : (active > 0 ? 'Pelanggan aktif belum punya paket' : 'Belum ada pelanggan aktif'));

  // Hidden stubs
  _setText('scActive',     active);
  _setText('scInactive',   inactive);
  _setText('scNoDue',      Math.max(0, total - active));
  _setText('scIsolated',   isolated + inactive);
  _setText('scActiveSub',  Math.round(active / Math.max(total,1)*100) + '% dari total ' + total);
  _setText('scTotal2',     total);

  const subtitle = document.getElementById('headerSubtitle');
  if (subtitle) subtitle.textContent = 'Manajemen pelanggan, terdapat ' + total + ' customer terdaftar';
}

function _setBar(id, ratio) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(Math.max(ratio * 100, 2), 100) + '%';
}

function _setPct(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── LIST ──────────────────────────────────────────────────────
async function loadCustomers() {
  const search = document.getElementById('searchCustomer')?.value || '';
  const status = document.getElementById('filterStatus')?.value   || '';
  const data   = await App.api('/customers?page=' + _custPage + '&limit=20&search=' + encodeURIComponent(search) + '&status=' + status);
  const tbody  = document.getElementById('customerTable');
  const countEl= document.getElementById('customerCount');

  if (!data?.success) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><p style="color:var(--danger);">Gagal memuat data</p></td></tr>';
    return;
  }

  const total = data.pagination?.total || 0;
  if (countEl) countEl.textContent = total + ' pelanggan';

  if (!data.data?.length) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg><p>Tidak ada data customer</p></div></td></tr>';
    _renderPagination(0, 20);
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);

  tbody.innerHTML = data.data.map(function(c) {
    var hash = 0;
    for (var i = 0; i < (c.name||'').length; i++) hash = ((hash<<5)-hash) + c.name.charCodeAt(i);
    var color   = AVATAR_BG[Math.abs(hash) % AVATAR_BG.length];
    var initial = (c.name||'?')[0].toUpperCase();

    // due_date langsung dari kolom customers.due_date
    // Tidak perlu kalkulasi — sudah di-set via form atau migration
    if (!c.latest_due_date && c.due_date) {
      c.latest_due_date = c.due_date;
    }

    var dueDateHtml = '<span style="color:#94a3b8">–</span>';
    if (c.latest_due_date) {
      var due      = new Date(c.latest_due_date+'T00:00:00');
      var diffDays = Math.round((due - today)/86400000);
      var fmtDue   = due.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
      if (c.latest_invoice_status === 'paid') {
        dueDateHtml = fmtDue+' <span style="font-size:10px;background:#f0fdf4;color:#16a34a;padding:1px 6px;border-radius:4px;font-weight:700">Lunas</span>';
      } else if (diffDays < 0) {
        dueDateHtml = '<span style="color:#dc2626;font-weight:600">'+fmtDue+'</span><br><span style="font-size:10px;color:#dc2626">'+Math.abs(diffDays)+' hari lalu</span>';
      } else if (diffDays === 0) {
        dueDateHtml = '<span style="color:#ea580c;font-weight:600">'+fmtDue+'</span><br><span style="font-size:10px;color:#ea580c">Hari ini!</span>';
      } else if (diffDays <= 3) {
        dueDateHtml = '<span style="color:#d97706;font-weight:600">'+fmtDue+'</span><br><span style="font-size:10px;color:#d97706">'+diffDays+' hari lagi</span>';
      } else {
        dueDateHtml = fmtDue;
      }
    }

    // Status badge
    var dueCk  = c.latest_due_date ? new Date(c.latest_due_date+'T00:00:00') : null;
    var diffCk = dueCk ? Math.round((dueCk - today)/86400000) : null;
    // Status sinkron dengan invoice: overdue = ada invoice unpaid & due sudah lewat
    var isOv = (c.latest_invoice_status === 'overdue') && c.status === 'active';
    var isDs = (c.latest_invoice_status === 'unpaid')  && c.status === 'active' && diffCk !== null && diffCk >= 0 && diffCk <= 3;

    var stCls = 'sb-inactive', stDot = '#94a3b8', stLabel = c.status||'–';
    if      (isOv)                   { stCls='sb-overdue';  stDot='#dc2626'; stLabel='Overdue'; }
    else if (isDs)                   { stCls='sb-due-soon'; stDot='#ea580c'; stLabel='Due Soon'; }
    else if (c.status==='active')    { stCls='sb-active';   stDot='#16a34a'; stLabel='Aktif'; }
    else if (c.status==='isolated')  { stCls='sb-suspended';stDot='#dc2626'; stLabel='Isolir'; }
    else if (c.status==='suspended') { stCls='sb-suspended';stDot='#dc2626'; stLabel='Suspended'; }

    var price = (c.package && c.package.price)
      ? 'Rp '+Number(c.package.price).toLocaleString('id-ID')
      : (c.monthly_fee ? 'Rp '+Number(c.monthly_fee).toLocaleString('id-ID') : '–');

    var isoBtn = '';
    if (c.status==='active')   isoBtn = '<button class="rb rb-iso" onclick="toggleIsolate('+c.id+',\'isolate\')">Isolir</button>';
    if (c.status==='isolated') isoBtn = '<button class="rb rb-act" onclick="toggleIsolate('+c.id+',\'activate\')">Aktifkan</button>';

    var addrShort = c.address ? _esc(c.address.substring(0,30))+(c.address.length>30?'...':'') : '';
    var pkgName   = (c.package && c.package.name) ? _esc(c.package.name) : (c.package_name ? _esc(c.package_name) : '–');
    var actDate   = c.installation_date ? new Date(c.installation_date).toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'}) : '–';

    return '<tr data-id="'+c.id+'">'
      + '<td><span class="cid-badge">'+_esc(c.customer_id)+'</span></td>'
      + '<td>'
        + '<div style="display:flex;align-items:center;gap:11px">'
          + '<div class="av-circle" style="background:'+color+'">'+initial+'</div>'
          + '<div>'
            + '<a href="/customers/profile/'+c.id+'" class="cust-name-link">'+_esc(c.name)+'</a>'
            + (addrShort ? '<div style="font-size:11px;color:#6b7fa8;margin-top:1px;max-width:160px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+addrShort+'</div>' : '')
          + '</div>'
        + '</div>'
      + '</td>'
      + '<td style="color:#6b7fa8">'+_esc(c.phone||'–')+'</td>'
      + '<td>'
        + '<div style="font-weight:600;font-size:13px;color:#0d1b3e">'+pkgName+'</div>'
        + (c.pppoe_username ? '<div style="font-size:10px;color:#94a3b8;font-family:monospace">'+_esc(c.pppoe_username)+'</div>' : '')
        + (c.static_ip ? '<div style="font-size:10px;color:#2563eb;font-family:monospace">IP: '+_esc(c.static_ip)+'</div>' : '')
      + '</td>'
      + '<td style="font-weight:700;color:#1a6ef5;font-size:13px">'+price+'</td>'
      + '<td style="color:#6b7fa8">'+actDate+'</td>'
      + '<td><div style="line-height:1.5">'+dueDateHtml+'</div></td>'
      + '<td><span class="sb '+stCls+'"><span class="sb-dot" style="background:'+stDot+'"></span>'+stLabel+'</span></td>'
      + '<td style="text-align:right;padding-right:18px">'
        + '<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">'
          + '<button class="rb rb-wa" onclick="sendWA(\''+_esc(c.phone||'')+'\')" >WA</button>'
          + '<button class="rb rb-edit" onclick="editCustomer('+c.id+')">Edit</button>'
          + isoBtn
          + '<button class="rb rb-del" onclick="deleteCustomer('+c.id+',\''+_esc(c.name)+'\')" title="Hapus">'
            + '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">'
            + '<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>'
            + '</svg></button>'
        + '</div>'
      + '</td>'
    + '</tr>';
  }).join('');

  _renderPagination(total, 20);
}

function sendWA(phone) {
  if (!phone) { App.showToast('Nomor HP tidak tersedia', 'error'); return; }
  let n = phone.replace(/[^0-9]/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  window.open('https://wa.me/' + n, '_blank');
}
window.sendWA = sendWA;

// ── PACKAGES ─────────────────────────────────────────────────
async function loadPackages() {
  const data = await App.api('/packages');
  const sel  = document.getElementById('custPackage');
  if (!sel || !data?.success) return;
  sel.innerHTML = '<option value="">Pilih paket</option>' +
    data.data.map(p => '<option value="' + p.id + '">' + _esc(p.name) + ' — Rp ' + Number(p.price).toLocaleString('id-ID') + '/bln</option>').join('');
}

// ── SAVE ─────────────────────────────────────────────────────
let _custSaving = false;  // re-entry guard — cegah double-submit dari double-binding/dbl-click

// ─────────────────────────────────────────────────────────────────────
// Modal konfirmasi PPPoE username rename.
// Dipanggil di mode EDIT saat user mengubah pppoe_username dari value asli.
//
// Return Promise<'sync' | 'db_only' | 'cancel'>:
//   - 'sync'    : update DB + rename secret di router MikroTik
//   - 'db_only' : update DB saja (user sudah rename manual di Winbox, dll)
//   - 'cancel'  : batalkan save, kembali ke form
//
// Pakai overlay HTML inline (tidak perlu modal terpisah di EJS).
// ─────────────────────────────────────────────────────────────────────
function _confirmPppoeRename(oldName, newName) {
  return new Promise((resolve) => {
    // Build modal overlay
    const overlay = document.createElement('div');
    overlay.id = '__pppoeRenameModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:14px;max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;';
    box.innerHTML = `
      <div style="padding:18px 22px 14px;border-bottom:1px solid #f1f5f9;">
        <div style="display:flex;align-items:center;gap:10px;">
          <svg width="22" height="22" fill="none" stroke="#d97706" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <div style="font-size:15px;font-weight:700;color:#0f172a;">PPPoE Username Berubah</div>
        </div>
      </div>
      <div style="padding:18px 22px;font-size:13px;color:#334155;line-height:1.6;">
        <div style="margin-bottom:12px;">Anda mengubah PPPoE username:</div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-family:'DM Mono',monospace;font-size:12.5px;margin-bottom:14px;">
          <div style="color:#64748b;"><span style="color:#94a3b8;">lama:</span> ${_esc(oldName) || '<i style="font-style:italic">(kosong)</i>'}</div>
          <div style="color:#0f172a;font-weight:600;margin-top:4px;"><span style="color:#94a3b8;font-weight:400;">baru:</span> ${_esc(newName)}</div>
        </div>
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e;line-height:1.5;margin-bottom:6px;">
          <strong>Apa yang ingin Anda lakukan?</strong><br>
          Tanpa sync ke router, data di FLAYNET dan MikroTik akan tidak konsisten.
        </div>
      </div>
      <div style="padding:14px 22px;background:#fafbfc;border-top:1px solid #f1f5f9;display:flex;flex-direction:column;gap:8px;">
        <button id="__ppRenameSync" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:11px 14px;font-size:13px;font-weight:600;cursor:pointer;text-align:left;line-height:1.4;">
          <div>✓ Update DB &amp; rename di router MikroTik</div>
          <div style="font-size:11px;font-weight:400;opacity:.85;margin-top:2px;">Sinkron otomatis. Customer mungkin disconnect sementara.</div>
        </button>
        <button id="__ppRenameDbOnly" style="background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:8px;padding:11px 14px;font-size:13px;font-weight:600;cursor:pointer;text-align:left;line-height:1.4;">
          <div>Update database saja (tanpa sentuh router)</div>
          <div style="font-size:11px;font-weight:400;color:#64748b;margin-top:2px;">Pilih ini kalau Anda sudah rename manual di Winbox/router.</div>
        </button>
        <button id="__ppRenameCancel" style="background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:8px;padding:9px 14px;font-size:12.5px;font-weight:500;cursor:pointer;margin-top:2px;">
          Batal — kembali ke form
        </button>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const cleanup = () => { try { document.body.removeChild(overlay); } catch (e) {} };
    document.getElementById('__ppRenameSync').onclick    = () => { cleanup(); resolve('sync'); };
    document.getElementById('__ppRenameDbOnly').onclick  = () => { cleanup(); resolve('db_only'); };
    document.getElementById('__ppRenameCancel').onclick  = () => { cleanup(); resolve('cancel'); };
    // ESC = cancel
    const escHandler = (e) => {
      if (e.key === 'Escape') { cleanup(); document.removeEventListener('keydown', escHandler); resolve('cancel'); }
    };
    document.addEventListener('keydown', escHandler);
  });
}

// Helper escape HTML untuk modal di atas — pakai _esc yang sudah ada di file ini.

async function saveCustomer() {
  if (_custSaving) {
    console.warn('[Customer] saveCustomer dipanggil saat masih in-flight, skip');
    return;
  }
  _custSaving = true;

  try {
    await _saveCustomerInner();
  } finally {
    _custSaving = false;
  }
}

async function _saveCustomerInner() {
  const btn  = document.getElementById('saveCustomerBtn');
  const name = document.getElementById('custName')?.value?.trim();
  if (!name) { App.showToast('Nama customer wajib diisi', 'error'); return; }

  const custId = document.getElementById('custId')?.value?.trim().toUpperCase() || '';
  if (!_custEditId && custId) {
    const checkD = await App.api('/customers/check-id?customer_id=' + encodeURIComponent(custId));
    if (!checkD?.available) {
      App.showToast('ID ' + custId + ' sudah digunakan, pilih ID lain', 'error');
      return;
    }
  }

  // ═══ Validasi PPPoE create (kalau diaktifkan, hanya saat tambah baru) ═══
  const createPppoe = !_custEditId
    && !!document.getElementById('custCreatePppoe')?.checked;

  let pppoeData = null;
  if (createPppoe) {
    const mkId        = document.getElementById('custPppoeRouter')?.value?.trim() || '';
    const pppoeUser   = document.getElementById('custPPPoE')?.value?.trim() || '';
    const pppoePass   = document.getElementById('custPppoePassword')?.value?.trim() || '';
    const pppoeProf   = document.getElementById('custPppoeProfile')?.value?.trim() || '';
    const pppoeSvc    = document.getElementById('custPppoeService')?.value || 'pppoe';
    const pppoeLocal  = document.getElementById('custPppoeLocalAddr')?.value?.trim() || '';
    const pppoeRemote = document.getElementById('custPppoeRemoteAddr')?.value?.trim() || '';

    if (!mkId)      { App.showToast('Pilih Router MikroTik untuk PPPoE', 'error'); return; }
    if (!pppoeUser) { App.showToast('PPPoE Username wajib diisi', 'error'); return; }
    if (!pppoePass) { App.showToast('Password PPPoE wajib diisi', 'error'); return; }
    if (!pppoeProf) { App.showToast('Pilih Profile PPPoE', 'error'); return; }

    pppoeData = {
      device_id:     mkId,
      name:          pppoeUser,
      password:      pppoePass,
      profile:       pppoeProf,
      service:       pppoeSvc,
      localAddress:  pppoeLocal,
      remoteAddress: pppoeRemote,
      comment:       (custId ? custId + ' — ' : '') + name
    };
  }

  btn.disabled = true; btn.textContent = 'Menyimpan...';

  // ═══ STEP 1: Buat akun PPPoE di MikroTik dulu (kalau diminta) ═══
  // Alasan: kalau gagal, jangan lanjutkan create customer (rollback gampang).
  let pppoeStatus = 'skipped';
  if (pppoeData) {
    btn.textContent = 'Membuat akun PPPoE...';
    try {
      const url = '/mikrotik/pppoe/secrets?device_id=' + encodeURIComponent(pppoeData.device_id);
      const ppRes = await App.api(url, {
        method: 'POST',
        body: JSON.stringify({
          name:          pppoeData.name,
          password:      pppoeData.password,
          profile:       pppoeData.profile,
          service:       pppoeData.service,
          localAddress:  pppoeData.localAddress,
          remoteAddress: pppoeData.remoteAddress,
          comment:       pppoeData.comment
        })
      });
      if (!ppRes?.success) {
        const errMsg = ppRes?.message || 'Gagal membuat akun PPPoE';
        App.showToast('PPPoE gagal: ' + errMsg + '. Customer TIDAK disimpan.', 'error');
        btn.disabled = false; btn.textContent = 'Simpan Customer';
        return;
      }
      pppoeStatus = 'created';
    } catch (e) {
      App.showToast('PPPoE gagal: ' + e.message + '. Customer TIDAK disimpan.', 'error');
      btn.disabled = false; btn.textContent = 'Simpan Customer';
      return;
    }
  }

  // ═══ STEP 2: Simpan customer ═══
  btn.textContent = 'Menyimpan customer...';

  const phone = document.getElementById('custPhone')?.value || '';
  // Flag kirim WA welcome — hanya relevan saat tambah baru, dan customer punya HP
  const sendWA = !_custEditId
    && !!document.getElementById('custSendWaWelcome')?.checked
    && !!phone.trim();

  // ═══ STEP 2a: Intercept PPPoE username rename di mode EDIT ═══
  // Kalau user mengubah pppoe_username dari value aslinya, butuh konfirmasi
  // apakah harus sync ke router MikroTik atau hanya update DB. Hal ini supaya
  // tidak terjadi desync silent antara DB FLAYNET dan secret di router.
  //
  // Skip modal kalau:
  //   - Mode tambah baru (bukan edit)
  //   - Value tidak berubah dari original
  //   - Original kosong (user isi pertama kali → tidak ada secret lama untuk rename,
  //     cukup catat di DB via PUT generic biasa)
  const currentPppoe = (document.getElementById('custPPPoE')?.value || '').trim();
  let pppoeRenameHandled = false; // kalau true → jangan kirim pppoe_username di body PUT

  if (_custEditId && _originalPppoeUsername && currentPppoe !== _originalPppoeUsername) {
    // Show modal konfirmasi
    const choice = await _confirmPppoeRename(_originalPppoeUsername, currentPppoe);

    if (choice === 'cancel') {
      btn.disabled = false; btn.textContent = 'Simpan Customer';
      return; // user batalkan — tidak save apa-apa
    }

    // User pilih 'sync' atau 'db_only' — panggil endpoint khusus
    btn.textContent = choice === 'sync' ? 'Sync ke router...' : 'Update database...';
    try {
      const renameRes = await App.api(`/customers/${_custEditId}/rename-pppoe`, {
        method: 'POST',
        body: JSON.stringify({
          new_username:   currentPppoe,
          sync_to_router: (choice === 'sync')
        })
      });
      if (!renameRes?.success) {
        App.showToast('Rename PPPoE gagal: ' + (renameRes?.message || 'Unknown error'), 'error');
        btn.disabled = false; btn.textContent = 'Simpan Customer';
        return;
      }
      // Update value original supaya tidak ditampilkan modal lagi kalau save dilanjut
      _originalPppoeUsername = currentPppoe;
      pppoeRenameHandled = true;

      // Toast info hasil rename (akan muncul sebelum toast main success di akhir)
      App.showToast(renameRes.message, choice === 'sync' ? 'success' : 'info');
    } catch (err) {
      App.showToast('Rename PPPoE error: ' + err.message, 'error');
      btn.disabled = false; btn.textContent = 'Simpan Customer';
      return;
    }
  }

  const body = {
    name,
    customer_id:      custId || undefined,
    phone,
    email:            document.getElementById('custEmail')?.value    || '',
    address:          document.getElementById('custAddress')?.value  || '',
    package_id:       document.getElementById('custPackage')?.value  || null,
    due_date:         document.getElementById('custDueDate')?.value || null,
    installation_date:document.getElementById('custInstallDate')?.value || null,
    pppoe_username:   document.getElementById('custPPPoE')?.value    || '',
    ont_sn:           document.getElementById('custOntSn')?.value    || '',
    static_ip:        document.getElementById('custStaticIP')?.value  || null,
    mikrotik_id:      document.getElementById('custMikrotikId')?.value || null,
    status:           document.getElementById('custStatus')?.value   || 'active',
  };
  if (sendWA) body.send_wa_welcome = true;
  // Kalau PPPoE rename sudah di-handle oleh endpoint khusus di atas,
  // hapus field dari body supaya tidak overwrite (endpoint khusus sudah update DB).
  if (pppoeRenameHandled) {
    delete body.pppoe_username;
  }

  const url    = _custEditId ? '/customers/' + _custEditId : '/customers';
  const method = _custEditId ? 'PUT' : 'POST';
  const data   = await App.api(url, { method, body: JSON.stringify(body) });

  if (data?.success) {
    // Sync kredensial portal (cuma jalan di mode edit, panel hidden = no-op)
    const ppRes = await ppSaveCredentials();
    if (!ppRes.ok) {
      // Customer sudah ter-save, tapi update kredensial portal gagal.
      // Jangan close modal — biar admin bisa lihat error & retry.
      App.showToast('Customer tersimpan, tapi kredensial portal gagal: ' + ppRes.message, 'warning');
      btn.disabled = false; btn.textContent = 'Simpan Customer';
      // Tetap refresh list di belakang supaya data lain ter-update.
      loadCustomers();
      loadCustomerStats();
      return;
    }

    // Kalau modal hasil kredensial muncul, beri jeda kecil supaya admin lihat dulu
    const pwModalShown = !!document.getElementById('ppResultModal');
    if (!pwModalShown) {
      window.closeModal();
    } else {
      // Hide saja modal edit (di belakang modal hasil kredensial),
      // biarkan modal hasil yang interaksinya.
      window.closeModal();
    }
    loadCustomers();
    loadCustomerStats();

    // Toast utama
    let msg = _custEditId ? 'Customer diperbarui' : 'Customer ditambahkan';
    let toastType = 'success';

    // Info status pembuatan PPPoE
    if (pppoeStatus === 'created') {
      msg += ' • Akun PPPoE dibuat ✓';
    }

    // Tambah info status WA kalau dikirim
    if (!_custEditId && sendWA && data.wa_status) {
      if (data.wa_status === 'sent') {
        msg += ' • WA welcome terkirim ✓';
      } else if (data.wa_status === 'no_phone') {
        msg += ' (no HP, WA dilewati)';
      } else if (data.wa_status === 'no_wa_session') {
        msg += ' (WA Gateway belum terhubung)';
        toastType = 'warning';
      } else if (data.wa_status === 'disabled') {
        msg += ' (notif WA dinonaktifkan)';
      } else {
        msg += ' (WA gagal terkirim)';
        toastType = 'warning';
      }
    }
    App.showToast(msg, toastType);
  } else {
    // Customer gagal disimpan tapi PPPoE sudah dibuat — beri warning supaya admin tahu
    if (pppoeStatus === 'created') {
      App.showToast(
        'PPPoE sudah dibuat di MikroTik tapi customer gagal disimpan: ' + (data?.message || 'Unknown error') +
        '. Silakan hapus secret PPPoE manual atau ulangi simpan customer.',
        'error'
      );
    } else {
      App.showToast(data?.message || 'Gagal menyimpan', 'error');
    }
  }
  btn.disabled = false; btn.textContent = 'Simpan Customer';
}

// ── PAGINATION ────────────────────────────────────────────────
function _renderPagination(total, limit) {
  var totalPages = Math.ceil(total / limit);
  var el = document.getElementById('customerPagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  var offset = (_custPage-1)*limit;
  var info = '<div style="font-size:12.5px;color:var(--d-muted)">Menampilkan <strong style=\"color:var(--d-text)\">'+(offset+1)+'–'+Math.min(offset+limit,total)+'</strong> dari <strong style=\"color:var(--d-text)\">'+total+'</strong> customer</div>';
  var btns = '<div style="display:flex;gap:4px">';
  if (_custPage > 1) btns += '<a href="#" class="pg-btn" onclick="_goPage('+(_custPage-1)+');return false">←</a>';
  for (var i=Math.max(1,_custPage-2); i<=Math.min(totalPages,_custPage+2); i++) {
    btns += '<a href="#" class="pg-btn '+(i===_custPage?'active':'')+'" onclick="_goPage('+i+');return false">'+i+'</a>';
  }
  if (_custPage < totalPages) btns += '<a href="#" class="pg-btn" onclick="_goPage('+(_custPage+1)+');return false">→</a>';
  btns += '</div>';
  el.innerHTML = info + btns;
}
window._goPage = function(p) { _custPage = p; loadCustomers(); };

// ── CUSTOMER ID helpers ───────────────────────────────────────
function setIdStatus(type, id) {
  const el = document.getElementById('custIdStatus');
  if (!el) return;
  const map = {
    hint:      '<span style="color:#adb5bd;font-size:11px;">Berikutnya: <b>' + _esc(id) + '</b></span>',
    auto:      '<span style="color:#25d366;font-size:11px;font-weight:600;">✓ Otomatis: ' + _esc(id) + '</span>',
    available: '<span style="color:#25d366;font-size:11px;font-weight:600;">✓ ID tersedia</span>',
    taken:     '<span style="color:#dc2626;font-size:11px;font-weight:600;">✗ ID sudah digunakan</span>',
    existing:  '<span style="color:#667781;font-size:11px;">ID tidak bisa diubah</span>',
    checking:  '<span style="color:#f59e0b;font-size:11px;">⏳ Mengecek...</span>',
  };
  el.innerHTML = map[type] || '';
}

const _checkIdDebounced = _debounce(async (val) => {
  if (!val || val.length < 2) { setIdStatus(''); return; }
  setIdStatus('checking');
  const d = await App.api('/customers/check-id?customer_id=' + encodeURIComponent(val));
  setIdStatus(d?.available ? 'available' : 'taken');
}, 500);

window.onCustIdInput = function(val) {
  const upper = val.toUpperCase();
  const el = document.getElementById('custId');
  if (el) el.value = upper;
  if (!upper.trim()) setIdStatus(_nextAutoId ? 'auto' : '', _nextAutoId);
  else _checkIdDebounced(upper.trim());
};

window.refreshNextId = async function() {
  const d = await App.api('/customers/next-id');
  if (d?.success) { _nextAutoId = d.customer_id; _setVal('custId', ''); setIdStatus('hint', d.customer_id); const el = document.getElementById('custId'); if(el) el.placeholder = 'Kosongkan → otomatis: ' + d.customer_id; }
};

// ── HELPERS ───────────────────────────────────────────────────
function _clearForm() {
  ['custName','custPhone','custEmail','custAddress','custPPPoE','custOntSn','custId','custInstallDate','custStaticIP',
   'custPppoePassword','custPppoeLocalAddr','custPppoeRemoteAddr'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  _setVal('custPackage', ''); _setVal('custDueDate', ''); _setVal('custStatus', 'active');
  const mkSel2 = document.getElementById('custMikrotikId');
  if (mkSel2) mkSel2.value = '';

  // Reset flag manual-edit PPPoE → auto-fill dari nama aktif kembali
  _pppoeManuallyEdited = false;

  // Reset PPPoE creation panel ke state default
  const cbPppoe = document.getElementById('custCreatePppoe');
  if (cbPppoe) cbPppoe.checked = false;
  const formBox = document.getElementById('pppoeFormBox');
  if (formBox) formBox.style.display = 'none';
  _setVal('custPppoeService', 'pppoe');
  const routerSel = document.getElementById('custPppoeRouter');
  if (routerSel) routerSel.innerHTML = '<option value="">— Memuat daftar router —</option>';
  const profSel = document.getElementById('custPppoeProfile');
  if (profSel) profSel.innerHTML = '<option value="">— Pilih router dulu —</option>';
  const hintBox = document.getElementById('pppoeFormHint');
  if (hintBox) { hintBox.style.display = 'none'; hintBox.innerHTML = ''; }

  // Set default tanggal aktivasi = hari ini, billing_date = tgl sama bulan depan
  const todayStr = new Date().toISOString().split('T')[0];
  _setVal('custInstallDate', todayStr);
  if (typeof onActivationDateChange === 'function') onActivationDateChange();
  const idStatus = document.getElementById('custIdStatus'); if (idStatus) idStatus.innerHTML = '';
}
function _setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function _setVal(id, val)  { const el = document.getElementById(id); if (el) el.value = val; }
function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// Note: tombol Simpan sudah punya inline onclick="saveCustomerBtn()" di customers.ejs
// yang memanggil saveCustomer(). JANGAN tambahkan addEventListener('click', saveCustomer)
// di sini — akan menyebabkan double-fire (customer ter-create 2x, toast muncul 2x).

// ── Auto billing_date dari activation_date ───────────────────
window.onActivationDateChange = function() {
  const activEl = document.getElementById('custInstallDate');
  const dueEl   = document.getElementById('custDueDate');
  if (!activEl || !dueEl) return;

  // Hanya auto-set due_date jika mode TAMBAH BARU dan due_date belum diisi
  if (!window._custEditId && activEl.value && !dueEl.value) {
    const actDate = new Date(activEl.value);
    if (!isNaN(actDate)) {
      // Due date = tanggal sama, bulan depan (ikuti logika PHP)
      const nextMonth = new Date(actDate.getFullYear(), actDate.getMonth()+1, actDate.getDate());
      dueEl.value = nextMonth.toISOString().split('T')[0];
    }
  }
};



// ── Load MikroTik devices for dropdown ───────────────────────
async function loadMikrotikDevices() {
  const d = await App.api('/isolir/devices').catch(() => null);
  const sel = document.getElementById('custMikrotikId');
  if (!sel || !d?.data) return;
  sel.innerHTML = '<option value="">— Pilih router —</option>' +
    d.data.map(dev =>
      `<option value="${dev.id}">${dev.name} (${dev.host})</option>`
    ).join('');
}

// ═══════════════════════════════════════════════════════════════
// PPPoE Account Creation
// ═══════════════════════════════════════════════════════════════

// Load daftar router dari tabel `devices` (sumber data sama dgn halaman /devices)
async function loadPppoeRouters() {
  console.log('[PPPoE] loadPppoeRouters called');
  const sel = document.getElementById('custPppoeRouter');
  const spinner = document.getElementById('pppoeRouterSpinner');
  if (!sel) { console.warn('[PPPoE] custPppoeRouter element not found'); return; }

  sel.innerHTML = '<option value="">Memuat router...</option>';
  sel.disabled = true;
  if (spinner) spinner.style.display = 'inline';

  try {
    const d = await App.api('/devices/mikrotik-list');
    console.log('[PPPoE] router list response:', d);
    if (d?.success && Array.isArray(d.data) && d.data.length) {
      // Sort: primary first, lalu alfabet by name
      const routers = d.data.slice().sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      sel.innerHTML = '<option value="">— Pilih router —</option>' +
        routers.map(r => {
          const tag = r.is_primary ? ' ★ primary' : '';
          const stat = r.status === 'online' ? '' : ' [' + (r.status || 'unknown') + ']';
          return `<option value="${r.id}">${_esc(r.name)} (${_esc(r.ip_address)})${tag}${stat}</option>`;
        }).join('');
      console.log('[PPPoE] loaded', routers.length, 'routers');
    } else {
      sel.innerHTML = '<option value="">Tidak ada router terdaftar</option>';
      const hint = document.getElementById('pppoeFormHint');
      if (hint) {
        hint.style.display = 'block';
        hint.innerHTML = '<strong style="color:#dc2626">⚠</strong> Belum ada router MikroTik di halaman <a href="/devices" target="_blank" style="color:#2563eb;text-decoration:underline">Devices</a>. Tambahkan router dulu (tipe: Router, aktif).';
      }
    }
  } catch (e) {
    console.error('[PPPoE] loadPppoeRouters exception:', e);
    sel.innerHTML = '<option value="">Error: ' + _esc(e.message) + '</option>';
  } finally {
    sel.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

// Load profiles dari router yang dipilih
async function loadPppoeProfiles(deviceId) {
  console.log('[PPPoE] loadPppoeProfiles called with deviceId =', deviceId);
  const sel = document.getElementById('custPppoeProfile');
  const spinner = document.getElementById('pppoeProfileSpinner');
  if (!sel) { console.warn('[PPPoE] custPppoeProfile element not found'); return; }

  if (!deviceId) {
    sel.innerHTML = '<option value="">— Pilih router dulu —</option>';
    return;
  }

  // Show spinner & disable
  sel.innerHTML = '<option value="">Memuat profile...</option>';
  sel.disabled = true;
  if (spinner) spinner.style.display = 'inline';

  try {
    const url = '/mikrotik/pppoe/profiles?device_id=' + encodeURIComponent(deviceId);
    console.log('[PPPoE] fetching:', url);
    const d = await App.api(url);
    console.log('[PPPoE] profile response:', d);

    if (d?.success && Array.isArray(d.data) && d.data.length) {
      // Sort: 'default' first, lalu alfabet
      const profiles = d.data.slice().sort((a, b) => {
        if (a.name === 'default') return -1;
        if (b.name === 'default') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      sel.innerHTML = '<option value="">— Pilih profile —</option>' +
        profiles.map(p => {
          const meta = [];
          if (p.rateLimit) meta.push(p.rateLimit);
          if (p.localAddress) meta.push('local:' + p.localAddress);
          if (p.remoteAddress) meta.push('pool:' + p.remoteAddress);
          const label = p.name + (meta.length ? '  •  ' + meta.join(' / ') : '');
          return `<option value="${_esc(p.name)}" data-rate="${_esc(p.rateLimit||'')}" data-local="${_esc(p.localAddress||'')}" data-remote="${_esc(p.remoteAddress||'')}">${_esc(label)}</option>`;
        }).join('');
      console.log('[PPPoE] loaded', profiles.length, 'profiles');
    } else if (d?.success && Array.isArray(d.data) && d.data.length === 0) {
      sel.innerHTML = '<option value="">Tidak ada profile di router ini</option>';
    } else {
      sel.innerHTML = '<option value="">Gagal muat profile</option>';
      const errMsg = d?.message || 'Response tidak valid (cek koneksi MikroTik)';
      console.error('[PPPoE] load profiles failed:', errMsg, d);
      const hint = document.getElementById('pppoeFormHint');
      if (hint) {
        hint.style.display = 'block';
        hint.innerHTML = '<strong style="color:#dc2626">⚠ Gagal muat profile:</strong> ' + _esc(errMsg);
      }
    }
  } catch (e) {
    console.error('[PPPoE] loadPppoeProfiles exception:', e);
    sel.innerHTML = '<option value="">Error: ' + _esc(e.message) + '</option>';
    const hint = document.getElementById('pppoeFormHint');
    if (hint) {
      hint.style.display = 'block';
      hint.innerHTML = '<strong style="color:#dc2626">⚠ Error:</strong> ' + _esc(e.message);
    }
  } finally {
    sel.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

// Generate random password 10 chars (alfanumeric)
window.generatePppoePassword = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
  const el = document.getElementById('custPppoePassword');
  if (el) el.value = pw;
};

// Bind event listeners untuk panel PPPoE create
// Pakai event delegation pada document supaya listener tetap berfungsi
// terlepas dari urutan load script vs DOMContentLoaded.
(function bindPppoeHandlers() {
  document.addEventListener('change', function(e) {
    const t = e.target;
    if (!t || !t.id) return;

    // 1. Toggle visibility form PPPoE saat checkbox di-klik
    if (t.id === 'custCreatePppoe') {
      const formBox = document.getElementById('pppoeFormBox');
      if (formBox) formBox.style.display = t.checked ? '' : 'none';

      if (t.checked) {
        // Load daftar router dari /api/devices/mikrotik-list
        loadPppoeRouters();
        // Reset profile dropdown
        const profSel = document.getElementById('custPppoeProfile');
        if (profSel) profSel.innerHTML = '<option value="">— Pilih router dulu —</option>';
        const hint = document.getElementById('pppoeFormHint');
        if (hint) { hint.style.display = 'none'; hint.innerHTML = ''; }

        // Auto-fill PPPoE Username dari nama (hanya di mode TAMBAH baru,
        // dan kalau user belum edit manual field PPPoE).
        // Berguna untuk skenario: user sudah ketik nama dulu, lalu baru
        // centang "Buat Akun PPPoE" — field auto-terisi langsung.
        if (!_custEditId && !_pppoeManuallyEdited) {
          const nameEl  = document.getElementById('custName');
          const pppoeEl = document.getElementById('custPPPoE');
          if (nameEl && pppoeEl && nameEl.value.trim()) {
            pppoeEl.value = _slugifyForPppoe(nameEl.value);
          }
        }
      } else {
        const hint = document.getElementById('pppoeFormHint');
        if (hint) { hint.style.display = 'none'; hint.innerHTML = ''; }

        // Saat uncheck: clear field PPPoE Username supaya tidak ikut ter-submit
        // (intent user = tidak buat akun PPPoE, jadi tidak set username di DB).
        // Hanya di mode TAMBAH baru — di mode edit field ini hidden tapi tetap
        // perlu pertahankan value asli dari DB.
        if (!_custEditId) {
          const pppoeEl = document.getElementById('custPPPoE');
          if (pppoeEl) pppoeEl.value = '';
          _pppoeManuallyEdited = false; // reset flag → auto-fill aktif lagi kalau dicentang ulang
        }
      }
      return;
    }

    // 2. Saat router PPPoE dipilih, load daftar profile dari router itu
    if (t.id === 'custPppoeRouter') {
      loadPppoeProfiles(t.value);
      const hint = document.getElementById('pppoeFormHint');
      if (hint) { hint.style.display = 'none'; hint.innerHTML = ''; }
      return;
    }

    // 3. Saat profile dipilih, tampilkan info rate-limit dari profile
    if (t.id === 'custPppoeProfile') {
      const opt = t.options[t.selectedIndex];
      const hint = document.getElementById('pppoeFormHint');
      if (!opt || !opt.value) {
        if (hint) { hint.style.display = 'none'; hint.innerHTML = ''; }
        return;
      }
      const rate = opt.dataset.rate || '';
      const local = opt.dataset.local || '';
      const remote = opt.dataset.remote || '';
      const parts = [];
      if (rate) parts.push('<strong>Rate-limit:</strong> ' + _esc(rate));
      if (local) parts.push('<strong>Local addr (profile):</strong> ' + _esc(local));
      if (remote) parts.push('<strong>Pool (profile):</strong> ' + _esc(remote));
      if (hint) {
        if (parts.length) {
          hint.style.display = 'block';
          hint.innerHTML = '<strong style="color:#16a34a">✓ Profile terpilih</strong> &nbsp; ' + parts.join(' &nbsp;|&nbsp; ');
        } else {
          hint.style.display = 'none';
          hint.innerHTML = '';
        }
      }
      return;
    }
  });
})();

// ─────────────────────────────────────────────────────────────────────
// AUTO-GENERATE PPPoE Username dari Nama Customer
// ─────────────────────────────────────────────────────────────────────
// Saat user mengetik nama di field `custName`, field `custPPPoE` ikut
// terisi otomatis dengan versi slugified (huruf+angka, tanpa spasi).
//
// Aturan:
//   1. Hanya jalan di mode TAMBAH baru (_custEditId == null). Saat edit,
//      username yang sudah ada tidak ditimpa.
//   2. Tidak menimpa kalau user sudah pernah mengetik manual di custPPPoE
//      (di-track oleh flag `_pppoeManuallyEdited`).
//   3. Kalau user mengosongkan field PPPoE setelah edit manual, flag
//      direset → auto-fill aktif kembali (user bisa "minta generate ulang"
//      dengan cara mengosongkan field).
//
// Pakai event delegation pada document supaya berfungsi terlepas dari
// urutan load script vs. DOMContentLoaded (konsisten dengan pola
// bindPppoeHandlers di atas).
// ─────────────────────────────────────────────────────────────────────
(function bindPppoeAutoGen() {
  document.addEventListener('input', function(e) {
    const t = e.target;
    if (!t || !t.id) return;

    // (A) Ketika user mengetik di field Nama → propagate ke custPPPoE
    if (t.id === 'custName') {
      if (_custEditId) return;              // skip di mode edit
      if (_pppoeManuallyEdited) return;     // skip kalau user sudah edit manual

      const pppoeEl = document.getElementById('custPPPoE');
      if (!pppoeEl) return;
      pppoeEl.value = _slugifyForPppoe(t.value);
      return;
    }

    // (B) Ketika user mengetik manual di field PPPoE → set flag
    //     supaya auto-fill berhenti menimpa.
    //     Kalau user mengosongkan field, reset flag supaya auto-fill
    //     kembali aktif (re-generate dari nama).
    if (t.id === 'custPPPoE') {
      _pppoeManuallyEdited = !!(t.value && t.value.trim());
      return;
    }
  });
})();

// ═══════════════════════════════════════════════════════════════════════
// PORTAL CREDENTIALS — admin mengubah login ID & password Customer Portal
// (hanya tampil saat modal EDIT customer, di-injeksi oleh editCustomer())
// ═══════════════════════════════════════════════════════════════════════

function ppLoadCredentials(custId) {
  const cidInput = document.getElementById('ppCid');
  const cidBtn   = document.getElementById('ppCidToggle');
  const cidWarn  = document.getElementById('ppCidWarn');
  const pwInput  = document.getElementById('ppPw');
  const hint     = document.getElementById('ppPwHint');
  const last     = document.getElementById('ppLastLogin');
  const enabled  = document.getElementById('ppEnabled');

  if (cidInput) { cidInput.value=''; cidInput.readOnly=true; cidInput.style.background='#eef2f7'; cidInput.style.cursor='not-allowed'; }
  if (cidBtn)   { cidBtn.textContent='Ubah'; cidBtn.style.color='#1a6ef5'; cidBtn.style.borderColor='#e4ecf7'; }
  if (cidWarn)  { cidWarn.style.display='none'; }
  if (pwInput)  { pwInput.value=''; pwInput.type='password'; }
  if (hint)     { hint.textContent='Memuat…'; hint.style.color='#94a3b8'; }
  if (last)     { last.textContent=''; }
  if (enabled)  { enabled.checked = true; }

  App.api('/customers/' + custId + '/portal-credentials').then(function(r){
    if (!r || !r.success || !r.data) {
      if (hint) { hint.textContent='Tidak dapat memuat data kredensial portal'; hint.style.color='#dc2626'; }
      return;
    }
    const d = r.data;
    if (cidInput) cidInput.value = d.customer_id || '';
    if (enabled)  enabled.checked = !!d.portal_enabled;
    if (hint) {
      if (d.has_custom_password) {
        hint.innerHTML = '✓ Password sudah diset. Kosongkan untuk tidak mengubah.';
        hint.style.color = '#16a34a';
      } else if (d.fallback_login_hint) {
        hint.innerHTML = 'Belum ada password custom — pelanggan login pakai nomor HP: <span style="font-family:DM Mono,monospace;color:#0d1b3e;font-weight:600;">' + _esc(d.fallback_login_hint) + '</span>';
        hint.style.color = '#b45309';
      } else {
        hint.innerHTML = '⚠ Belum ada password & belum ada nomor HP — pelanggan tidak bisa login.';
        hint.style.color = '#dc2626';
      }
    }
    if (last) {
      if (d.last_portal_login) {
        const dt = new Date(d.last_portal_login);
        last.textContent = 'Login terakhir: ' + dt.toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short' });
      } else {
        last.textContent = 'Pelanggan belum pernah login ke portal.';
      }
    }
  }).catch(function(e){
    if (hint) { hint.textContent='Gagal memuat: ' + (e.message||'error'); hint.style.color='#dc2626'; }
  });
}

window.ppToggleCidEdit = function() {
  const cidInput = document.getElementById('ppCid');
  const btn      = document.getElementById('ppCidToggle');
  const warn     = document.getElementById('ppCidWarn');
  if (!cidInput || !btn) return;
  const nowLocked = cidInput.readOnly;
  if (nowLocked) {
    // Unlock
    cidInput.readOnly = false;
    cidInput.style.background = '#fff';
    cidInput.style.cursor = 'text';
    cidInput.focus();
    cidInput.select();
    btn.textContent = 'Batal';
    btn.style.color = '#dc2626';
    btn.style.borderColor = '#fecaca';
    if (warn) warn.style.display = 'block';
  } else {
    // Lock — reload original value
    if (_custEditId) ppLoadCredentials(_custEditId);
  }
};

window.ppTogglePwVisibility = function() {
  const pw = document.getElementById('ppPw');
  if (!pw) return;
  pw.type = (pw.type === 'password') ? 'text' : 'password';
};

window.ppGeneratePassword = function() {
  // 8 karakter mudah dibaca — tanpa O/0/I/l yang ambigu
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  let out = '';
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(8);
    window.crypto.getRandomValues(arr);
    for (let i=0;i<8;i++) out += chars[arr[i] % chars.length];
  } else {
    for (let j=0;j<8;j++) out += chars[Math.floor(Math.random()*chars.length)];
  }
  const pw = document.getElementById('ppPw');
  if (pw) { pw.value = out; pw.type = 'text'; }
};

window.ppResetPasswordToPhone = async function() {
  if (!_custEditId) return;
  if (!confirm('Reset password pelanggan? Setelah reset, pelanggan akan login menggunakan nomor HP-nya sendiri.')) return;
  try {
    const r = await App.api('/customers/' + _custEditId + '/portal-credentials/reset', { method: 'POST' });
    if (r && r.success) {
      App.showToast(r.message || 'Password direset', 'success');
      ppLoadCredentials(_custEditId);
      const pw = document.getElementById('ppPw');
      if (pw) pw.value = '';
    } else {
      App.showToast((r && r.message) ? r.message : 'Gagal reset password', 'error');
    }
  } catch (err) {
    App.showToast('Error: ' + (err.message||err), 'error');
  }
};

// Dipanggil dari _saveCustomerInner() setelah customer ter-save.
// Return { ok: bool, message: string } supaya saveCustomer bisa tampilkan error tanpa close modal.
async function ppSaveCredentials() {
  if (!_custEditId) return { ok: true };

  const cidInput = document.getElementById('ppCid');
  const pwInput  = document.getElementById('ppPw');
  const enabled  = document.getElementById('ppEnabled');
  const portalBox = document.getElementById('portalPanelBox');

  // Panel tersembunyi (mode tambah baru) → skip
  if (!portalBox || portalBox.style.display === 'none') return { ok: true };

  const payload = {};

  // Customer ID — kirim kalau input ter-unlock
  if (cidInput && !cidInput.readOnly) {
    const cid = (cidInput.value || '').trim();
    if (cid) payload.customer_id = cid;
  }
  // Password — kirim kalau ada isi
  if (pwInput && pwInput.value) {
    if (pwInput.value.length < 6) {
      return { ok:false, message:'Password portal minimal 6 karakter' };
    }
    payload.new_password = pwInput.value;
  }
  // portal_enabled
  if (enabled) payload.portal_enabled = !!enabled.checked;

  try {
    const r = await App.api('/customers/' + _custEditId + '/portal-credentials', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (r && r.success) {
      // Kalau ada password baru di-set, tampilkan modal hasil supaya admin bisa salin
      if (r.data && r.data.new_password) {
        ppShowResultModal(r.data.customer_id || (cidInput && cidInput.value), r.data.new_password);
      }
      return { ok: true };
    } else {
      // "Tidak ada perubahan" bukan error nyata — anggap OK supaya save profil tidak gagal
      if (r && /tidak ada perubahan/i.test(r.message || '')) return { ok: true };
      return { ok:false, message: (r && r.message) ? r.message : 'Gagal update kredensial portal' };
    }
  } catch (err) {
    return { ok:false, message: err.message || String(err) };
  }
}

function ppShowResultModal(custId, password) {
  const existing = document.getElementById('ppResultModal');
  if (existing) existing.remove();

  const html = ''
    + '<div id="ppResultModal" style="position:fixed;inset:0;z-index:10001;background:rgba(13,27,62,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);">'
    +   '<div style="background:#fff;border-radius:18px;width:100%;max-width:420px;padding:24px;box-shadow:0 30px 80px rgba(13,27,62,.3);">'
    +     '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">'
    +       '<div style="width:36px;height:36px;border-radius:10px;background:#dcfce7;display:flex;align-items:center;justify-content:center;">'
    +         '<svg width="18" height="18" fill="none" stroke="#16a34a" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
    +       '</div>'
    +       '<div style="font-size:15px;font-weight:800;color:#0d1b3e;">Kredensial Portal Baru</div>'
    +     '</div>'
    +     '<div style="font-size:12.5px;color:#64748b;margin-bottom:14px;line-height:1.5;">'
    +       'Berikut detail login pelanggan untuk Customer Portal. '
    +       '<span style="color:#dc2626;font-weight:600;">Salin dan kirim ke pelanggan sekarang</span> — password ini tidak akan ditampilkan lagi.'
    +     '</div>'
    +     '<div style="background:#f8fafd;border:1.5px solid #e4ecf7;border-radius:12px;padding:14px;margin-bottom:14px;font-family:DM Mono,ui-monospace,monospace;">'
    +       '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">'
    +         '<span style="font-size:10.5px;color:#94a3b8;text-transform:uppercase;font-weight:700;font-family:DM Sans,sans-serif;letter-spacing:.05em;">Customer ID</span>'
    +         '<span id="ppResCid" style="font-size:13.5px;color:#0d1b3e;font-weight:600;">' + _esc(custId||'') + '</span>'
    +       '</div>'
    +       '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">'
    +         '<span style="font-size:10.5px;color:#94a3b8;text-transform:uppercase;font-weight:700;font-family:DM Sans,sans-serif;letter-spacing:.05em;">Password</span>'
    +         '<span id="ppResPw" style="font-size:13.5px;color:#0d1b3e;font-weight:600;letter-spacing:.05em;">' + _esc(password||'') + '</span>'
    +       '</div>'
    +     '</div>'
    +     '<div style="display:flex;gap:8px;">'
    +       '<button id="ppResCopyBtn" onclick="ppCopyResult()" style="flex:1;padding:10px;border:1.5px solid #e4ecf7;border-radius:10px;background:#fff;color:#1a6ef5;font-size:12.5px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">Salin Keduanya</button>'
    +       '<button onclick="document.getElementById(\'ppResultModal\').remove()" style="flex:1;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#1a6ef5,#0047cc);color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">Selesai</button>'
    +     '</div>'
    +   '</div>'
    + '</div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

window.ppCopyResult = function() {
  const cidEl = document.getElementById('ppResCid');
  const pwEl  = document.getElementById('ppResPw');
  if (!cidEl || !pwEl) return;
  const txt = 'Customer ID: ' + cidEl.textContent + '\nPassword: ' + pwEl.textContent;
  const btn = document.getElementById('ppResCopyBtn');
  const done = function(){ if (btn) { btn.textContent='✓ Tersalin'; btn.style.color='#16a34a'; setTimeout(function(){ btn.textContent='Salin Keduanya'; btn.style.color='#1a6ef5'; }, 1500); } };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(function(){
      const ta = document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); done();}catch(_){} document.body.removeChild(ta);
    });
  } else {
    const ta = document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); done();}catch(_){} document.body.removeChild(ta);
  }
};
