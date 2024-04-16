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
const { promisify } = require('util');
print = console.log
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

// Promisify the exec function
const execAsync = promisify(exec);

const app = express();
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({extended: true, limit: '5mb' }));

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
 * POST request for uploading images to S3 and segmenting
 * @param {*} req
 * @param {*} res
 * @returns
 */
async function uploadAndSegment( req, res ){
  // console.log(req.body)
  let name = req.body['image_title'];
  // Retrieve the image data from the request body
  let file = req.body['file'];
  let decoded = atob(file)

  let base64Image = btoa(decoded)
  // Remove .png file extension from the filename
  let filename = req.body['filename'].slice(0,-4);
  img.Key = filename;

  // Create AWS requests
  let s3_command = new s3.PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: filename,
    Body: base64Image,
  });

  let db_command = new dynamodb.PutItemCommand({
    TableName: process.env.DB_TABLE,
    Item: {
      Key: {'S': filename},
      Name: {'S': name},
    },
  });

  // Upload image to S3 and Dynamo
  try {
    const s3_response = await s3_client.send(s3_command);
  } catch (err) {
    console.error(err);
  }
  try {
    const dynamo_response = await dynamo_client.send(db_command);
  } catch (err) {
    console.error(err);
  }

  // ------ Perform segmentation with onnx engine ------

  let dynamo_res = null

  // Query to S3 with filename as key inside the python script
  const {stdout, stderr} = await execAsync(`python run_engine.py --key ${filename}`)
  const processed_stdout = JSON.parse( processStdout( stdout ) )

  const filename_seg = filename + "_segmented"
  // const name_seg = name + "_segmented"
  // AWS Requests for segmented images
  s3_command = new s3.PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: filename_seg,
    Body: processed_stdout.data,
  });

  // db_command = new dynamodb.PutItemCommand({
  //   TableName: process.env.DB_TABLE,
  //   Item: {
  //     Key: {'S': filename_seg},
  //     Name: {'S': name_seg},
  //   },
  // });

  // Send AWS requests of segmented image
  try {
    const seg_s3_res = s3_client.send(s3_command);
  } catch (err) {
    console.error(err);
  }
  // try {
  //   const response =  dynamo_client.send(db_command);
  //   // res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
  // } catch (err) {
  //   console.error(err);
  // }
  let response = {
    filename: filename
  };
  await res.json(response);

}


async function onGetCard(req, res) {
  let filename = req.params['filename'];
  const seg_filename = filename + "_segmented";
  // Create AWS requests
  let s3_command = new s3.GetObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: filename,
  });

  let seg_s3_command = new s3.GetObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: seg_filename,
  });

  let db_command = new dynamodb.GetItemCommand({
    TableName: process.env.DB_TABLE,
    Key: {
      Key: {
        S: filename
      }
    }
  });
  let s3_res = null;
  let seg_s3_res = null;
  let db_res = null;
  try {
    s3_res = await s3_client.send(s3_command);
    seg_s3_res = await s3_client.send(seg_s3_command);
    db_res = await dynamo_client.send(db_command);
    // print(s3_res)
    // print(seg_s3_res)
    // print(db_res)

  } catch (err) {
    console.error(err);
  };
  const image = await s3_res.Body.transformToString();
  const seg_image = await seg_s3_res.Body.transformToString();
  const dynamo_name = db_res.Item["Name"].S;

  res.json({image: image, seg_image: seg_image, dynamo_name: dynamo_name});
}

async function onGetCardView(req, res) {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
}

async function onGetList(req, res){
  let db_command = new dynamodb.ScanCommand({
    TableName: process.env.DB_TABLE,
  });
  let db_res = await dynamo_client.send(db_command);
  res.json(db_res.Items)
}

/**
 * Function to process stdout. This is easily one of the silliest functions I've
 * ever had to write. Yes, it is necessary to OnSegmentImage
 */
function processStdout(stdout) {
  return stdout;
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


// app.post('/save', jsonParser, onSaveCard);
// app.post('/save', isLoggedIn, upload.single('image-upload'), uploadAndSegment);
// app.post('/save', isLoggedIn, uploadAndSegment);
app.post('/save', uploadAndSegment);

app.get('/list/', onGetList);

app.get('/get/:filename', onGetCard);
// app.get('*', isLoggedIn, onGetCardView);
app.get('*', onGetCardView);

