const db = require("../models");
const { Op, Sequelize } = require("sequelize");

const Invoice = db.Invoice;
const Customer = db.Customer;

/*
=========================================
SIMPAN PEMBAYARAN
=========================================
*/

exports.simpanPembayaran = async (req, res) => {
    try {

        const {
            customer_id,
            amount,
            keterangan,
            period_month,
            period_year
        } = req.body;

        const bukti_foto =
            req.file ? req.file.filename : null;

        const invoice = await Invoice.findOne({

            where: {
                customer_id,
                period_month,
                period_year
            },

            order: [["id", "DESC"]]

        });

        if (!invoice) {

            return res.json({
                success: false,
                message: "Invoice tidak ditemukan"
            });

        }

       await invoice.update({

    amount: Number(amount),
    total: Number(amount),
    status: "paid",
    paid_date: new Date(),
    notes: keterangan,
    pdf_path: bukti_foto

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

        res.json({

            success: true,
            message: "Pembayaran berhasil"

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

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

        const data = await Invoice.findOne({

            attributes: [

                [
                    Sequelize.fn(
                        "COALESCE",
                        Sequelize.fn(
                            "SUM",
                            Sequelize.col("total")
                        ),
                        0
                    ),
                    "total"
                ]

            ],

            where: {

                status: "paid",
                period_month: bulan,
                period_year: tahun

            }

        });

        res.json({

            success: true,
            total: Number(
                data.dataValues.total
            )

        });

    }

    catch (err) {

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

            include: [

                {

                    model: Customer,
                    as: "customer"

                }

            ],

            order: [

                ["created_at", "DESC"]

            ]

        });

        res.json({

            success: true,
            data

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};
exports.dashboardTotal = async (req, res) => {
    try {

        const total = await db.Invoice.sum("total", {
            where: {
                status: "paid"
            }
        });

        res.json({
            success: true,
            total: Number(total || 0)
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

exports.dashboard = async (req, res) => {

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
            createdAt: {
                [Op.gte]: start,
                [Op.lt]: end
            }
        }
    });

    const totalTrx = await db.Invoice.count({
        where: {
            status: "paid"
        }
    });

    res.render("dashboard-agen", {

        title: "Dashboard",

        user: req.user,

        todayIncome: todayIncome || 0,

        totalTrx: totalTrx || 0

    });

};
exports.dashboardStat = async (req, res) => {

    try {

        const totalIncome = await db.Invoice.sum("total", {
            where: {
                status: "paid"
            }
        });

        const totalTrx = await db.Invoice.count({
            where: {
                status: "paid"
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