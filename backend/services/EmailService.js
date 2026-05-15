const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  init() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      logger.info('Email service initialized');
    } else {
      logger.warn('Email service not configured (SMTP settings missing)');
    }
  }

  async send({ to, subject, html, text }) {
    if (!this.transporter) {
      logger.warn('Email not sent - SMTP not configured');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'ISP NetOps <noreply@ispnetops.com>',
        to,
        subject,
        html,
        text
      });
      logger.info(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      logger.error('Email send error:', error);
      return false;
    }
  }

  async sendDeviceDownAlert(device, recipients) {
    return this.send({
      to: recipients.join(','),
      subject: `[ALERT] Device Down: ${device.name}`,
      html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h2 style="color:#ef4444;">⚠️ Device Down Alert</h2>
          <table style="border-collapse:collapse;width:100%;max-width:500px;">
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Device</td><td style="padding:8px;border:1px solid #ddd;">${device.name}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">IP Address</td><td style="padding:8px;border:1px solid #ddd;">${device.ip_address}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Type</td><td style="padding:8px;border:1px solid #ddd;">${device.type}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Time</td><td style="padding:8px;border:1px solid #ddd;">${new Date().toLocaleString('id-ID')}</td></tr>
          </table>
          <p style="color:#666;margin-top:20px;">— ISP NetOps Monitoring System</p>
        </div>
      `
    });
  }

  async sendInvoiceOverdueAlert(customer, invoice) {
    if (!customer.email) return false;
    return this.send({
      to: customer.email,
      subject: `Invoice Overdue: ${invoice.invoice_number}`,
      html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h2>Invoice Reminder</h2>
          <p>Dear ${customer.name},</p>
          <p>Your invoice <strong>${invoice.invoice_number}</strong> is overdue.</p>
          <table style="border-collapse:collapse;width:100%;max-width:400px;">
            <tr><td style="padding:8px;border:1px solid #ddd;">Amount</td><td style="padding:8px;border:1px solid #ddd;">Rp ${parseFloat(invoice.total).toLocaleString('id-ID')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;">Due Date</td><td style="padding:8px;border:1px solid #ddd;">${invoice.due_date}</td></tr>
          </table>
          <p>Please make your payment as soon as possible to avoid service interruption.</p>
          <p>— ISP NetOps</p>
        </div>
      `
    });
  }
}

module.exports = new EmailService();
