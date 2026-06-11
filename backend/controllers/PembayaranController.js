const db = require("../models");
const { Op, Sequelize } = require("sequelize");

const Invoice = db.Invoice;
const Customer = db.Customer;
const User = db.User;
/*
=========================================
SIMPAN PEMBAYARAN
=========================================
*/

exports.simpanPembayaran = async (req, res) => {
    try {

        console.log("=========== PEMBAYARAN ===========");
        console.log("REQ USER :", req.user);
        console.log("REQ BODY :", req.body);

        const {
            customer_id,
            amount,
            keterangan,
            period_month,
            period_year
        } = req.body;

        const nominal = Number(amount);

        // Ambil user
        const user = await db.User.findByPk(req.user.id);

        console.log("USER DB :", user ? user.toJSON() : null);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan"
            });
        }

        const saldo = Number(user.balance || 0);

        console.log("SALDO :", saldo);
        console.log("NOMINAL :", nominal);

        if (saldo < nominal) {
            return res.status(400).json({
                success: false,
                message: `Saldo tidak cukup. Saldo=${saldo}, Nominal=${nominal}`
            });
        }

        const invoice = await Invoice.findOne({
            where: {
                customer_id,
                period_month,
                period_year
            },
            order: [["id", "DESC"]]
        });

        console.log("INVOICE :", invoice);

        if (!invoice) {
            return res.status(400).json({
                success: false,
                message: "Invoice tidak ditemukan"
            });
        }

        await invoice.update({
            amount: nominal,
            total: nominal,
            status: "paid",
            paid_date: new Date(),
            notes: keterangan,
            pdf_path: req.file ? req.file.filename : null,
            agen_id: req.user.id
        });

        await Customer.update(
            {
                status: "active",
                isolir_status: "active"
            },
            {
                where: {
                    id: customer_id
                }
            }
        );

        // Kurangi saldo
        user.balance = saldo - nominal;
        await user.save();

        return res.json({
            success: true,
            message: "Pembayaran berhasil",
            data: {
                saldo_awal: saldo,
                nominal,
                saldo_akhir: user.balance
            }
        });

    } catch (err) {

        console.error("ERROR :", err);
        console.error(err.stack);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};


/*
=========================================
TOTAL TRANSAKSI BULAN INI
=========================================
*/

exports.totalTransaksi = async (req, res) => {

    try {

        const bulan = new Date().getMonth() + 1;
        const tahun = new Date().getFullYear();

        const total = await Invoice.sum("total", {

            where: {
                status: "paid",
                period_month: bulan,
                period_year: tahun,
                agen_id: req.user.id
            }

        });

        res.json({
            success: true,
            total: Number(total || 0)
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


/*
=========================================
LAPORAN PEMBAYARAN
=========================================
*/

exports.laporanPembayaran = async (req, res) => {

    try {

        const data = await Invoice.findAll({

            where: {
                status: "paid",
                agen_id: req.user.id
            },

            include: [
                {
                    model: Customer,
                    as: "customer"
                }
            ],

            order: [["createdAt", "DESC"]]

        });

        return res.json({
            success: true,
            data
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


/*
=========================================
TOTAL DASHBOARD
=========================================
*/

exports.dashboardTotal = async (req, res) => {

    try {

        const total = await Invoice.sum("total", {

            where: {
                status: "paid",
                agen_id: req.user.id
            }

        });

        res.json({
            success: true,
            total: Number(total || 0)
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


/*
=========================================
DASHBOARD
=========================================
*/

exports.dashboard = async (req, res) => {

    try {

        const today = new Date();

        const start = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );

        const end = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 1
        );

        const todayIncome = await db.Invoice.sum("total", {

            where: {

                status: "paid",
                agen_id: req.user.id,

                createdAt: {
                    [Op.gte]: start,
                    [Op.lt]: end
                }

            }

        });

        const totalTrx = await db.Invoice.count({

            where: {

                status: "paid",
                agen_id: req.user.id

            }

        });

        res.render("dashboard-agen", {

            title: "Dashboard",

            user: req.user,

            todayIncome: todayIncome || 0,

            totalTrx: totalTrx || 0

        });

    } catch (err) {

        console.log(err);

        res.status(500).send(err.message);

    }

};


/*
=========================================
DASHBOARD STAT
=========================================
*/

exports.dashboardStat = async (req, res) => {

    try {

        const totalIncome = await Invoice.sum("total", {

            where: {
                status: "paid",
                agen_id: req.user.id
            }

        });

        const totalTrx = await Invoice.count({

            where: {
                status: "paid",
                agen_id: req.user.id
            }

        });

        res.json({
            success: true,
            todayIncome: Number(totalIncome || 0),
            totalTrx
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};