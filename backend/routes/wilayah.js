const express = require("express");
const axios = require("axios");

const router = express.Router();

const BASE_URL =
  "https://www.emsifa.com/api-wilayah-indonesia/api";


// PROVINSI
router.get(
  "/provinsi",
  async (req, res) => {

    try {

      const response =
        await axios.get(
          `${BASE_URL}/provinces.json`
        );

      res.json(response.data);

    } catch (err) {

      res.status(500).json({
        message:
          "Gagal mengambil provinsi",
      });
    }
  }
);


// KABUPATEN
router.get(
  "/kabupaten/:provinsiId",
  async (req, res) => {

    try {

      const response =
        await axios.get(
          `${BASE_URL}/regencies/${req.params.provinsiId}.json`
        );

      res.json(response.data);

    } catch (err) {

      res.status(500).json({
        message:
          "Gagal mengambil kabupaten",
      });
    }
  }
);


// KECAMATAN
router.get(
  "/kecamatan/:kabupatenId",
  async (req, res) => {

    try {

      const response =
        await axios.get(
          `${BASE_URL}/districts/${req.params.kabupatenId}.json`
        );

      res.json(response.data);

    } catch (err) {

      res.status(500).json({
        message:
          "Gagal mengambil kecamatan",
      });
    }
  }
);


// KELURAHAN
router.get(
  "/kelurahan/:kecamatanId",
  async (req, res) => {

    try {

      const response =
        await axios.get(
          `${BASE_URL}/villages/${req.params.kecamatanId}.json`
        );

      res.json(response.data);

    } catch (err) {

      res.status(500).json({
        message:
          "Gagal mengambil kelurahan",
      });
    }
  }
);

module.exports = router;