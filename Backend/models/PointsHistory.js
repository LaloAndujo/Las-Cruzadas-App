const mongoose = require('mongoose');

const PointsHistorySchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true }, // welcome | post | like | ...
    points: { type: Number, required: true },
    description: { type: String, required: true },
    approved: { type: Boolean, default: true }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('PointsHistory', PointsHistorySchema);
