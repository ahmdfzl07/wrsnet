/**
 * Template Helper - Replace variables in WA templates
 */

/**
 * Replace template variables with actual data
 * @param {string} template - Template string with {variable} placeholders
 * @param {object} data - Data object with variable values
 * @returns {string} - Processed message
 */
function replaceVariables(template, data) {
  if (!template) return '';
  
  let message = template;
  
  // Replace each variable in the format {variable_name}
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    const value = data[key] !== null && data[key] !== undefined ? data[key] : '-';
    message = message.replace(regex, value);
  });
  
  return message;
}

/**
 * Get payment confirmation data for template
 * @param {object} params - Payment data
 * @returns {object} - Template variables
 */
function getPaymentConfirmationData(params) {
  const {
    customerName,
    customerId,
    customerPhone,
    packageName,
    amount,
    amountFormatted,
    paymentDate,
    paymentDateFormatted,
    method,
    methodLabel,
    bank,
    referenceNo,
    dueDate,
    dueDateFormatted,
    invoiceNumber,
    notes
  } = params;
  
  return {
    // Customer info
    nama: customerName || '-',
    name: customerName || '-',
    customer_name: customerName || '-',
    cid: customerId || '-',
    customer_id: customerId || '-',
    phone: customerPhone || '-',
    
    // Package info
    paket: packageName || '-',
    package: packageName || '-',
    package_name: packageName || '-',
    
    // Payment amount
    jumlah: amountFormatted || amount || '-',
    amount: amountFormatted || amount || '-',
    nominal: amountFormatted || amount || '-',
    
    // Payment date
    tgl_bayar: paymentDateFormatted || paymentDate || '-',
    payment_date: paymentDateFormatted || paymentDate || '-',
    tanggal: paymentDateFormatted || paymentDate || '-',
    
    // Payment method
    metode: methodLabel || method || '-',
    method: methodLabel || method || '-',
    payment_method: methodLabel || method || '-',
    bank: bank || '',
    
    // Reference
    ref_no: referenceNo || '',
    reference: referenceNo || '',
    reference_no: referenceNo || '',
    
    // Due date
    jatuh_tempo: dueDateFormatted || dueDate || '-',
    due_date: dueDateFormatted || dueDate || '-',
    aktif_hingga: dueDateFormatted || dueDate || '-',
    expired_date: dueDateFormatted || dueDate || '-',
    
    // Invoice
    invoice: invoiceNumber || '-',
    invoice_number: invoiceNumber || '-',
    invoice_no: invoiceNumber || '-',
    
    // Additional
    catatan: notes || '',
    notes: notes || ''
  };
}

/**
 * Get default payment confirmation template
 * @returns {string} - Default template
 */
function getDefaultPaymentTemplate() {
  return `✅ *Pembayaran Diterima*

Terima kasih *{nama}*, pembayaran Anda telah dicatat.

📦 Paket   : {paket}
💰 Jumlah  : {jumlah}
📅 Tgl Bayar: {tgl_bayar}
💳 Metode  : {metode}

*Aktif hingga: {aktif_hingga}*

_Terima kasih telah menggunakan layanan kami_ 🙏`;
}

module.exports = {
  replaceVariables,
  getPaymentConfirmationData,
  getDefaultPaymentTemplate
};