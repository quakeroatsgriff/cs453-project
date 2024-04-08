# cs453-project
Final project for CS453: Cloud Data Management.

Griffen Agnello, Aiden Dickson

## Requirements

- Node version: v21.0.0

## How to run

- `python -m venv venv`
- `source ./venv/bin/activate`
- `pip install -r requirements.txt`
- `npm start` or `node --env-file=.env server.js`
- Connect to `http://localhost:3000/`

## AWS stuff

- DynamoDB table name: `cs453-project-database`
  - Partition key: `cs453-parition-key`
- S3 Bucket: `cs453-project-bucket`