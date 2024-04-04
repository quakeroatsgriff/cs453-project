const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const dynamodb = require("@aws-sdk/client-dynamodb");
const s3 = require("@aws-sdk/client-s3");
const fs = require("fs-extra");
const multer = require("multer");

const PORT_NUM = 3000
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

// Set up multer for handling file uploads
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const app = express();
const jsonParser = bodyParser.json();

app.use(express.static('public'));

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
  let file = req.file
  // Check if a file was uploaded
  if ( !file ) {
    return;
  }
  // Retrieve the image data from the request body
  const base64Image = file.buffer.toString('base64');
  // Remove .png file extension from the filename
  const filename = file.originalname.slice(0,-4);
  const command = new s3.PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: filename,
    Body: base64Image,
  });
  img.Key = filename;
  img.Body = base64Image;

  // console.log(command)
  try {
    // const response = await s3_client.send(command);
    // Dummy response so we don't keep uploading images to s3
    const response = {
      '$metadata': {
        httpStatusCode: 200,
        requestId: 'YG9CEYQDHYD46SHV',
        extendedRequestId: 'l7v',
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
      },
      ETag: '"1b14f44a9"',
      ServerSideEncryption: 'AES256'
    }
    // console.log(response);
    await res.json(response);
    // res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
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


// app.post('/save', jsonParser, onSaveCard);
app.post('/save', upload.single('image-upload'), onImageUpload);
app.get('/get/:cardId', onGetCard);
app.get('*', onGetCardView);
