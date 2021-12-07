import { Sequelize } from 'sequelize';
import config from '../config/config.json';

export const sequelize = new Sequelize(config['development']);
