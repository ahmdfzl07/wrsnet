const { InfrastructureLink, InfrastructurePoint } = require('../models');
const { Op } = require('sequelize');

const pointAttrs = ['id','name','type','latitude','longitude','status'];

class InfrastructureLinkController {

  // GET /api/infrastructure-links
  async index(req, res) {
    try {
      const links = await InfrastructureLink.findAll({
        include: [
          { model: InfrastructurePoint, as: 'fromPoint', attributes: pointAttrs },
          { model: InfrastructurePoint, as: 'toPoint',   attributes: pointAttrs }
        ],
        order: [['created_at','DESC']]
      });
      res.json({ success: true, data: links });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // POST /api/infrastructure-links
  async create(req, res) {
    try {
      const { from_point_id, to_point_id, link_type, status, name, notes, distance_m, waypoints } = req.body;
      if (!from_point_id || !to_point_id)
        return res.status(400).json({ success: false, message: 'from_point_id and to_point_id required' });

      // Auto-generate name if not given
      const autoName = name || `LINK-${from_point_id}-${to_point_id}`;
      const link = await InfrastructureLink.create({
        name: autoName, from_point_id, to_point_id,
        link_type:  link_type  || 'fiber',
        status:     status     || 'active',
        notes,      distance_m,
        waypoints:  waypoints  || null
      });

      const full = await InfrastructureLink.findByPk(link.id, {
        include: [
          { model: InfrastructurePoint, as: 'fromPoint', attributes: pointAttrs },
          { model: InfrastructurePoint, as: 'toPoint',   attributes: pointAttrs }
        ]
      });
      res.status(201).json({ success: true, data: full });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  // DELETE /api/infrastructure-links/:id
  async destroy(req, res) {
    try {
      const link = await InfrastructureLink.findByPk(req.params.id);
      if (!link) return res.status(404).json({ success: false, message: 'Link not found' });
      await link.destroy();
      res.json({ success: true, message: 'Link deleted' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // PUT /api/infrastructure-links/:id
  async update(req, res) {
    try {
      const link = await InfrastructureLink.findByPk(req.params.id);
      if (!link) return res.status(404).json({ success: false, message: 'Link not found' });
      await link.update(req.body);
      res.json({ success: true, data: link });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
}

module.exports = new InfrastructureLinkController();