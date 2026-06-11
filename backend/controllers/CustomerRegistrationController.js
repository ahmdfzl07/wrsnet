const db = require("../models");
const CustomerRegistration = db.CustomerRegistration;
const Customer = db.Customer;
const Ticket = db.Ticket;
const WorkOrder = db.WorkOrder;
const {
  generateUniqueCustomerRegisId,
  paginateResponse,
} = require("../utils/helpers");

exports.register = async (req, res) => {
  const t = await db.sequelize.transaction();

  try {
    const data = req.body;

    // ================= CEK NIK =================
    const existingNik = await CustomerRegistration.findOne({
      where: { nik: data.nik },
      transaction: t,
    });

    if (existingNik) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "NIK sudah terdaftar",
      });
    }

    // ================= CREATE CUSTOMER =================
    if (data.customer_id) {
      data.customer_id = data.customer_id.trim().toUpperCase();
      const exists = await Customer.findOne({
        where: { customer_id: data.customer_id },
      });
      if (exists)
        return res.status(400).json({
          success: false,
          message: "ID " + data.customer_id + " sudah digunakan",
        });
    } else {
      data.customer_id = await generateUniqueCustomerRegisId(
        Customer,
        CustomerRegistration,
      );
    }

    const customer = await CustomerRegistration.create(
      {
        ...data,
        status: "pending",
      },
      { transaction: t },
    );

    // ================= CREATE TICKET =================
    const ticket = await Ticket.create(
      {
        type: "request",
        priority: "medium",
        status: "open",

        title: "Instalasi",
        description: "Instalasi server",

        customer_id: customer.id,

        latitude: customer.latitude,
        longitude: customer.longitude,
        location_note: customer.address,
        is_registration: "1",

        sla_hours: 24,
      },
      { transaction: t },
    );

    // ================= CREATE WORK ORDER =================
    // const wo = await WorkOrder.create(
    //   {
    //     type: "installation",
    //     status: "pending",
    //     priority: "medium",

    //     title: "instalasi",
    //     description: "Instalasi server untuk pelanggan baru",

    //     customer_id: customer.id,
    //     ticket_id: ticket.id,
    //     is_registration: true,

    //     location_address: customer.address,
    //     latitude: customer.latitude,
    //     longitude: customer.longitude,

    //     scheduled_date: customer.installation_date || null,
    //   },
    //   { transaction: t },
    // );

    // ================= COMMIT =================
    await t.commit();

    return res.json({
      success: true,
      message: "Registrasi berhasil, ticket sudah otomatis dibuat",
      data: {
        customer,
        ticket,
        // work_order: wo,
      },
    });
  } catch (err) {
    await t.rollback();

    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Gagal registrasi",
    });
  }
};

exports.update = async (req, res) => {
  const t = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const data = req.body;

    const customer = await CustomerRegistration.findByPk(id, {
      transaction: t,
    });

    if (!customer) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Data customer tidak ditemukan",
      });
    }

    if (!data.phone || !data.email) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Phone dan Email wajib diisi",
      });
    }

    if (isNaN(parseFloat(data.latitude)) || isNaN(parseFloat(data.longitude))) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Koordinat tidak valid",
      });
    }

    await CustomerRegistration.update(
      {
        phone: data.phone,
        email: data.email,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
      },
      {
        where: { id },
        transaction: t,
      },
    );

    await Ticket.update(
      {
        latitude: data.latitude,
        longitude: data.longitude,
        location_note: data.address,
      },
      {
        where: {
          customer_id: id,
          is_registration: "1",
        },
        transaction: t,
      },
    );

    await t.commit();

    return res.json({
      success: true,
      message: "Data pelanggan berhasil diupdate",
    });
  } catch (err) {
    await t.rollback();

    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Gagal update data pelanggan",
    });
  }
};
