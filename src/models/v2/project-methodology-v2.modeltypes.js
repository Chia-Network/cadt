import Sequelize from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
export default {
  cadTrustProjectMethodologyId: {
    type: Sequelize.STRING(36),
    primaryKey: true,
    allowNull: false,
    field: 'cad_trust_project_methodology_id',
    defaultValue: () => uuidv4(),
  },
  cadTrustProjectId: {
    type: Sequelize.UUID,
    allowNull: false,
    field: 'cad_trust_project_id',
  },
  cadTrustMethodologyId: {
    type: Sequelize.UUID,
    allowNull: false,
    field: 'cad_trust_methodology_id',
  },
  projectMethodologyDate: {
    type: Sequelize.DATEONLY,
    allowNull: true,
    field: 'project_methodology_date',
  },
  projectMethodologyDescription: {
    type: Sequelize.TEXT,
    allowNull: true,
    field: 'project_methodology_description',
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
};
