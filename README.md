# cs453-project
Final project for CS453: Cloud Data Management.

Griffen Agnello, Aiden Dickson

## Requirements

- Node version: v21.0.0

## How to run

### Setting up the environment

- Make sure the `.env` file is in the main directory with the necessary values
- Set up the Python environment for the machine learning model and the Node.js dependencies.
  - Do this once:
    ```
    npm install
    python -m venv venv
    source ./venv/bin/activate
    pip install -r requirements.txt
    ```

### Starting up the application

- `source ./venv/bin/activate`
- `npm start` or `node --env-file=.env server.js`
- Connect to `http://localhost:3000/`

## AWS stuff

- DynamoDB table name: `cs453-project-database`
  - Partition key: `cs453-parition-key`
- S3 Bucket: `cs453-project-bucket`