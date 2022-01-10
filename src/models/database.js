import { Sequelize } from 'sequelize';
import config from '../config/config.cjs';

export const sequelize = new Sequelize(config['local']);
