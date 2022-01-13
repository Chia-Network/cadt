import { Sequelize } from 'sequelize';
import config from '../config/config.cjs';
import dotenv from 'dotenv';
dotenv.config();

// possible values: local, test
export const sequelize = new Sequelize(config[process.env.NODE_ENV]);
export const sequelizeMirror = new Sequelize(config['mirror']);
