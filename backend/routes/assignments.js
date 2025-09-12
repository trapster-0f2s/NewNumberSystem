 const express = require('express');
const Assignment = require('../models/Assignment');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Get all assignments for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const assignments = await Assignment.find({ createdBy: req.user._id })
      .populate('createdBy', 'email role')
      .sort({ createdAt: -1 });

    res.json({ assignments });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Server error fetching assignments' });
  }
});

// Create new assignment with DP numbers
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, numbers } = req.body;

    // Process numbers to ensure DP format
    const dpNumbers = numbers.map(num => {
      const cleanNum = num.toString().replace(/^DP/i, '').trim();
      return `DP${cleanNum.padStart(4, '0')}`;
    });

    const assignment = new Assignment({
      title,
      description,
      numbers: dpNumbers,
      createdBy: req.user._id
    });

    await assignment.save();
    await assignment.populate('createdBy', 'email role');

    res.status(201).json({
      message: 'Assignment created successfully',
      assignment
    });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Server error creating assignment' });
  }
});

// Get all numbers (for the numbers list page)
router.get('/numbers', authenticateToken, async (req, res) => {
  try {
    const assignments = await Assignment.find({ createdBy: req.user._id });
    const allNumbers = assignments.flatMap(assignment => assignment.numbers);
    
    res.json({ 
      numbers: allNumbers,
      totalNumbers: allNumbers.length
    });
  } catch (error) {
    console.error('Get numbers error:', error);
    res.status(500).json({ error: 'Server error fetching numbers' });
  }
});

// Get assignment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const assignment = await Assignment.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    }).populate('createdBy', 'email role');

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ assignment });
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ error: 'Server error fetching assignment' });
  }
});

// Delete assignment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Server error deleting assignment' });
  }
});

module.exports = router;
