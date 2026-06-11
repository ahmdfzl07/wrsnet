const { User, Topup } = require("../models");

const form = async (req, res) => {
    try {

        const data = await Topup.findAll({
            include: [{
                model: User,
                as: "user",
                attributes: ["id", "name"]
            }],
            order: [["createdAt","DESC"]]
        });

        res.render("pages/form-topup", {
    title: "ACC TopUp",
    active: "form-topup",
    appName: res.locals.appName || "WRS NET",
    user: req.user || res.locals.user || {},
    data
});

    } catch(err){
        console.log(err);
        res.send(err.message);
    }
};
const store = async (req, res) => {

    try {

        console.log("BODY :", req.body);
        console.log("FILE :", req.file);

        const {
            user_id,
            amount,
            payment_method,
            description
        } = req.body;

        if (!amount || Number(amount) <= 0) {

            return res.status(400).json({
                success: false,
                message: "Nominal tidak valid"
            });

        }

        if (!user_id) {

            return res.status(400).json({
                success: false,
                message: "User tidak ditemukan"
            });

        }

        const user = await User.findByPk(user_id);

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User tidak ditemukan"
            });

        }

        await Topup.create({

            user_id: user.id,
            amount: Number(amount),
            method: payment_method,
            note: description,
            proof: req.file ? req.file.filename : null,
            status: "pending"

        });

        return res.json({

            success: true,
            message: "Pengajuan Top Up berhasil dan menunggu approval Admin"

        });

    } catch (err) {

        console.log(err);

        return res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

const dashboard = async (req, res) => {

    const user = await User.findByPk(req.user.id);

    res.render("pages/dashboard-agen", {
        user
    });

};

const approve = async (req, res) => {
    try {
        const topup = await Topup.findByPk(req.params.id);

        if (!topup) {
            return res.redirect("/topup");
        }

        if (topup.status === "approved") {
            return res.redirect("/topup");
        }

        const user = await User.findByPk(topup.user_id);

        if (!user) {
            return res.redirect("/topup");
        }

        const balanceLama = Number(user.balance || 0);
        const nominalTopup = Number(topup.amount);

        user.balance = balanceLama + nominalTopup;
        await user.save();

        topup.status = "approved";
        await topup.save();

        return res.redirect("/topup");

    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
};

const reject = async (req, res) => {
    try {
        const topup = await Topup.findByPk(req.params.id);

        if (topup) {
            topup.status = "rejected";
            await topup.save();
        }

        return res.redirect("/topup");

    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
};

module.exports = {
    form,
    store,
    approve,
    reject,
};