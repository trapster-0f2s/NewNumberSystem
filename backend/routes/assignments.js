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

// Create new assignment with DP numbers - WITH DUPLICATE VALIDATION
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, numbers } = req.body;

    // Validate numbers format
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Numbers array is required and cannot be empty' });
    }

    // Process numbers to ensure DP format
    const dpNumbers = numbers.map(num => {
      const cleanNum = num.toString().replace(/^DP/i, '').trim();
      const numValue = parseInt(cleanNum, 10);
      
      // Validate positive whole numbers only
      if (isNaN(numValue) || numValue <= 0 || cleanNum.includes('.')) {
        throw new Error(`Invalid number format: ${num}. Only positive whole numbers are allowed.`);
      }
      
      return `DP${cleanNum.padStart(4, '0')}`;
    });

    // Check for internal duplicates in the input
    const uniqueNumbers = [...new Set(dpNumbers)];
    if (uniqueNumbers.length !== dpNumbers.length) {
      const duplicatesInInput = dpNumbers.filter((num, index) => 
        dpNumbers.indexOf(num) !== index
      );
      return res.status(400).json({ 
        error: `Duplicate numbers found in your input: ${[...new Set(duplicatesInInput)].join(', ')}` 
      });
    }

    // ✅ CHECK FOR EXISTING NUMBERS IN DATABASE
    const existingAssignments = await Assignment.find({ 
      createdBy: req.user._id,
      numbers: { $in: dpNumbers }
    });

    if (existingAssignments.length > 0) {
      const existingNumbers = existingAssignments.flatMap(a => a.numbers);
      const duplicates = dpNumbers.filter(num => existingNumbers.includes(num));
      
      return res.status(400).json({ 
        error: `These numbers already exist in your assignments: ${duplicates.join(', ')}` 
      });
    }

    // Create the assignment
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
    
    if (error.message.includes('Invalid number format')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Server error creating assignment' });
  }
});

// Get all numbers (for the numbers list page)
router.get('/numbers', authenticateToken, async (req, res) => {
  try {
    const assignments = await Assignment.find({ createdBy: req.user._id });
    const allNumbers = assignments.flatMap(assignment => assignment.numbers);
    
    // Remove duplicates and sort
    const uniqueNumbers = [...new Set(allNumbers)].sort((a, b) => {
      const numA = parseInt(a.replace(/^DP0*/, '')) || 0;
      const numB = parseInt(b.replace(/^DP0*/, '')) || 0;
      return numA - numB;
    });
    
    res.json({ 
      numbers: uniqueNumbers,
      totalNumbers: uniqueNumbers.length
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