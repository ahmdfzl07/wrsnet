const { User, Role, Permission, RolePermission } = require('../models');
const { Op } = require('sequelize');
const { paginateResponse } = require('../utils/helpers');

class UserController {
  // List users
  async index(req, res) {
    try {
      const { page = 1, limit = 20, search, role } = req.query;
      const where = {};
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ];
      }
      if (role) where.role_id = role;

      const offset = (page - 1) * limit;
      const { count, rows } = await User.findAndCountAll({
        where,
        include: [{ model: Role, as: 'role' }],
        offset,
        limit: parseInt(limit),
        order: [['created_at', 'DESC']]
      });

      res.json({ success: true, ...paginateResponse(rows, count, page, limit) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Create user
  async create(req, res) {
    try {
      const { name, email, password, role_id, phone } = req.body;
      const user = await User.create({ name, email, password, role_id, phone });
      const fullUser = await User.findByPk(user.id, {
        include: [{ model: Role, as: 'role' }]
      });
      res.status(201).json({ success: true, data: fullUser });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Get user
  async show(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        include: [{ model: Role, as: 'role' }]
      });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Update user
  async update(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const { name, email, role_id, phone, is_active } = req.body;
      await user.update({ name, email, role_id, phone, is_active });
      
      const updated = await User.findByPk(user.id, {
        include: [{ model: Role, as: 'role' }]
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Delete user
  async destroy(req, res) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      if (user.id === req.user.id) {
        return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
      }
      await user.destroy();
      res.json({ success: true, message: 'User deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ===== Role Management =====
  async getRoles(req, res) {
    try {
      const roles = await Role.findAll({
        include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
        order: [['id', 'ASC']]
      });
      res.json({ success: true, data: roles });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async createRole(req, res) {
    try {
      const { name, display_name, description, permissions } = req.body;
      const role = await Role.create({ name, display_name, description });
      if (permissions && permissions.length > 0) {
        const rolePerms = permissions.map(pid => ({ role_id: role.id, permission_id: pid }));
        await RolePermission.bulkCreate(rolePerms);
      }
      const full = await Role.findByPk(role.id, {
        include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
      });
      res.status(201).json({ success: true, data: full });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async updateRole(req, res) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
      if (role.is_system) return res.status(400).json({ success: false, message: 'Cannot edit system role' });

      const { display_name, description, permissions } = req.body;
      await role.update({ display_name, description });

      if (permissions) {
        await RolePermission.destroy({ where: { role_id: role.id } });
        const rolePerms = permissions.map(pid => ({ role_id: role.id, permission_id: pid }));
        await RolePermission.bulkCreate(rolePerms);
      }

      const full = await Role.findByPk(role.id, {
        include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
      });
      res.json({ success: true, data: full });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteRole(req, res) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
      if (role.is_system) return res.status(400).json({ success: false, message: 'Cannot delete system role' });

      const userCount = await User.count({ where: { role_id: role.id } });
      if (userCount > 0) {
        return res.status(400).json({ success: false, message: 'Role has assigned users' });
      }

      await RolePermission.destroy({ where: { role_id: role.id } });
      await role.destroy();
      res.json({ success: true, message: 'Role deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getPermissions(req, res) {
    try {
      const permissions = await Permission.findAll({ order: [['module', 'ASC'], ['name', 'ASC']] });
      res.json({ success: true, data: permissions });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getRoles(req, res) {

  try {

    const roles = await Role.findAll({
      order: [['id', 'ASC']]
    });

    return res.json({
      success: true,
      data: roles
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}

static async createRole(req, res) {

  try {

    const {
      name,
      display_name,
      description
    } = req.body;

    if (!name || !display_name) {

      return res.status(400).json({
        success: false,
        message: 'Nama role wajib diisi'
      });
    }

    const exists = await Role.findOne({
      where: { name }
    });

    if (exists) {

      return res.status(400).json({
        success: false,
        message: 'Role sudah ada'
      });
    }

    const role = await Role.create({
      name,
      display_name,
      description
    });

    return res.json({
      success: true,
      data: role
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}

static async updateRole(req, res) {

  try {

    const role = await Role.findByPk(req.params.id);

    if (!role) {

      return res.status(404).json({
        success: false,
        message: 'Role tidak ditemukan'
      });
    }

    await role.update(req.body);

    return res.json({
      success: true,
      data: role
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}


static async deleteRole(req, res) {

  try {

    const role = await Role.findByPk(req.params.id);

    if (!role) {

      return res.status(404).json({
        success: false,
        message: 'Role tidak ditemukan'
      });
    }

    await role.destroy();

    return res.json({
      success: true,
      message: 'Role berhasil dihapus'
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}

}

exports.profile=async(req,res)=>{

    try{

        const user=await db.User.findByPk(req.user.id,{
            include:[
                {
                    model:db.Role,
                    as:"role"
                }
            ]
        });

        res.json({

            success:true,

            data:user

        });

    }

    catch(err){

        res.status(500).json({

            success:false,

            message:err.message

        });

    }

};



module.exports = new UserController();
