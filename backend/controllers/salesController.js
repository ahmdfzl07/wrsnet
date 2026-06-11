class SalesController {

  static async index(req,res){
    try {

      const sales = [
        {
          id:1,
          nama_sales:'Admin',
          alamat:'KP Gelam Tengah',
          jumlah_pelanggan:473,
          pelanggan_lunas:408,
          pelanggan_belum_lunas:45,
          total_pemasukan:56325000,
          total_pengeluaran:12000000
        }
      ]

      res.render('pages/sales',{
        title:'Sales',
        active:'sales',
        sales,
        bulan:'May 2026',

        // TAMBAHAN
        user:req.user,
        appName:'WRSNET'
      })

    } catch(err){
      console.log(err)
      res.send(err.message)
    }
  }

}

module.exports = SalesController