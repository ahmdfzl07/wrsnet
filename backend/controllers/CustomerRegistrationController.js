const db = require("../models");
const CustomerRegistration = db.CustomerRegistration;
const Ticket = db.Ticket;

exports.register = async (req, res) => {
  try {
    const data = req.body;

    const existingNik = await CustomerRegistration.findOne({
      where: { nik: data.nik },
    });

    if (existingNik) {
      return res.status(400).json({
        success: false,
        message: "NIK sudah terdaftar",
      });
    }

    const customer = await CustomerRegistration.create({
      ...data,
      status: "pending",
    });

    const ticket = await Ticket.create({
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
    });

    return res.json({
      success: true,
      message: "Registrasi berhasil, ticket instalasi dibuat",
      data: {
        customer,
        ticket,
      },
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Gagal registrasi",
    });
  }
};
