const express = require('express');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const Project = require('../models/Project');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/users  — admin only
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter).sort({ role: 1, name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/pms  — get all PMs (for project assignment dropdowns)
router.get('/pms', requireRole('admin'), async (req, res) => {
  try {
    const pms = await User.find({ role: 'pm', isActive: true }).select('name email').sort('name');
    res.json(pms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users  — admin only
router.post('/', requireRole('admin'), [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'pm', 'exec']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const existing = await User.findOne({ email: req.body.email });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id  — admin only
router.patch('/:id', requireRole('admin'), [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('role').optional().isIn(['admin', 'pm', 'exec']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  // Prevent admin from removing their own admin role or deactivating themselves
  if (req.params.id === req.user.id.toString()) {
    if (req.body.role && req.body.role !== 'admin') {
      return res.status(400).json({ error: "You cannot change your own role" });
    }
    if (req.body.isActive === false) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, email, password, role, isActive } = req.body;
    if (name)      user.name     = name;
    if (email)     user.email    = email;
    if (password)  user.password = password;  // pre-save hook re-hashes
    if (role)      user.role     = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id  — admin only
router.delete('/:id', requireRole('admin'), async (req, res) => {
  if (req.params.id === req.user.id.toString()) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Unassign this user from any projects they were PM on
    if (user.role === 'pm') {
      await Project.updateMany({ pm: user._id }, { $set: { pm: null } });
    }
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
