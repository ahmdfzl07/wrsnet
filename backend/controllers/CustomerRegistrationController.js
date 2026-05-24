const db = require("../models");
const CustomerRegistration = db.CustomerRegistration;

exports.register = async (req, res) => {
  try {
    const data = req.body;

    const result = await CustomerRegistration.create({
      ...data,
      status: "pending",
    });

    return res.json({
      success: true,
      message: "Registrasi berhasil, menunggu approval",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Gagal registrasi",
    });
  }
};
