const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const dynamodb = require("@aws-sdk/client-dynamodb");
const s3 = require("@aws-sdk/client-s3");
const passport = require('passport');
const { exec } = require('child_process');
const { promisify } = require('util');
require('./auth');

const PORT_NUM = 3000;

// If the environment is not set up properly, exit.
if( process.env.ACCESS_KEY === undefined ) {
  console.log( "Missing env access key. Maybe try running: node --env-file=.env server.js" );
  return;
}

// Set up new S3 and DynamoDB clients to interact with for putting/getting
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

// Promisify the exec function
const execAsync = promisify(exec);

// Set up the express server
const app = express();
// Change POST requests to handle up to 5MB uploads
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({extended: true, limit: '5mb' }));

app.use(express.static('public'));

// Use secret key "cats" and passport for OAuth
app.use(session({ secret: "cats", resave: false, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());


/**
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
 * POST request for uploading images to S3, segmenting, and uploading the image name
 * to DynamoDB. Called in a front-end fetch.
 * @param {*} req request
 * @param {*} res response
 */
async function uploadAndSegment( req, res ){
  let name = req.body['image_title'];
  // Retrieve the image data from the request body
  let file = req.body['file'];
  // Decode the image to png... then encode back to Base64. It's weird, but necessary.
  let decoded = atob(file)

  let base64Image = btoa(decoded)
  // Remove .png file extension from the filename
  let filename = req.body['filename'].slice(0,-4);

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
  const {stdout, stderr} = await execAsync(`python run_engine.py --key ${filename}`, {maxBuffer: undefined})
  const processed_stdout = JSON.parse( processStdout( stdout ) )

  const filename_seg = filename + "_segmented"
  // AWS Requests for segmented images
  s3_command = new s3.PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: filename_seg,
    Body: processed_stdout.data,
  });

  // Send AWS requests of segmented image
  try {
    const seg_s3_res = s3_client.send(s3_command);
  } catch (err) {
    console.error(err);
  }

  // Send filename back to front-end so it can query with to get the images on view card.
  await res.json({filename: filename});
}

/**
 * GET request for retrieving the original image and segmented image from S3,
 * and the user-submitted image name from DynamoDB. Called in a front-end fetch.
 * @param {*} req request
 * @param {*} res response
 */
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
  // Send AWS requests
  try {
    s3_res = await s3_client.send(s3_command);
    seg_s3_res = await s3_client.send(seg_s3_command);
    db_res = await dynamo_client.send(db_command);
  } catch (err) {
    console.error(err);
  };
  // Get base64 image data, and the image name from DynamoDB.
  const image = await s3_res.Body.transformToString();
  const seg_image = await seg_s3_res.Body.transformToString();
  const dynamo_name = db_res.Item["Name"].S;

  // Send data to front-end for putting on the page.
  res.json({image: image, seg_image: seg_image, dynamo_name: dynamo_name});
}

/**
 * Serves the client the index.html page.
 */
async function onGetCardView(req, res) {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
}

/**
 * Retrieves the image name table from DynamoDB. This list of entries is used for
 * the dropdown menu on the main page.
 */
async function onGetList(req, res){
  // AWS request to the get the whole contents of the DynamoDB table
  let db_command = new dynamodb.ScanCommand({
    TableName: process.env.DB_TABLE,
  });
  let db_res = await dynamo_client.send(db_command);
  // Send the contents back to the front end
  res.json(db_res.Items)
}

/**
 * Function to process stdout. This is easily one of the silliest functions I've
 * ever had to write. Yes, it is necessary to OnSegmentImage
 */
function processStdout(stdout) {
  return stdout;
}

/**
 * Checks if the user is present in the request, otherwise sends an unauthorized status
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
function isLoggedIn(req, res, next) {
  req.user ? next() : res.sendStatus(401);
}

/**
 * Goes to the auth route and authenticates a user
 */
app.get("/auth/google",
  passport.authenticate('google', {scope: ['email', 'profile'] })
);

/**
 * The callback route for after a user signs in
 * If user successfully signs in, it redirects back to home
 * Otherwise, it goes to the auth/failure route
 */
app.get("/google/callback",
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/auth/failure'
  })
);

/**
 * Failure page for when a user could not sign in
 */
app.get("/auth/failure", (req, res) => {
  res.send('Could not authenticate!');
});

/**
 * Save route for when a user presses the upload button.
 * Requires someone be logged in.
 */
app.post('/save', isLoggedIn, uploadAndSegment);

/**
 * List route for getting all keyes in dynamodb for the dropdown
 */
app.get('/list/', onGetList);

/**
 * get route for getting a certain image from s3 and the name from dynamo
 */
app.get('/get/:filename', onGetCard);

app.get('*', onGetCardView);

