const axios = require("axios");

const BASE_URL =
  "https://www.emsifa.com/api-wilayah-indonesia/api";


// ================= KABUPATEN =================
exports.getKabupaten = async (req, res) => {

  try {

    const response = await axios.get(
      `${BASE_URL}/regencies/32.json`
    );

    res.json(response.data);

  } catch (err) {

    res.status(500).json({
      success: false,
      message: "Gagal mengambil kabupaten",
      error: err.message,
    });
  }
};


// ================= KECAMATAN =================
exports.getKecamatan = async (req, res) => {

  try {

    const response = await axios.get(
      `${BASE_URL}/districts/${req.params.kabupatenId}.json`
    );

    res.json(response.data);

  } catch (err) {

    res.status(500).json({
      success: false,
      message: "Gagal mengambil kecamatan",
      error: err.message,
    });
  }
};


// ================= KELURAHAN =================
exports.getKelurahan = async (req, res) => {

  try {

    const response = await axios.get(
      `${BASE_URL}/villages/${req.params.kecamatanId}.json`
    );

    res.json(response.data);

  } catch (err) {

    res.status(500).json({
      success: false,
      message: "Gagal mengambil kelurahan",
      error: err.message,
    });
  }
};