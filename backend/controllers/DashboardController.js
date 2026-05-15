const { Device, Customer, Invoice, OntDevice, Payment, TrafficData, Ticket, QueueHistory, sequelize } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const { getMikrotikInstance, getMikrotikInstanceByDevice } = require('../services/MikrotikService');

class DashboardController {
  async overview(req, res) {
    try {
      // Ambil device terpilih dari query (?device_id=) atau auto-pick primary/first
      const deviceId = req.query.device_id ? parseInt(req.query.device_id) : null;

      // ── PPPoE aktif dari MikroTik REST API ──────────────────
      let pppoeActive = 0;
      let totalBandwidthMbps = 0;
      try {
        const mt = await getMikrotikInstanceByDevice(deviceId);
        const sessions = await mt.getPPPoESessions();
        pppoeActive = sessions.length;

        // Bandwidth total dari queue stats MikroTik
        const queues = await mt.getQueueStats();
        queues.forEach(q => {
          totalBandwidthMbps += parseFloat(q.rateIn || 0) / 1_000_000;
        });
      } catch (mtErr) {
        // Fallback ke DB jika MikroTik tidak bisa diakses
        pppoeActive = await Customer.count({ where: { status: 'active' } });
        const bwResult = await sequelize.query(
          `SELECT COALESCE(SUM(p.speed_down), 0) as total_download
           FROM customers c JOIN packages p ON c.package_id = p.id
           WHERE c.status = 'active'`,
          { type: sequelize.QueryTypes.SELECT }
        );
        totalBandwidthMbps = (bwResult[0]?.total_download || 0) / 1000;
      }

      // ── ONT stats — dari GenieACS langsung ──────────────────
      let ontOnline = 0, ontOffline = 0;
      try {
        const { AppSetting } = require('../models');
        const row = await AppSetting.findOne({ where: { key: 'genieacs_nbi_url' } });
        const genieUrl = row?.value || process.env.GENIEACS_NBI_URL || '';
        if (genieUrl) {
          const axios = require('axios');
          const resp  = await axios.get(`${genieUrl}/devices`, { timeout: 5000 });
          const devices = Array.isArray(resp.data) ? resp.data : [];
          const now = Date.now();
          devices.forEach(d => {
            const lastInform = d._lastInform;
            if (lastInform) {
              const minutesAgo = (now - new Date(lastInform).getTime()) / 60000;
              if (minutesAgo < 5) ontOnline++; else ontOffline++;
            } else {
              ontOffline++;
            }
          });
        } else {
          // Fallback ke DB jika GenieACS belum dikonfigurasi
          ontOnline  = await OntDevice.count({ where: { status: 'online' } });
          ontOffline = await OntDevice.count({ where: { status: 'offline' } });
        }
      } catch (genieErr) {
        // Fallback ke DB
        ontOnline  = await OntDevice.count({ where: { status: 'online' } });
        ontOffline = await OntDevice.count({ where: { status: 'offline' } });
      }

      // ── CPU Load — dari MikroTik /system/resource ────────────
      let cpuLoad = 0;
      let cpuDeviceName = 'Router';
      try {
        const mt  = await getMikrotikInstanceByDevice(deviceId);
        const res2 = await mt.getSystemResource();
        cpuLoad = res2?.cpuLoad ?? 0;
        try {
          const ident = await mt.getSystemIdentity();
          cpuDeviceName = ident?.name || 'Router';
        } catch (_) { /* identity optional */ }
      } catch (cpuErr) {
        // Fallback ke rata-rata CPU device di DB
        const avgCpuFallback = await Device.findOne({
          attributes: [[sequelize.fn('AVG', sequelize.col('cpu_load')), 'avg_cpu']],
          where: { status: 'online', is_active: true },
          raw: true
        });
        cpuLoad = Math.round((avgCpuFallback?.avg_cpu || 0) * 100) / 100;
      }

      // ── Device stats ─────────────────────────────────────────
      const devicesOnline  = await Device.count({ where: { status: 'online',  is_active: true } });
      const devicesOffline = await Device.count({ where: { status: 'offline', is_active: true } });
      const devicesTotal   = await Device.count({ where: { is_active: true } });

      // ── Billing stats ────────────────────────────────────────
      const currentMonth = moment().month() + 1;
      const unpaidInvoices   = await Invoice.count({ where: { status: 'unpaid' } });
      const overdueInvoices  = await Invoice.count({ where: { status: 'overdue' } });
      const revenueThisMonth = await Payment.sum('amount', {
        where: sequelize.where(sequelize.fn('MONTH', sequelize.col('payment_date')), currentMonth)
      }) || 0;

      // ── Customer stats ───────────────────────────────────────
      const totalCustomers    = await Customer.count();
      const activeCustomers   = await Customer.count({ where: { status: 'active' } });
      const isolatedCustomers = await Customer.count({ where: { status: 'isolated' } });

      // ── Interface traffic dari MikroTik ──────────────────────
      let interfaceTraffic = [];
      try {
        const mt = await getMikrotikInstanceByDevice(deviceId);
        const ifaces = await mt.getInterfaces();
        // Ambil top 5 interface yang running saja
        const running = ifaces.filter(i => i.running && !i.disabled).slice(0, 5);
        const statsPromises = running.map(iface =>
          mt.getInterfaceStats(iface.name).catch(() => ({
            name: iface.name,
            rxBitsPerSecond: 0,
            txBitsPerSecond: 0
          }))
        );
        const stats = await Promise.all(statsPromises);
        interfaceTraffic = stats.map(s => ({
          name: s.name,
          rxRate: s.rxBitsPerSecond,
          txRate: s.txBitsPerSecond,
          rxMbps: (s.rxBitsPerSecond / 1_000_000).toFixed(2),
          txMbps: (s.txBitsPerSecond / 1_000_000).toFixed(2),
          status: 'online'
        }));

        // Hitung total bandwidth dari interface utama jika queue kosong
        if (totalBandwidthMbps === 0) {
          totalBandwidthMbps = interfaceTraffic.reduce((sum, i) => sum + parseFloat(i.rxMbps), 0);
        }
      } catch (e) { /* MikroTik tidak tersedia */ }

      res.json({
        success: true,
        data: {
          pppoe:     { active: pppoeActive },
          bandwidth: { total_download: Math.round(totalBandwidthMbps * 1000), mbps: totalBandwidthMbps.toFixed(1) },
          ont:       { online: ontOnline, offline: ontOffline },
          devices:   { online: devicesOnline, offline: devicesOffline, total: devicesTotal },
          cpu:       { average: cpuLoad, deviceName: cpuDeviceName },
          billing:   { unpaid: unpaidInvoices, overdue: overdueInvoices, revenueThisMonth },
          customers: { total: totalCustomers, active: activeCustomers, isolated: isolatedCustomers },
          interfaces: interfaceTraffic
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ─── TOP CUSTOMERS BY BANDWIDTH USAGE ────────────────────────
  async topCustomersBandwidth(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const period = req.query.period || '24h'; // '24h', '7d', '30d'
      
      let startDate;
      switch (period) {
        case '7d':
          startDate = moment().subtract(7, 'days').toDate();
          break;
        case '30d':
          startDate = moment().subtract(30, 'days').toDate();
          break;
        default: // 24h
          startDate = moment().subtract(24, 'hours').toDate();
      }

      let topCustomers = [];

      // ─── METHOD 1: Try to get from MikroTik Simple Queue directly ───
      try {
        const mt = getMikrotikInstance();
        const queues = await mt.getQueueStats();
        
        if (queues && queues.length > 0) {
          // Get customer data from database
          const customers = await Customer.findAll({
            where: { status: 'active' },
            include: [{
              model: require('../models').Package,
              as: 'package',
              attributes: ['name', 'speed_down', 'speed_up', 'price']
            }],
            attributes: ['id', 'customer_id', 'name', 'pppoe_username']
          });

          // Map MikroTik queue data to customers
          const customerMap = new Map(
            customers.map(c => [c.pppoe_username, c])
          );

          topCustomers = queues
            .filter(q => customerMap.has(q.name))
            .map(q => {
              const customer = customerMap.get(q.name);
              const rxMbps = parseFloat(q.rateIn || 0) / 1000000;
              const txMbps = parseFloat(q.rateOut || 0) / 1000000;
              const totalBytes = (parseFloat(q.bytesIn || 0) + parseFloat(q.bytesOut || 0));
              const totalGB = totalBytes / 1073741824;

              return {
                id: customer.id,
                customer_id: customer.customer_id,
                name: customer.name,
                pppoe_username: customer.pppoe_username,
                package_name: customer.package?.name || '-',
                speed_down: customer.package?.speed_down || 0,
                speed_up: customer.package?.speed_up || 0,
                total_gb: totalGB.toFixed(2),
                avg_download_mbps: rxMbps.toFixed(2),
                avg_upload_mbps: txMbps.toFixed(2),
                peak_download_mbps: rxMbps.toFixed(2),
                usage_percent: customer.package?.speed_down 
                  ? ((rxMbps / customer.package.speed_down) * 100).toFixed(1)
                  : 0
              };
            })
            .sort((a, b) => parseFloat(b.total_gb) - parseFloat(a.total_gb))
            .slice(0, limit);
        }
      } catch (mtErr) {
        console.log('[TopCustomers] MikroTik not available, fallback to database');
      }

      // ─── METHOD 2: Fallback to queue_history if MikroTik fails ───
      if (topCustomers.length === 0) {
        topCustomers = await sequelize.query(`
          SELECT 
            c.id,
            c.customer_id,
            c.name,
            c.pppoe_username,
            p.name as package_name,
            p.speed_down,
            p.speed_up,
            COALESCE(SUM(qh.rx_bytes + qh.tx_bytes) / 1073741824, 0) as total_gb,
            COALESCE(AVG(qh.rx_rate) / 1000000, 0) as avg_download_mbps,
            COALESCE(AVG(qh.tx_rate) / 1000000, 0) as avg_upload_mbps,
            COALESCE(MAX(qh.rx_rate) / 1000000, 0) as peak_download_mbps
          FROM customers c
          LEFT JOIN packages p ON c.package_id = p.id
          LEFT JOIN queue_history qh ON c.pppoe_username = qh.queue_name 
            AND qh.recorded_at >= ?
          WHERE c.status = 'active'
          GROUP BY c.id, c.customer_id, c.name, c.pppoe_username, p.name, p.speed_down, p.speed_up
          HAVING total_gb > 0
          ORDER BY total_gb DESC
          LIMIT ?
        `, {
          replacements: [startDate, limit],
          type: sequelize.QueryTypes.SELECT
        });

        topCustomers = topCustomers.map(c => ({
          ...c,
          total_gb: parseFloat(c.total_gb).toFixed(2),
          avg_download_mbps: parseFloat(c.avg_download_mbps).toFixed(2),
          avg_upload_mbps: parseFloat(c.avg_upload_mbps).toFixed(2),
          peak_download_mbps: parseFloat(c.peak_download_mbps).toFixed(2),
          usage_percent: c.speed_down ? ((c.avg_download_mbps / c.speed_down) * 100).toFixed(1) : 0
        }));
      }

      res.json({
        success: true,
        data: topCustomers,
        period,
        source: topCustomers.length > 0 && topCustomers[0].total_gb > 0 ? 'mikrotik' : 'database'
      });
    } catch (error) {
      console.error('Error fetching top customers:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ─── NETWORK UPTIME STATISTICS ───────────────────────────────
  async networkUptime(req, res) {
    try {
      const period = req.query.period || '7d'; // '7d', '30d'
      
      let startDate;
      switch (period) {
        case '30d':
          startDate = moment().subtract(30, 'days').toDate();
          break;
        default: // 7d
          startDate = moment().subtract(7, 'days').toDate();
      }

      // Ambil data uptime dari device logs
      const devices = await Device.findAll({
        where: { is_active: true },
        attributes: ['id', 'name', 'ip_address', 'type', 'status']
      });

      const uptimeStats = await Promise.all(devices.map(async (device) => {
        // Hitung uptime dari device logs
        const logs = await sequelize.query(`
          SELECT 
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_checks,
            MIN(created_at) as first_check,
            MAX(created_at) as last_check
          FROM device_logs
          WHERE device_id = ? AND created_at >= ?
        `, {
          replacements: [device.id, startDate],
          type: sequelize.QueryTypes.SELECT
        });

        const log = logs[0];
        const uptime_percent = log.total_checks > 0 
          ? ((log.online_checks / log.total_checks) * 100).toFixed(2)
          : 0;

        // Hitung downtime incidents
        const downtime = await sequelize.query(`
          SELECT COUNT(*) as incidents
          FROM device_logs
          WHERE device_id = ? 
            AND status = 'offline'
            AND created_at >= ?
        `, {
          replacements: [device.id, startDate],
          type: sequelize.QueryTypes.SELECT
        });

        return {
          device_id: device.id,
          device_name: device.name,
          device_ip: device.ip_address,
          device_type: device.type,
          current_status: device.status,
          uptime_percent: parseFloat(uptime_percent),
          total_checks: log.total_checks,
          downtime_incidents: downtime[0].incidents,
          period_days: moment().diff(moment(startDate), 'days')
        };
      }));

      // Summary statistics
      const totalDevices = uptimeStats.length;
      const avgUptime = totalDevices > 0
        ? (uptimeStats.reduce((sum, d) => sum + parseFloat(d.uptime_percent), 0) / totalDevices).toFixed(2)
        : 0;
      const criticalDevices = uptimeStats.filter(d => parseFloat(d.uptime_percent) < 95).length;

      res.json({
        success: true,
        data: {
          summary: {
            total_devices: totalDevices,
            average_uptime: parseFloat(avgUptime),
            critical_devices: criticalDevices,
            period
          },
          devices: uptimeStats.sort((a, b) => a.uptime_percent - b.uptime_percent)
        }
      });
    } catch (error) {
      console.error('Error fetching network uptime:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ─── TICKET/SUPPORT STATISTICS ───────────────────────────────
  async ticketStats(req, res) {
    try {
      const period = req.query.period || '30d'; // '7d', '30d', '90d'
      
      let startDate;
      switch (period) {
        case '7d':
          startDate = moment().subtract(7, 'days').toDate();
          break;
        case '90d':
          startDate = moment().subtract(90, 'days').toDate();
          break;
        default: // 30d
          startDate = moment().subtract(30, 'days').toDate();
      }

      // Overall ticket statistics
      const stats = await Ticket.findAll({
        where: {
          createdAt: { [Op.gte]: startDate }
        },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          'status',
          'priority',
          'type'
        ],
        group: ['status', 'priority', 'type'],
        raw: true
      });

      // Calculate metrics
      const totalTickets = await Ticket.count({
        where: { createdAt: { [Op.gte]: startDate } }
      });

      const resolvedTickets = await Ticket.count({
        where: {
          createdAt: { [Op.gte]: startDate },
          status: { [Op.in]: ['resolved', 'closed'] }
        }
      });

      const openTickets = await Ticket.count({
        where: {
          status: { [Op.in]: ['open', 'in_progress', 'pending'] }
        }
      });

      // Average resolution time
      const resolvedWithTime = await Ticket.findAll({
        where: {
          createdAt: { [Op.gte]: startDate },
          status: { [Op.in]: ['resolved', 'closed'] },
          resolved_at: { [Op.ne]: null }
        },
        attributes: ['createdAt', 'resolved_at'],
        raw: true
      });

      let avgResolutionHours = 0;
      if (resolvedWithTime.length > 0) {
        const totalHours = resolvedWithTime.reduce((sum, ticket) => {
          const hours = moment(ticket.resolved_at).diff(moment(ticket.createdAt), 'hours');
          return sum + hours;
        }, 0);
        avgResolutionHours = (totalHours / resolvedWithTime.length).toFixed(1);
      }

      // Tickets by type
      const byType = await Ticket.findAll({
        where: { createdAt: { [Op.gte]: startDate } },
        attributes: [
          'type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['type'],
        raw: true
      });

      // Tickets by priority
      const byPriority = await Ticket.findAll({
        where: { createdAt: { [Op.gte]: startDate } },
        attributes: [
          'priority',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['priority'],
        raw: true
      });

      // Recent critical tickets
      const criticalTickets = await Ticket.findAll({
        where: {
          priority: 'critical',
          status: { [Op.notIn]: ['closed'] }
        },
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [{
          model: Customer,
          as: 'customer',
          attributes: ['name', 'customer_id', 'phone']
        }]
      });

      res.json({
        success: true,
        data: {
          summary: {
            total_tickets: totalTickets,
            open_tickets: openTickets,
            resolved_tickets: resolvedTickets,
            resolution_rate: totalTickets > 0 ? ((resolvedTickets / totalTickets) * 100).toFixed(1) : 0,
            avg_resolution_hours: parseFloat(avgResolutionHours)
          },
          by_type: byType,
          by_priority: byPriority,
          critical_tickets: criticalTickets,
          period
        }
      });
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ─── BANDWIDTH USAGE TRENDS ──────────────────────────────────
  async bandwidthTrends(req, res) {
    try {
      const period = req.query.period || 'daily'; // 'realtime' | 'daily' | 'weekly'

      // ── MODE: Realtime (1 jam terakhir, per menit) ──
      if (period === 'realtime') {
        const startDate = moment().subtract(1, 'hour').toDate();

        const rows = await sequelize.query(`
          SELECT
            DATE_FORMAT(recorded_at, '%Y-%m-%d %H:%i:00') AS bucket,
            AVG(rx_rate) / 1000000 AS avg_download_mbps,
            AVG(tx_rate) / 1000000 AS avg_upload_mbps,
            MAX(rx_rate) / 1000000 AS peak_download_mbps,
            MAX(tx_rate) / 1000000 AS peak_upload_mbps,
            SUM(rx_bytes + tx_bytes) / 1073741824 AS total_gb
          FROM traffic_data
          WHERE recorded_at >= ?
          GROUP BY bucket
          ORDER BY bucket DESC
        `, {
          replacements: [startDate],
          type: sequelize.QueryTypes.SELECT
        });

        const groupedData = rows.map(r => ({
          date: r.bucket.substring(0, 10),
          hour: parseInt(r.bucket.substring(11, 13)),
          minute: parseInt(r.bucket.substring(14, 16)),
          avg_download_mbps: parseFloat(r.avg_download_mbps || 0).toFixed(2),
          avg_upload_mbps: parseFloat(r.avg_upload_mbps || 0).toFixed(2),
          peak_download_mbps: parseFloat(r.peak_download_mbps || 0).toFixed(2),
          peak_upload_mbps: parseFloat(r.peak_upload_mbps || 0).toFixed(2),
          total_gb: parseFloat(r.total_gb || 0).toFixed(2)
        }));

        return res.json({ success: true, data: groupedData, period });
      }

      // ── MODE: Daily / Weekly ──
      const days = period === 'weekly' ? 7 : 30;
      
      const startDate = moment().subtract(days, 'days').startOf('day').toDate();

      // Query untuk trend bandwidth
      const trends = await sequelize.query(`
        SELECT 
          DATE(recorded_at) as date,
          HOUR(recorded_at) as hour,
          AVG(rx_rate) / 1000000 as avg_download_mbps,
          AVG(tx_rate) / 1000000 as avg_upload_mbps,
          MAX(rx_rate) / 1000000 as peak_download_mbps,
          MAX(tx_rate) / 1000000 as peak_upload_mbps,
          SUM(rx_bytes + tx_bytes) / 1073741824 as total_gb
        FROM traffic_data
        WHERE recorded_at >= ?
        GROUP BY DATE(recorded_at), HOUR(recorded_at)
        ORDER BY date DESC, hour DESC
      `, {
        replacements: [startDate],
        type: sequelize.QueryTypes.SELECT
      });

      // Group by day for weekly view, by hour for daily view
      let groupedData;
      if (period === 'weekly') {
        groupedData = trends.reduce((acc, row) => {
          const existing = acc.find(d => d.date === row.date);
          if (existing) {
            existing.avg_download_mbps += parseFloat(row.avg_download_mbps);
            existing.avg_upload_mbps += parseFloat(row.avg_upload_mbps);
            existing.peak_download_mbps = Math.max(existing.peak_download_mbps, parseFloat(row.peak_download_mbps));
            existing.peak_upload_mbps = Math.max(existing.peak_upload_mbps, parseFloat(row.peak_upload_mbps));
            existing.total_gb += parseFloat(row.total_gb);
            existing.count++;
          } else {
            acc.push({
              date: row.date,
              avg_download_mbps: parseFloat(row.avg_download_mbps),
              avg_upload_mbps: parseFloat(row.avg_upload_mbps),
              peak_download_mbps: parseFloat(row.peak_download_mbps),
              peak_upload_mbps: parseFloat(row.peak_upload_mbps),
              total_gb: parseFloat(row.total_gb),
              count: 1
            });
          }
          return acc;
        }, []);

        // Calculate averages
        groupedData = groupedData.map(d => ({
          ...d,
          avg_download_mbps: (d.avg_download_mbps / d.count).toFixed(2),
          avg_upload_mbps: (d.avg_upload_mbps / d.count).toFixed(2),
          peak_download_mbps: d.peak_download_mbps.toFixed(2),
          peak_upload_mbps: d.peak_upload_mbps.toFixed(2),
          total_gb: d.total_gb.toFixed(2)
        }));
      } else {
        groupedData = trends.map(row => ({
          date: row.date,
          hour: row.hour,
          avg_download_mbps: parseFloat(row.avg_download_mbps).toFixed(2),
          avg_upload_mbps: parseFloat(row.avg_upload_mbps).toFixed(2),
          peak_download_mbps: parseFloat(row.peak_download_mbps).toFixed(2),
          peak_upload_mbps: parseFloat(row.peak_upload_mbps).toFixed(2),
          total_gb: parseFloat(row.total_gb).toFixed(2)
        }));
      }

      res.json({
        success: true,
        data: groupedData,
        period
      });
    } catch (error) {
      console.error('Error fetching bandwidth trends:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ─── CUSTOMER GROWTH CHART ───────────────────────────────────
  async customerGrowth(req, res) {
    try {
      const months = parseInt(req.query.months) || 12;
      const startDate = moment().subtract(months, 'months').startOf('month').toDate();

      // Query untuk mendapatkan customer growth per bulan
      const growth = await sequelize.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          COUNT(*) as new_customers,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_customers,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_customers
        FROM customers
        WHERE created_at >= ?
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month ASC
      `, {
        replacements: [startDate],
        type: sequelize.QueryTypes.SELECT
      });

      // Calculate cumulative totals
      let cumulativeTotal = await Customer.count({
        where: { createdAt: { [Op.lt]: startDate } }
      });

      const growthWithCumulative = growth.map(row => {
        cumulativeTotal += parseInt(row.new_customers);
        return {
          month: row.month,
          new_customers: parseInt(row.new_customers),
          active_customers: parseInt(row.active_customers),
          inactive_customers: parseInt(row.inactive_customers),
          cumulative_total: cumulativeTotal
        };
      });

      // Current month stats
      const currentMonthNew = await Customer.count({
        where: {
          createdAt: {
            [Op.gte]: moment().startOf('month').toDate()
          }
        }
      });

      const totalActive = await Customer.count({ where: { status: 'active' } });
      const totalInactive = await Customer.count({ where: { status: 'inactive' } });
      const totalCustomers = await Customer.count();

      // Calculate growth rate
      const lastMonth = growthWithCumulative[growthWithCumulative.length - 2];
      const currentMonth = growthWithCumulative[growthWithCumulative.length - 1];
      const growthRate = lastMonth 
        ? (((currentMonth.cumulative_total - lastMonth.cumulative_total) / lastMonth.cumulative_total) * 100).toFixed(1)
        : 0;

      res.json({
        success: true,
        data: {
          summary: {
            total_customers: totalCustomers,
            active_customers: totalActive,
            inactive_customers: totalInactive,
            current_month_new: currentMonthNew,
            growth_rate: parseFloat(growthRate)
          },
          monthly_data: growthWithCumulative
        }
      });
    } catch (error) {
      console.error('Error fetching customer growth:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ─── REVENUE FORECAST ────────────────────────────────────────
  async revenueForecast(req, res) {
    try {
      const months = parseInt(req.query.months) || 6;
      const startDate = moment().subtract(months, 'months').startOf('month').toDate();

      // Query untuk mendapatkan revenue historical
      const historical = await sequelize.query(`
        SELECT 
          DATE_FORMAT(payment_date, '%Y-%m') as month,
          SUM(amount) as total_revenue,
          COUNT(*) as payment_count,
          AVG(amount) as avg_payment
        FROM payments
        WHERE payment_date >= ?
        GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
        ORDER BY month ASC
      `, {
        replacements: [startDate],
        type: sequelize.QueryTypes.SELECT
      });

      // Calculate forecast using simple linear regression
      const forecastMonths = 3; // Forecast untuk 3 bulan ke depan
      const revenueData = historical.map(h => parseFloat(h.total_revenue));
      
      // Simple moving average untuk forecast
      let forecast = [];
      if (revenueData.length >= 3) {
        const avgGrowth = revenueData.slice(-3).reduce((sum, val, idx, arr) => {
          if (idx === 0) return 0;
          return sum + ((val - arr[idx - 1]) / arr[idx - 1]);
        }, 0) / 2;

        let lastRevenue = revenueData[revenueData.length - 1];
        for (let i = 1; i <= forecastMonths; i++) {
          const forecastMonth = moment().add(i, 'months').format('YYYY-MM');
          const forecastRevenue = lastRevenue * (1 + avgGrowth);
          forecast.push({
            month: forecastMonth,
            forecasted_revenue: Math.round(forecastRevenue),
            is_forecast: true
          });
          lastRevenue = forecastRevenue;
        }
      }

      // Current month projection
      const currentMonthRevenue = await Payment.sum('amount', {
        where: {
          payment_date: {
            [Op.gte]: moment().startOf('month').toDate()
          }
        }
      }) || 0;

      // Expected monthly revenue from active customers
      const expectedRevenue = await sequelize.query(`
        SELECT SUM(p.price) as expected
        FROM customers c
        JOIN packages p ON c.package_id = p.id
        WHERE c.status = 'active'
      `, {
        type: sequelize.QueryTypes.SELECT
      });

      res.json({
        success: true,
        data: {
          summary: {
            current_month_revenue: currentMonthRevenue,
            expected_monthly_revenue: expectedRevenue[0]?.expected || 0,
            projection_accuracy: expectedRevenue[0]?.expected > 0 
              ? ((currentMonthRevenue / expectedRevenue[0].expected) * 100).toFixed(1)
              : 0
          },
          historical: historical.map(h => ({
            month: h.month,
            total_revenue: parseFloat(h.total_revenue),
            payment_count: parseInt(h.payment_count),
            avg_payment: parseFloat(h.avg_payment),
            is_forecast: false
          })),
          forecast: forecast
        }
      });
    } catch (error) {
      console.error('Error fetching revenue forecast:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new DashboardController();