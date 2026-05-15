/**
 * CustomerImportController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Endpoint untuk import & export data customer via Excel.
 *
 * Fitur:
 *   - GET    /api/customers/export          — download semua customer sebagai .xlsx
 *   - GET    /api/customers/import-template — download template kosong .xlsx
 *   - POST   /api/customers/import-preview  — parse upload file, return preview JSON
 *   - POST   /api/customers/import-confirm  — eksekusi import setelah preview
 */

const ExcelJS = require('exceljs');
const path    = require('path');
const fs      = require('fs');
const logger  = require('../utils/logger');

// Kolom yang ada di Excel (urutan = urutan di sheet)
// `required: true` = wajib diisi user. `customer_id` boleh kosong → auto-generate.
const COLUMNS = [
  { key: 'customer_id',       header: 'ID Pelanggan',       required: false, width: 16 },
  { key: 'name',              header: 'Nama',               required: true,  width: 30 },
  { key: 'phone',             header: 'No. HP',             required: false, width: 16 },
  { key: 'email',             header: 'Email',              required: false, width: 28 },
  { key: 'address',           header: 'Alamat',             required: false, width: 40 },
  { key: 'package_name',      header: 'Nama Paket',         required: false, width: 18 },
  { key: 'status',            header: 'Status',             required: false, width: 12 },
  { key: 'latitude',          header: 'Latitude',           required: false, width: 12 },
  { key: 'longitude',         header: 'Longitude',          required: false, width: 12 },
  { key: 'ont_sn',            header: 'ONT Serial Number',  required: false, width: 22 },
  { key: 'ont_mac',           header: 'ONT MAC Address',    required: false, width: 18 },
  { key: 'installation_date', header: 'Tanggal Instalasi',  required: false, width: 14 },
  { key: 'notes',             header: 'Catatan',            required: false, width: 30 },
];

const VALID_STATUS = ['active', 'inactive', 'isolated', 'suspended'];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — generate Excel berisi semua customer
// ─────────────────────────────────────────────────────────────────────────────
exports.exportExcel = async (req, res) => {
  try {
    const { Customer, Package } = require('../models');

    // Ambil semua customer dengan relasi paket
    const customers = await Customer.findAll({
      include: [{ model: Package, as: 'package', attributes: ['name'] }],
      order: [['customer_id', 'ASC']],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DIGSnet';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Customers');

    // Header row
    sheet.columns = COLUMNS.map(c => ({
      header: c.header,
      key: c.key,
      width: c.width,
    }));

    // Style header
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A6EF5' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
    });
    sheet.getRow(1).height = 24;

    // Data rows
    customers.forEach(c => {
      sheet.addRow({
        customer_id:        c.customer_id,
        name:               c.name,
        phone:              c.phone || '',
        email:              c.email || '',
        address:            c.address || '',
        package_name:       c.package?.name || '',
        status:             c.status || 'active',
        latitude:           c.latitude || '',
        longitude:          c.longitude || '',
        ont_sn:             c.ont_sn || '',
        ont_mac:            c.ont_mac || '',
        installation_date:  c.installation_date || '',
        notes:              c.notes || '',
      });
    });

    // Format kolom tertentu
    sheet.getColumn('latitude').numFmt = '0.00000000';
    sheet.getColumn('longitude').numFmt = '0.00000000';

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Set response headers
    const filename = `customers-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('[CustomerImport] Export failed:', err);
    res.status(500).json({ success: false, message: 'Gagal export: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE — generate Excel kosong dengan header + contoh
// ─────────────────────────────────────────────────────────────────────────────
exports.downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DIGSnet';
    const sheet = workbook.addWorksheet('Customers');

    sheet.columns = COLUMNS.map(c => ({
      header: c.header + (c.required ? ' *' : ''),
      key: c.key,
      width: c.width,
    }));

    // Style header
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A6EF5' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    sheet.getRow(1).height = 24;

    // Contoh row 1
    sheet.addRow({
      customer_id:        'CUST001',
      name:               'Budi Santoso',
      phone:              '081234567890',
      email:              'budi@example.com',
      address:            'Jl. Mawar No. 5, Jakarta',
      package_name:       'Home 20Mbps',
      status:             'active',
      latitude:           -6.200000,
      longitude:          106.816666,
      ont_sn:             'HWTC12345678',
      ont_mac:            '00:11:22:33:44:55',
      installation_date:  '2024-01-15',
      notes:              'Pelanggan loyal sejak 2020',
    });

    // Contoh row 2 (data minimal — pakai ID custom)
    sheet.addRow({
      customer_id:        'CUST002',
      name:               'Siti Rahmawati',
      phone:              '081298765432',
      status:             'active',
    });

    // Contoh row 3 (ID kosong → akan auto-generate)
    sheet.addRow({
      // customer_id sengaja kosong
      name:               'Ahmad (ID auto)',
      phone:              '081311112222',
      status:             'active',
      notes:              'ID akan dibuat otomatis (CID001, CID002, ...)',
    });

    // Style contoh rows (italic, abu-abu) supaya user tahu itu contoh
    [2, 3, 4].forEach(rowNum => {
      sheet.getRow(rowNum).eachCell(cell => {
        cell.font = { italic: true, color: { argb: 'FF94A3B8' } };
      });
    });

    // Sheet kedua: petunjuk pengisian
    const guideSheet = workbook.addWorksheet('Petunjuk');
    guideSheet.columns = [
      { header: 'Kolom',     width: 22 },
      { header: 'Wajib?',    width: 10 },
      { header: 'Format',    width: 30 },
      { header: 'Contoh',    width: 30 },
      { header: 'Catatan',   width: 50 },
    ];
    guideSheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    });

    const guideRows = [
      ['ID Pelanggan',      'Opsional',   'Teks unik, max 20 char',     'CUST001 (atau kosong)',       'Kalau kosong, sistem akan auto-generate (CID001, CID002, ...). Kalau diisi dan ID sudah ada, akan di-update sesuai mode import.'],
      ['Nama',              'Wajib',      'Teks max 150 char',          'Budi Santoso',                ''],
      ['No. HP',            'Opsional',   'Angka diawali 0/62/+',       '081234567890',                'Akan dinormalisasi ke format 62…'],
      ['Email',             'Opsional',   'Email valid',                'budi@example.com',            ''],
      ['Alamat',            'Opsional',   'Teks bebas',                 'Jl. Mawar No. 5',             ''],
      ['Nama Paket',        'Opsional',   'Harus cocok dengan paket',   'Home 20Mbps',                 'Kalau paket tidak ditemukan, customer tetap di-save tanpa paket.'],
      ['Status',            'Opsional',   'active / inactive / isolated / suspended', 'active',         'Default: active'],
      ['Latitude',          'Opsional',   'Desimal -90 sampai 90',      '-6.200000',                   ''],
      ['Longitude',         'Opsional',   'Desimal -180 sampai 180',    '106.816666',                  ''],
      ['ONT Serial Number', 'Opsional',   'Teks max 50 char',           'HWTC12345678',                ''],
      ['ONT MAC Address',   'Opsional',   'Format MAC',                 '00:11:22:33:44:55',           ''],
      ['Tanggal Instalasi', 'Opsional',   'YYYY-MM-DD',                 '2024-01-15',                  ''],
      ['Catatan',           'Opsional',   'Teks bebas',                 'Pelanggan loyal',             ''],
    ];
    guideRows.forEach(row => guideSheet.addRow(row));

    const filename = 'customers-import-template.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('[CustomerImport] Template download failed:', err);
    res.status(500).json({ success: false, message: 'Gagal generate template: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW — parse upload file, return JSON dengan validasi
// ─────────────────────────────────────────────────────────────────────────────
exports.importPreview = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file diupload' });
    }

    const { Customer, Package } = require('../models');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.worksheets[0]; // sheet pertama

    if (!sheet) {
      return res.status(400).json({ success: false, message: 'File tidak punya sheet data' });
    }

    // Map header → column index
    const headerRow = sheet.getRow(1);
    const headerMap = {};
    headerRow.eachCell((cell, colIndex) => {
      const text = String(cell.value || '').trim().replace(/\s*\*\s*$/, '');
      const col = COLUMNS.find(c => c.header === text);
      if (col) headerMap[col.key] = colIndex;
    });

    // Validasi: minimal kolom Nama harus ada (ID Pelanggan boleh tidak ada → semua auto-generate)
    if (headerMap.name == null) {
      return res.status(400).json({
        success: false,
        message: 'File harus punya kolom "Nama". Download template untuk format yang benar.'
      });
    }

    // Ambil semua existing customer_id untuk deteksi duplicate
    const existingCustomers = await Customer.findAll({
      attributes: ['id', 'customer_id'],
      raw: true,
    });
    const existingMap = new Map(existingCustomers.map(c => [c.customer_id, c.id]));

    // Ambil semua paket untuk lookup nama → id
    const packages = await Package.findAll({
      attributes: ['id', 'name'],
      raw: true,
    });
    const packageMap = new Map(packages.map(p => [p.name.toLowerCase(), p.id]));

    // Parse rows
    const rows = [];
    const seenInFile = new Set();
    let rowIndex = 2; // mulai baris ke-2 (skip header)

    while (rowIndex <= sheet.rowCount) {
      const row = sheet.getRow(rowIndex);
      const rowData = {};
      let hasData = false;

      COLUMNS.forEach(col => {
        const colIdx = headerMap[col.key];
        if (colIdx == null) return;
        let val = row.getCell(colIdx).value;
        // Handle hyperlink object dari Excel
        if (val && typeof val === 'object' && 'text' in val) val = val.text;
        if (val && typeof val === 'object' && 'result' in val) val = val.result;
        if (val !== null && val !== undefined && val !== '') hasData = true;
        rowData[col.key] = val;
      });

      // Skip baris kosong
      if (!hasData) {
        rowIndex++;
        continue;
      }

      const errors = [];
      const warnings = [];

      // Validasi required
      const customerId = String(rowData.customer_id || '').trim();
      const name = String(rowData.name || '').trim();
      if (!name) errors.push('Nama wajib diisi');

      // Customer ID: kalau kosong, akan di-auto-generate saat confirm.
      // Tidak dianggap error.
      const willAutoGenerate = !customerId;

      // Validasi customer_id length (kalau diisi)
      if (customerId.length > 20) errors.push('ID Pelanggan max 20 karakter');

      // Cek duplicate dalam file (hanya kalau ada ID)
      if (customerId && seenInFile.has(customerId)) {
        errors.push(`ID "${customerId}" duplikat dalam file ini`);
      } else if (customerId) {
        seenInFile.add(customerId);
      }

      // Cek apakah sudah ada di database (akan jadi update)
      // Kalau auto-generate, pasti create (ID baru tidak mungkin ada)
      const existsId = customerId ? existingMap.get(customerId) : null;
      let action;
      if (willAutoGenerate) action = 'create_auto';  // create dengan ID auto-generate
      else if (existsId)    action = 'update';
      else                  action = 'create';

      // Validasi email format
      const email = String(rowData.email || '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Email "${email}" tidak valid`);
      }

      // Validasi status
      let status = String(rowData.status || 'active').trim().toLowerCase();
      if (status && !VALID_STATUS.includes(status)) {
        warnings.push(`Status "${status}" tidak dikenal, akan di-set ke "active"`);
        status = 'active';
      }

      // Lookup package
      let packageId = null;
      const packageName = String(rowData.package_name || '').trim();
      if (packageName) {
        packageId = packageMap.get(packageName.toLowerCase()) || null;
        if (!packageId) {
          warnings.push(`Paket "${packageName}" tidak ditemukan, customer akan di-save tanpa paket`);
        }
      }

      // Validasi latitude/longitude
      let latitude = null, longitude = null;
      if (rowData.latitude != null && rowData.latitude !== '') {
        latitude = parseFloat(rowData.latitude);
        if (isNaN(latitude) || latitude < -90 || latitude > 90) {
          errors.push('Latitude harus angka -90 sampai 90');
          latitude = null;
        }
      }
      if (rowData.longitude != null && rowData.longitude !== '') {
        longitude = parseFloat(rowData.longitude);
        if (isNaN(longitude) || longitude < -180 || longitude > 180) {
          errors.push('Longitude harus angka -180 sampai 180');
          longitude = null;
        }
      }

      // Normalisasi phone
      let phone = String(rowData.phone || '').trim().replace(/[^\d+]/g, '');
      if (phone.startsWith('+62')) phone = '62' + phone.slice(3);
      else if (phone.startsWith('0')) phone = '62' + phone.slice(1);

      // Format installation_date
      let instDate = null;
      if (rowData.installation_date) {
        const d = rowData.installation_date instanceof Date
          ? rowData.installation_date
          : new Date(rowData.installation_date);
        if (!isNaN(d.getTime())) {
          instDate = d.toISOString().slice(0, 10);
        } else {
          warnings.push('Tanggal instalasi tidak valid, akan dikosongkan');
        }
      }

      rows.push({
        rowNumber: rowIndex,
        action, // 'create' atau 'update'
        valid: errors.length === 0,
        errors,
        warnings,
        data: {
          customer_id: customerId,
          name,
          phone: phone || null,
          email: email || null,
          address: String(rowData.address || '').trim() || null,
          package_id: packageId,
          package_name: packageName || null, // hanya untuk display preview
          status,
          latitude,
          longitude,
          ont_sn: String(rowData.ont_sn || '').trim() || null,
          ont_mac: String(rowData.ont_mac || '').trim() || null,
          installation_date: instDate,
          notes: String(rowData.notes || '').trim() || null,
        }
      });

      rowIndex++;
    }

    // Cleanup uploaded file
    try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }

    // Hitung summary
    const summary = {
      total:        rows.length,
      valid:        rows.filter(r => r.valid).length,
      invalid:      rows.filter(r => !r.valid).length,
      toCreate:     rows.filter(r => r.valid && (r.action === 'create' || r.action === 'create_auto')).length,
      toCreateAuto: rows.filter(r => r.valid && r.action === 'create_auto').length,
      toUpdate:     rows.filter(r => r.valid && r.action === 'update').length,
    };

    // Generate import token (uuid singkat) — disimpan di session/cache untuk konfirmasi
    // Sederhana: simpan rows di global memory dengan TTL 5 menit
    const importToken = Math.random().toString(36).slice(2, 14);
    pendingImports.set(importToken, {
      rows,
      userId: req.user?.id,
      createdAt: Date.now(),
    });
    cleanExpiredImports();

    return res.json({
      success: true,
      summary,
      rows,
      importToken,
    });
  } catch (err) {
    logger.error('[CustomerImport] Preview failed:', err);
    // Cleanup uploaded file kalau ada
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
    }
    return res.status(500).json({ success: false, message: 'Gagal parse file: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM — eksekusi import setelah preview disetujui
// ─────────────────────────────────────────────────────────────────────────────
exports.importConfirm = async (req, res) => {
  try {
    const { importToken, mode = 'skip_duplicate' } = req.body;
    if (!importToken) {
      return res.status(400).json({ success: false, message: 'importToken tidak ada' });
    }

    const pending = pendingImports.get(importToken);
    if (!pending) {
      return res.status(404).json({
        success: false,
        message: 'Sesi import tidak ditemukan atau sudah expired. Silakan upload ulang file.'
      });
    }

    // Cek ownership
    if (req.user?.id && pending.userId && pending.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Sesi import bukan milik Anda' });
    }

    const { Customer, sequelize } = require('../models');
    const { generateUniqueCustomerId } = require('../utils/helpers');
    const validRows = pending.rows.filter(r => r.valid);

    let created = 0, updated = 0, skipped = 0, failed = 0;
    let createdAuto = 0;
    const errors = [];
    const generatedIds = []; // simpan ID auto-generate untuk return ke frontend

    // Loop dengan transaction per row supaya satu error tidak rollback semuanya
    for (const row of validRows) {
      try {
        const data = { ...row.data };
        delete data.package_name; // hanya display field, bukan kolom DB

        if (row.action === 'create_auto') {
          // Generate ID baru sebelum insert
          const newId = await generateUniqueCustomerId(Customer, 'CID');
          data.customer_id = newId;
          await Customer.create(data);
          created++;
          createdAuto++;
          generatedIds.push({ rowNumber: row.rowNumber, customer_id: newId, name: data.name });
        } else if (row.action === 'create') {
          await Customer.create(data);
          created++;
        } else if (row.action === 'update') {
          if (mode === 'skip_duplicate') {
            skipped++;
            continue;
          }
          await Customer.update(data, { where: { customer_id: data.customer_id } });
          updated++;
        }
      } catch (e) {
        failed++;
        errors.push({
          customer_id: row.data.customer_id || '(auto)',
          message: e.message,
        });
      }
    }

    // Hapus pending import
    pendingImports.delete(importToken);

    return res.json({
      success: true,
      summary: { created, createdAuto, updated, skipped, failed },
      generatedIds: generatedIds.slice(0, 100), // ID auto-generate untuk display
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    logger.error('[CustomerImport] Confirm failed:', err);
    return res.status(500).json({ success: false, message: 'Gagal import: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory store untuk pending import (TTL 5 menit)
// ─────────────────────────────────────────────────────────────────────────────
const pendingImports = new Map();
const PENDING_TTL_MS = 5 * 60 * 1000;

function cleanExpiredImports() {
  const now = Date.now();
  for (const [token, data] of pendingImports.entries()) {
    if (now - data.createdAt > PENDING_TTL_MS) {
      pendingImports.delete(token);
    }
  }
}

// Cleanup setiap 5 menit
setInterval(cleanExpiredImports, PENDING_TTL_MS);
