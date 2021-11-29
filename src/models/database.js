import { Sequelize } from 'sequelize';
export const sequelize = new Sequelize('sqlite::memory:');
