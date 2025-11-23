import express from 'express';
import {type Application, type Request, type Response} from 'express';
import morgan from 'morgan';
const app : Application = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get('/', (req: Request, res: Response) => {
    res.status(200).send('Hello world');
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});