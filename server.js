const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const dynamodb = require("@aws-sdk/client-dynamodb");
const s3 = require("@aws-sdk/client-s3");
const fs = require("fs-extra");
const multer = require("multer");
const { access } = require('fs');
const querystring = require('querystring');
const passport = require('passport');
const { exec } = require('child_process');

require('./auth');

const PORT_NUM = 3000;

var img = {
  Key: null,
  Body: null
};

if( process.env.ACCESS_KEY === undefined ) {
  console.log( "Missing env access key. Maybe try running: node --env-file=.env server.js" )
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

const dynamo_client = new dynamodb.DynamoDBClient({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
  },
  region: process.env.S3_REGION,
});

// Set up multer for handling file uploads
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const app = express();
const jsonParser = bodyParser.json();

app.use(express.static('public'));
app.use(session({ secret: "cats", resave: false, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());


/*
 * Create a Node web server listening to port 3000.
 */
async function startServer() {
    await app.listen( PORT_NUM , () => {
      console.log( `Listening on port ${PORT_NUM}` );
      console.log( `Access the page here: http://localhost:${PORT_NUM}/` );
    } );
};

startServer();


/**
 * POST request for uploading images to S3
 * @param {*} req
 * @param {*} res
 * @returns
 */
async function onImageUpload( req, res ){
  let name = req.body['image-title'];
  let file = req.file;
  // Check if a file was uploaded
  // if ( !file ) {
  //   return;
  // }
  // Retrieve the image data from the request body
  const base64Image = file.buffer.toString('base64');
  // Remove .png file extension from the filename
  const filename = file.originalname.slice(0,-4);
  const s3_command = new s3.PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: filename,
    Body: base64Image,
  });
  img.Key = filename;
  img.Body = base64Image;

  const db_command = new dynamodb.PutItemCommand({
    TableName: process.env.DB_TABLE,
    Item: {
      Key: {'S': filename},
      Name: {'S': name},
    },
  });

  // console.log(command)
  try {
    const response = await s3_client.send(s3_command);
    // Dummy response so we don't keep uploading images to s3
    // const response = {
    //   '$metadata': {
    //     httpStatusCode: 200,
    //     requestId: 'YG9CEYQDHYD46SHV',
    //     extendedRequestId: 'l7v',
    //     cfId: undefined,
    //     attempts: 1,
    //     totalRetryDelay: 0
    //   },
    //   ETag: '"1b14f44a9"',
    //   ServerSideEncryption: 'AES256'
    // }
    //console.log(response);
    //await res.json(response);
    //res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
  } catch (err) {
    console.error(err);
  }
  try {
    const response = await dynamo_client.send(db_command);
    //console.log(response);
    await res.json(response);
  } catch (err) {
    console.error(err);
  }
}


async function onGetCard(req, res) {
    // const cardString = req.params.cardId;
    // const cardId = new ObjectId(cardString);
    // const response = await collection.findOne(cardId);
    res.json({style: response.style, message: response.message});
}

async function onGetCardView(req, res) {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
}

async function onSegmentImage( req, res ){
  // let filename = req.body['image-title'];
  const filename = 'peter_heatmap';
  let dynamo_res = null

  // const describe_table = new dynamodb.DescribeTableCommand({TableName:process.env.DB_TABLE})
  const get_dynamo_command = new dynamodb.GetItemCommand({
    TableName: process.env.DB_TABLE,
    Key: {
      Key: {'S': filename},
    }
  });

  try {
    dynamo_res = await dynamo_client.send(get_dynamo_command);
  } catch (err) {
    console.error(err);
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
  }
  const pythonProcess = exec(`python run_engine.py --key ${dynamo_res.Item.Key.S}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error}`);
      return;
    }
    // Get
    const output = JSON.parse(stdout);
    // console.log(stdout)

  });
  // pythonProcess.on('exit', (error, stdout, stderr) => {
  //     const output = JSON.parse(stdout);
  //     console.log(stdout)
  //     res.json(output)
  // });
}

function isLoggedIn(req, res, next) {
  req.user ? next() : res.sendStatus(401);
}

app.get("/auth/google",
  passport.authenticate('google', {scope: ['email', 'profile'] })
);

app.get("/google/callback",
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/auth/failure'
  })
);

app.get("/auth/failure", (req, res) => {
  res.send('Could not authenticate!');
});


app.get("/segment/", isLoggedIn, onSegmentImage);
// app.post('/save', jsonParser, onSaveCard);
app.post('/save', isLoggedIn, upload.single('image-upload'), onImageUpload);

app.get('/get/:cardId', onGetCard);
app.get('*', isLoggedIn, onGetCardView);
