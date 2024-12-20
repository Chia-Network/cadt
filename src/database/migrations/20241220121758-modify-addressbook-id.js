import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    // Change `id` column
    await queryInterface.changeColumn('addressBook', 'id', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      defaultValue: uuidv4(),
      primaryKey: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert `id` column to the original definition
    await queryInterface.changeColumn('addressBook', 'id', {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.STRING,
    });
  },
};
