import express from 'express';
import {type Application, type Request, type Response} from 'express';
import morgan from 'morgan';
import dotenv from 'dotenv';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config();
import { testConnection } from './db/db';

const app : Application = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

async function start() {
  try {
    await testConnection();
    const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('DB connection failed', err);
    process.exit(1);
  }
}

start();