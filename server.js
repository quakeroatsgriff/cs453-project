const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const dynamodb = require("@aws-sdk/client-dynamodb");
const s3 = require("@aws-sdk/client-s3");
const fs = require("fs-extra");

if (process.env.ACCESS_KEY === undefined)
{
    return;
}

const s3_client = new s3.S3Client({
    credentials: {
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_KEY,
    },
    region: process.env.S3_REGION,
    signatureVersion: 'v4',
  });
//const mongodb = require('mongodb').MongoClient;
//const ObjectId = require('mongodb').ObjectId;

//const MONGO_URL = 'mongodb://localhost:27017/ecard-db';

const app = express();
const jsonParser = bodyParser.json();

app.use(express.static('public'));

let db = null;
let collection = null;
/*
 * Complete the startDbAndServer function, which connects to the MongoDB
 * server and creates a Node web server listening to port 3000.
 */
async function startDbAndServer() {
    //let client = await mongodb.connect(MONGO_URL);
    //db = client.db('ecard-db')
    //collection = db.collection('card')
    await app.listen(3000);
    console.log('Listening on port 3000');
    console.log('Access the page here: http://localhost:3000/');
};

startDbAndServer();

async function onSaveCard(req, res) {
    const imageBuffer = fs.readFileSync("happy_peter_smile.png");
    const base64Image = imageBuffer.toString('base64');
    const command = new s3.PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: "happy_peter_smile",
        Body: base64Image,
      });
    
    try {
        const response = await s3_client.send(command);
        console.log(response);
        res.json(response);
    } catch (err) {
        console.error(err);
    }
}
app.post('/save', jsonParser, onSaveCard);

async function onGetCard(req, res) {
    // const cardString = req.params.cardId;
    // const cardId = new ObjectId(cardString);
    // const response = await collection.findOne(cardId);
    res.json({style: response.style, message: response.message});
}
app.get('/get/:cardId', onGetCard);

async function onGetCardView(req, res) {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
}
app.get('*', onGetCardView);
