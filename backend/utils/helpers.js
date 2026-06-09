const moment = require("moment");
const crypto = require("crypto");

// Generate sequential customer ID: CID001, CID002, ...
// const generateCustomerId = (prefix = "CID", number = 1) => {
//   return prefix + String(number).padStart(3, "0");
// };

const generateCustomerId = (number = 1) => {
  const now = new Date();

  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  const datePart = `${y}${m}${d}`;
  const seqPart = String(number).padStart(3, "0");

  return datePart + seqPart;
};

// Generate sequential CID: ambil nomor terakhir dari DB, increment
// const generateUniqueCustomerId = async (CustomerModel, prefix = "CID") => {
//   const { Op } = require("sequelize");
//   // Cari semua customer_id yang format CIDxxx
//   const last = await CustomerModel.findOne({
//     where: { customer_id: { [Op.like]: prefix + "%" } },
//     order: [["customer_id", "DESC"]],
//     attributes: ["customer_id"],
//   });

//   let nextNum = 1;
//   if (last) {
//     // Ekstrak angka dari akhir ID: "CID007" -> 7
//     const match = last.customer_id.replace(prefix, "").match(/^(\d+)/);
//     if (match) nextNum = parseInt(match[1]) + 1;
//   }

//   // Coba sequential sampai dapat yang belum ada
//   for (let i = nextNum; i < nextNum + 100; i++) {
//     const candidate = prefix + String(i).padStart(3, "0");
//     const exists = await CustomerModel.findOne({
//       where: { customer_id: candidate },
//     });
//     if (!exists) return candidate;
//   }

//   // Fallback: pakai timestamp
//   return prefix + Date.now().toString().slice(-6);
// };
const generateUniqueCustomerId = async (CustomerModel) => {
  const { Op } = require("sequelize");

  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  const prefix = `${y}${m}${d}`;

  const lastCustomer = await CustomerModel.findOne({
    where: {
      customer_id: { [Op.like]: prefix + "%" },
    },
    order: [["customer_id", "DESC"]],
    attributes: ["customer_id"],
  });

  const extractNumber = (data) => {
    if (!data) return 0;
    const match = data.customer_id.replace(prefix, "").match(/^(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  const lastNumCustomer = extractNumber(lastCustomer);

  const nextNum = Math.max(lastNumCustomer) + 1;

  const newId = prefix + String(nextNum).padStart(4, "0");

  return newId;
};

const generateUniqueCustomerRegisId = async (
  CustomerModel,
  CustomerRegistrationModel,
) => {
  const { Op } = require("sequelize");

  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  const prefix = `${y}${m}${d}`;

  const lastCustomer = await CustomerModel.findOne({
    where: {
      customer_id: { [Op.like]: prefix + "%" },
    },
    order: [["customer_id", "DESC"]],
    attributes: ["customer_id"],
  });

  const lastRegistration = await CustomerRegistrationModel.findOne({
    where: {
      customer_id: { [Op.like]: prefix + "%" },
    },
    order: [["customer_id", "DESC"]],
    attributes: ["customer_id"],
  });

  const extractNumber = (data) => {
    if (!data) return 0;
    const match = data.customer_id.replace(prefix, "").match(/^(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  const lastNumCustomer = extractNumber(lastCustomer);
  const lastNumRegistration = extractNumber(lastRegistration);

  const nextNum = Math.max(lastNumCustomer, lastNumRegistration) + 1;

  const newId = prefix + String(nextNum).padStart(4, "0");

  return newId;
};

// Generate invoice number
const generateInvoiceNumber = (year, month, sequence) => {
  const y = String(year).slice(-2);
  const m = String(month).padStart(2, "0");
  const seq = String(sequence).padStart(5, "0");
  return `INV-${y}${m}-${seq}`;
};

// Format bytes to human readable
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// Format bits per second
const formatBps = (bps) => {
  if (bps === 0) return "0 bps";
  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  const i = Math.floor(Math.log(bps) / Math.log(1000));
  return (bps / Math.pow(1000, i)).toFixed(1) + " " + units[i];
};

// Format uptime ticks to human readable
const formatUptime = (ticks) => {
  const seconds = Math.floor(ticks / 100);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
};

// Format currency IDR
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

// Pagination helper
const paginate = (query, { page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  return {
    ...query,
    offset,
    limit: parseInt(limit),
  };
};

// Build pagination response
const paginateResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

// Sanitize SNMP response value
const sanitizeSnmpValue = (varbind) => {
  if (!varbind) return null;
  if (Buffer.isBuffer(varbind.value)) {
    return varbind.value.toString("utf8");
  }
  return varbind.value;
};

// pay
function pickGateway(method) {
  const route = {
    // VA
    ATM_BERSAMA: "duitku",
    BCAVA: "tripay",
    BNIVA: "duitku",
    BRIVA: "duitku",
    MANDIRIVA: "duitku",
    CIMBVA: "duitku",
    BSIVA: "duitku",

    // E-WALLET
    DANA: "duitku",
    SHOPEEPAY: "tripay",
    GOPAY: "midtrans",
    OVO: "tripay",
    LINKAJA: "duitku",

    // QRIS
    QRIS: "tripay",

    // RETAIL
    ALFAMART: "duitku",
    INDOMARET: "tripay",
    ALFAMIDI: "tripay",
  };

  return route[method] || "duitku";
}

function normalizeMethod(provider, method) {
  const map = {
    // TRIPAY
    tripay: {
      BCAVA: "BCAVA",
      SHOPEEPAY: "SHOPEEPAY",
      OVO: "OVO",
      INDOMARET: "INDOMARET",
      ALFAMIDI: "ALFAMIDI",
      QRIS: "QRIS",
    },

    // DUITKU
    duitku: {
      ATM_BERSAMA: "VC",
      BRIVA: "BR",
      BNIVA: "I1",
      MANDIRIVA: "M2",
      CIMBVA: "B1",
      BSIVA: "BV",

      DANA: "DA",
      LINKAJA: "LA",

      QRIS: "QR",

      ALFAMART: "FT",
    },

    // MIDTRANS
    midtrans: {
      GOPAY: "gopay",
    },
  };

  return map[provider]?.[method] || method;
}

function calculateFinalAmount(amount, fee) {
  if (!fee) return amount;

  if (typeof fee === "string" && fee.includes("%")) {
    const percent = parseFloat(fee.replace("%", ""));
    return Math.ceil(amount + (amount * percent) / 100);
  }

  return amount + parseInt(fee || 0);
}

module.exports = {
  generateCustomerId,
  generateUniqueCustomerId,
  generateUniqueCustomerRegisId,
  generateInvoiceNumber,
  formatBytes,
  formatBps,
  formatUptime,
  formatCurrency,
  paginate,
  paginateResponse,
  sanitizeSnmpValue,
  pickGateway,
  normalizeMethod,
  calculateFinalAmount,
};
